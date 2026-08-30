/**
 * Particle wordmark engine.
 *
 * Rasterizes the home tab logo and/or title onto an offscreen canvas, samples
 * the pixels into a grid of physics particles, and animates them on an overlay
 * canvas, repelling them around the cursor (Arknights-website-style ripple).
 *
 * Pure TypeScript on purpose: no Svelte and no Obsidian imports, so it stays
 * reusable and testable outside the plugin UI layer.
 */

export interface ParticleWordmarkOptions {
    monochrome: boolean
    color: string
    /** Enlargement of the canvas content relative to the original wordmark box. */
    zoom: number
    /** Lattice spacing between sampled particles, CSS pixels. */
    spacing: number
    /** Radius of a single particle, CSS pixels (before zoom). */
    dotSize: number
    /** Radius of the cursor disturbance area, CSS pixels. */
    repulsionRadius: number
    /** How strongly the cursor pushes particles away. */
    repulsionStrength: number
}

interface Particle {
    x: number
    y: number
    hx: number
    hy: number
    vx: number
    vy: number
    radius: number
    fill: string
}

interface RGB {
    r: number
    g: number
    b: number
}

type DrawOp =
    | { kind: 'text'; element: HTMLHeadingElement; offsetX: number; offsetY: number }
    | { kind: 'image'; element: HTMLImageElement; offsetX: number; offsetY: number; width: number; height: number }
    | { kind: 'svg'; element: SVGSVGElement; offsetX: number; offsetY: number; width: number; height: number }

interface CapturedSources {
    ops: DrawOp[]
    hiddenElements: HTMLElement[]
}

const SPRING_STRENGTH = 0.02
const DAMPING = 0.12
const MAX_PARTICLES = 15000
const RESIZE_DEBOUNCE_MS = 200
const MIN_ALPHA = 128
const TOUCH_REPULSION_FACTOR = 0.85
const MAX_ZOOM = 4
const LUMA_REFERENCE = 128 // sampled luminance that maps to the base color as-is
const SHADE_MIN = 0.6 // darkest shade factor in monochrome mode
const SHADE_MAX = 1.4 // brightest shade factor in monochrome mode

export class ParticleWordmarkEngine {
    private readonly container: HTMLElement
    private readonly options: ParticleWordmarkOptions
    private readonly repulsionRadius: number
    private readonly repulsionStrength: number
    private readonly zoom: number

    private particles: Particle[] = []
    private canvas: HTMLCanvasElement | null = null
    private renderContext: CanvasRenderingContext2D | null = null
    private scale = 1
    private contentWidth = 0
    private contentHeight = 0
    /** Container coords -> canvas-local coords offset (canvas is zoom× wide, centered). */
    private mouseOffsetX = 0
    private mouseOffsetY = 0
    /** Canvas size in CSS pixels = content size × zoom. */
    private cssWidth = 0
    private cssHeight = 0
    private rafId: number | null = null
    private buildToken = 0
    private destroyed = false
    private mouse = { x: -9999, y: -9999 }
    private hiddenElements: { element: HTMLElement; previousVisibility: string }[] = []
    private originalContainerPosition: string | null = null
    private resizeObserver: ResizeObserver | null = null
    private resizeTimer: number | null = null
    private rebuildTimestamps: number[] = []

    private readonly handleMouseMove = (event: MouseEvent): void => {
        const rect = this.container.getBoundingClientRect()
        // Container coords -> canvas-local coords: the zoomed canvas is
        // centered on the container box.
        this.mouse.x = event.clientX - rect.left + this.mouseOffsetX
        this.mouse.y = event.clientY - rect.top + this.mouseOffsetY
    }

    private readonly handleMouseLeave = (): void => {
        this.mouse.x = -9999
        this.mouse.y = -9999
    }

    private readonly handleVisibilityChange = (): void => {
        if (this.destroyed) return
        // The view (and therefore the container) may live in a popout window:
        // track THAT document's visibility, not the main window's.
        if (this.container.ownerDocument.hidden) {
            this.stopLoop()
        } else if (this.canvas) {
            this.startLoop()
        }
    }

    private readonly handleResize = (): void => {
        if (this.destroyed) return
        if (this.resizeTimer !== null) window.clearTimeout(this.resizeTimer)
        this.resizeTimer = window.setTimeout(() => {
            this.resizeTimer = null
            if (this.destroyed || !this.container.isConnected || !this.canvas) return
            const rect = this.resolveContentRect()
            // ResizeObserver also fires once right after observe(); ignore no-op
            // size changes. Measured in content space (the wordmark container
            // is unaffected by the wrapper's zoom padding), so the check is
            // stable across rebuilds.
            if (Math.abs(rect.width - this.contentWidth) < 1 && Math.abs(rect.height - this.contentHeight) < 1) return
            // Circuit breaker: stop runaway rebuild loops.
            const now = Date.now()
            this.rebuildTimestamps = this.rebuildTimestamps.filter((time) => now - time < 3000)
            this.rebuildTimestamps.push(now)
            if (this.rebuildTimestamps.length > 5) {
                console.warn('[home-tab] Particle effect: the wordmark container keeps resizing; auto-resample stopped to avoid a rebuild loop.')
                this.destroy()
                return
            }
            void this.resample()
        }, RESIZE_DEBOUNCE_MS)
    }

    constructor(container: HTMLElement, options: ParticleWordmarkOptions) {
        this.container = container
        this.options = options
        // Resolve from the window that hosts the container (popout-safe)
        this.repulsionRadius = options.repulsionRadius * ('ontouchstart' in (container.ownerDocument.defaultView ?? window) ? TOUCH_REPULSION_FACTOR : 1)
        this.repulsionStrength = options.repulsionStrength
        this.zoom = Math.min(Math.max(options.zoom, 1), MAX_ZOOM)
    }

    /**
     * Rasterizes the captured wordmark sources, samples them into particles,
     * and — only when everything succeeded — hides the original elements and
     * starts the animation loop. Resolves to true when the particle canvas
     * took over, false when it fell back to the normal DOM rendering.
     */
    async build(): Promise<boolean> {
        if (this.destroyed || !this.container.isConnected) return false
        const token = ++this.buildToken

        const containerRect = this.resolveContentRect()
        if (containerRect.width <= 0 || containerRect.height <= 0) return false

        const sources = this.collectSources(containerRect)
        if (sources.ops.length === 0) return false

        // Popout windows may sit on a different display: resolve the pixel
        // ratio from the container's own window.
        const scale = Math.max(2, this.container.ownerDocument.defaultView?.devicePixelRatio || 1)
        const offscreen = this.container.ownerDocument.createElement('canvas')
        offscreen.width = Math.ceil(containerRect.width * scale)
        offscreen.height = Math.ceil(containerRect.height * scale)
        const offscreenContext = offscreen.getContext('2d')
        if (!offscreenContext) return false
        offscreenContext.scale(scale, scale)

        for (const op of sources.ops) {
            if (this.destroyed || token !== this.buildToken) return false
            try {
                await this.applyDrawOp(offscreenContext, op)
            } catch (error) {
                console.warn('[home-tab] Particle effect: a wordmark source could not be rasterized and was skipped.', error)
            }
        }
        if (this.destroyed || token !== this.buildToken) return false

        this.scale = scale
        this.contentWidth = containerRect.width
        this.contentHeight = containerRect.height
        // The canvas and the reserved layout space are zoom× the content size.
        this.cssWidth = containerRect.width * this.zoom
        this.cssHeight = containerRect.height * this.zoom
        // The zoomed canvas is centered on the container box.
        this.mouseOffsetX = (this.cssWidth - containerRect.width) / 2
        this.mouseOffsetY = 0

        try {
            this.particles = this.sampleParticles(offscreen, offscreenContext)
        } catch (error) {
            // A remote logo image without CORS headers taints the canvas and
            // makes getImageData throw: fall back to the normal rendering.
            console.warn('[home-tab] Particle effect: unable to sample the wordmark pixels (a remote logo image can block canvas reads); falling back to the normal rendering.', error)
            this.destroy()
            return false
        }

        if (this.particles.length === 0) return false

        this.activate(sources)
        return true
    }

    /** Fully cleans up: cancels the animation, removes listeners/observers and the canvas, restores the original elements. */
    destroy(): void {
        if (this.destroyed) return
        this.destroyed = true
        this.buildToken++
        this.teardown()
    }

    /**
     * Re-samples the particles in place (container resize, late font load).
     * The canvas, padding and listeners stay alive — zoom is constant on this
     * path, so the reserved layout is unchanged and only the particle array
     * is swapped in a single frame, without any visual flash.
     */
    private async resample(): Promise<void> {
        const token = ++this.buildToken

        // The content element never carries zoom padding (the wrapper does),
        // so this is the exact same coordinate space build() measures in.
        const contentRect = this.resolveContentRect()
        if (contentRect.width <= 0 || contentRect.height <= 0) return

        const scale = Math.max(2, this.container.ownerDocument.defaultView?.devicePixelRatio || 1)
        const offscreen = this.container.ownerDocument.createElement('canvas')
        offscreen.width = Math.ceil(contentRect.width * scale)
        offscreen.height = Math.ceil(contentRect.height * scale)
        const offscreenContext = offscreen.getContext('2d')
        if (!offscreenContext) return
        offscreenContext.scale(scale, scale)

        for (const op of this.collectSources(contentRect).ops) {
            if (this.destroyed || token !== this.buildToken) return
            try {
                await this.applyDrawOp(offscreenContext, op)
            } catch (error) {
                console.warn('[home-tab] Particle effect: a wordmark source could not be rasterized and was skipped.', error)
            }
        }
        if (this.destroyed || token !== this.buildToken) return

        try {
            const particles = this.sampleParticles(offscreen, offscreenContext)
            if (this.destroyed || token !== this.buildToken || !this.canvas || !this.renderContext) return
            this.scale = scale
            this.contentWidth = contentRect.width
            this.contentHeight = contentRect.height
            this.cssWidth = contentRect.width * this.zoom
            this.cssHeight = contentRect.height * this.zoom
            this.mouseOffsetX = (this.cssWidth - contentRect.width) / 2
            this.mouseOffsetY = 0
            this.particles = particles
            const width = Math.ceil(this.cssWidth * scale)
            const height = Math.ceil(this.cssHeight * scale)
            if (this.canvas.width !== width || this.canvas.height !== height) {
                this.canvas.width = width
                this.canvas.height = height
                this.renderContext.setTransform(scale, 0, 0, scale, 0, 0)
            }
            this.canvas.setCssStyles({
                width: `${this.cssWidth}px`,
                height: `${this.cssHeight}px`
            })
        } catch (error) {
            // A remote logo image without CORS headers taints the canvas and
            // makes getImageData throw: fall back to the normal rendering.
            console.warn('[home-tab] Particle effect: unable to sample the wordmark pixels; falling back to the normal rendering.', error)
            this.destroy()
        }
    }

    /** Finds the logo and title sources (always captured together). */
    private collectSources(containerRect: { left: number; top: number }): CapturedSources {
        const ops: DrawOp[] = []
        const hiddenElements: HTMLElement[] = []

        {
            const logoContainer = this.container.querySelector<HTMLElement>('.home-tab-logo')
            if (logoContainer) {
                const svg = logoContainer.querySelector<SVGSVGElement>('svg')
                const img = svg ? null : logoContainer.querySelector<HTMLImageElement>('img')
                const target: SVGSVGElement | HTMLImageElement | null = svg ?? img
                if (target) {
                    const rect = target.getBoundingClientRect()
                    if (rect.width > 0 && rect.height > 0) {
                        const offsetX = rect.left - containerRect.left
                        const offsetY = rect.top - containerRect.top
                        if (svg) {
                            ops.push({ kind: 'svg', element: svg, offsetX, offsetY, width: rect.width, height: rect.height })
                        } else if (img) {
                            ops.push({ kind: 'image', element: img, offsetX, offsetY, width: rect.width, height: rect.height })
                        }
                        hiddenElements.push(logoContainer)
                    }
                }
            }
        }

        {
            const heading = this.container.querySelector<HTMLHeadingElement>('.home-tab-wordmark h1')
            if (heading && heading.textContent && heading.textContent.trim().length > 0) {
                const rect = heading.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                    ops.push({ kind: 'text', element: heading, offsetX: rect.left - containerRect.left, offsetY: rect.top - containerRect.top })
                    hiddenElements.push(heading)
                }
            }
        }

        return { ops, hiddenElements }
    }

    private async applyDrawOp(context: CanvasRenderingContext2D, op: DrawOp): Promise<void> {
        if (op.kind === 'text') {
            this.drawText(context, op.element, op.offsetX, op.offsetY)
        } else if (op.kind === 'image') {
            await this.waitForImage(op.element)
            context.drawImage(op.element, op.offsetX, op.offsetY, op.width, op.height)
        } else {
            const image = await this.rasterizeSvg(op.element)
            context.drawImage(image, op.offsetX, op.offsetY, op.width, op.height)
        }
    }

    /** Draws the heading text with the element's computed font, color and alignment. */
    private drawText(context: CanvasRenderingContext2D, element: HTMLHeadingElement, offsetX: number, offsetY: number): void {
        // Computed styles must be resolved by the element's own window (popout-safe)
        const style = (element.ownerDocument.defaultView ?? window).getComputedStyle(element)
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        context.fillStyle = style.color
        context.textBaseline = 'alphabetic'

        const text = element.textContent ?? ''
        const metrics = context.measureText(text)
        const fontSizePx = parseFloat(style.fontSize) || 0
        // actualBoundingBox* is well supported in Chromium; keep a px fallback anyway.
        const ascent = metrics.actualBoundingBoxAscent || fontSizePx * 0.8
        const descent = metrics.actualBoundingBoxDescent || fontSizePx * 0.2

        const elementRect = element.getBoundingClientRect()
        let x = offsetX
        if (style.textAlign === 'center') {
            x = offsetX + (elementRect.width - metrics.width) / 2
        } else if (style.textAlign === 'right' || style.textAlign === 'end') {
            x = offsetX + elementRect.width - metrics.width
        }
        // Vertically center the glyph box inside the element box, then drop to the baseline.
        const baselineY = offsetY + (elementRect.height - (ascent + descent)) / 2 + ascent
        context.fillText(text, x, baselineY)
    }

    private waitForImage(image: HTMLImageElement): Promise<void> {
        if (image.complete && image.naturalWidth > 0) return Promise.resolve()
        return new Promise((resolve, reject) => {
            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => reject(new Error('Logo image failed to load')), { once: true })
        })
    }

    /**
     * Serializes the SVG to a data URI image. The clone gets explicit pixel
     * dimensions (serialized SVG cannot parse calc()-based width/height) and
     * the computed color so `currentColor` strokes resolve.
     */
    private rasterizeSvg(element: SVGSVGElement): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const rect = element.getBoundingClientRect()
            const clone = element.cloneNode(true)
            if (clone.instanceOf(SVGSVGElement)) {
                clone.setAttribute('width', String(rect.width))
                clone.setAttribute('height', String(rect.height))
                clone.style.width = `${rect.width}px`
                clone.style.height = `${rect.height}px`
                clone.setAttribute('color', (element.ownerDocument.defaultView ?? window).getComputedStyle(element).color)
            }
            const serialized = new XMLSerializer().serializeToString(clone)
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error('SVG logo image failed to load'))
            image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized)
        })
    }

    private sampleParticles(offscreen: HTMLCanvasElement, context: CanvasRenderingContext2D): Particle[] {
        const { data } = context.getImageData(0, 0, offscreen.width, offscreen.height)
        const mono = this.options.monochrome ? parseHexColor(this.options.color) : null
        let step = this.options.spacing * this.scale // device pixels
        let particles = this.collectParticles(data, offscreen.width, offscreen.height, step, mono)
        while (particles.length > MAX_PARTICLES) {
            step *= 2
            particles = this.collectParticles(data, offscreen.width, offscreen.height, step, mono)
        }
        return particles
    }

    private collectParticles(data: Uint8ClampedArray, width: number, height: number, step: number, mono: RGB | null): Particle[] {
        const particles: Particle[] = []
        for (let y = Math.floor(step / 2); y < height; y += step) {
            for (let x = Math.floor(step / 2); x < width; x += step) {
                const index = (y * width + x) * 4
                if (data[index + 3] <= MIN_ALPHA) continue
                // Content coords -> canvas-local coords: the rasterized content
                // is drawn centered on the zoomed canvas, so positions scale by zoom.
                const hx = (x / this.scale) * this.zoom
                const hy = (y / this.scale) * this.zoom
                let fill: string
                if (mono) {
                    // Single hue, but keep the source's light/dark variation:
                    // shade the base color by the sampled pixel's luminance.
                    const luma = (data[index] + data[index + 1] + data[index + 2]) / 3
                    fill = shadedFillString(mono, luma / LUMA_REFERENCE)
                } else {
                    fill = rgbFillString({ r: data[index], g: data[index + 1], b: data[index + 2] })
                }
                particles.push({
                    x: hx,
                    y: hy,
                    hx,
                    hy,
                    vx: 0,
                    vy: 0,
                    radius: this.options.dotSize * this.zoom,
                    fill,
                })
            }
        }
        return particles
    }

    /** Takes over the rendering: overlay canvas + hidden originals + listeners + animation loop. */
    private activate(sources: CapturedSources): void {
        this.installCanvas()
        this.hideCapturedElements(sources.hiddenElements)
        this.container.addEventListener('mousemove', this.handleMouseMove, { passive: true })
        this.container.addEventListener('mouseleave', this.handleMouseLeave)
        this.container.ownerDocument.addEventListener('visibilitychange', this.handleVisibilityChange)
        this.resizeObserver = new ResizeObserver(this.handleResize)
        this.resizeObserver.observe(this.container)
        this.startLoop()
    }

    /**
     * The content element the particle mapping is derived from: the wordmark
     * container inside the wrapper. Measuring this (instead of the wrapper,
     * which carries the zoom padding reserved by the component) keeps every
     * coordinate in content space, both for build and resample.
     */
    private resolveContentRect(): DOMRect {
        const content = this.container.querySelector<HTMLElement>('.home-tab-wordmark-container')
        return (content ?? this.container).getBoundingClientRect()
    }

    private installCanvas(): void {
        const canvas = this.container.ownerDocument.createElement('canvas')
        canvas.className = 'home-tab-particle-canvas'
        canvas.width = Math.ceil(this.cssWidth * this.scale)
        canvas.height = Math.ceil(this.cssHeight * this.scale)
        // The zoomed canvas is centered on the container box: it overflows
        // symmetrically with transparent pixels; the mouse position is mapped
        // with mouseOffsetX/Y.
        canvas.setCssStyles({
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${this.cssWidth}px`,
            height: `${this.cssHeight}px`,
            display: 'block',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 0.4s ease'
        })

        const context = canvas.getContext('2d')
        if (!context) return
        // Draw in CSS pixels; the transform maps them to device pixels.
        context.setTransform(this.scale, 0, 0, this.scale, 0, 0)

        this.originalContainerPosition = this.container.style.position
        if (!this.container.style.position) this.container.setCssStyles({ position: 'relative' })
        this.container.appendChild(canvas)
        this.canvas = canvas
        this.renderContext = context
        window.requestAnimationFrame(() => {
            if (this.canvas === canvas) canvas.setCssStyles({ opacity: '1' })
        })
    }

    /** visibility:hidden (never display:none) so the layout metrics are preserved and the page does not shift. */
    private hideCapturedElements(elements: HTMLElement[]): void {
        this.hiddenElements = elements.map((element) => {
            const previousVisibility = element.style.visibility
            element.setCssStyles({ visibility: 'hidden' })
            return { element, previousVisibility }
        })
    }

    private restoreCapturedElements(): void {
        for (const { element, previousVisibility } of this.hiddenElements) {
            element.setCssStyles({ visibility: previousVisibility })
        }
        this.hiddenElements = []
    }

    private teardown(): void {
        if (this.resizeTimer !== null) {
            window.clearTimeout(this.resizeTimer)
            this.resizeTimer = null
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect()
            this.resizeObserver = null
        }
        this.container.removeEventListener('mousemove', this.handleMouseMove)
        this.container.removeEventListener('mouseleave', this.handleMouseLeave)
        this.container.ownerDocument.removeEventListener('visibilitychange', this.handleVisibilityChange)
        this.stopLoop()
        if (this.canvas) {
            this.canvas.remove()
            this.canvas = null
            this.renderContext = null
        }
        this.restoreCapturedElements()
        if (this.originalContainerPosition !== null) {
            this.container.setCssStyles({ position: this.originalContainerPosition })
            this.originalContainerPosition = null
        }
        this.particles = []
    }

    private startLoop(): void {
        if (this.destroyed || this.rafId !== null) return
        const frame = (): void => {
            this.rafId = null
            if (this.destroyed) return
            if (!this.container.isConnected) {
                this.destroy()
                return
            }
            this.step()
            this.render()
            this.rafId = window.requestAnimationFrame(frame)
        }
        this.rafId = window.requestAnimationFrame(frame)
    }

    private stopLoop(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
    }

    /** Euler integration: mouse repulsion + spring back home + damping. */
    private step(): void {
        const radius = this.repulsionRadius
        const radiusSquared = radius * radius
        const mouseX = this.mouse.x
        const mouseY = this.mouse.y
        for (const particle of this.particles) {
            const dx = particle.x - mouseX
            const dy = particle.y - mouseY
            const distanceSquared = dx * dx + dy * dy
            if (distanceSquared < radiusSquared && distanceSquared > 0.0001) {
                const distance = Math.sqrt(distanceSquared)
                const ratio = (radius - distance) / radius
                const force = ratio * ratio * this.repulsionStrength
                particle.vx += (dx / distance) * force
                particle.vy += (dy / distance) * force
            }
            particle.vx += (particle.hx - particle.x) * SPRING_STRENGTH
            particle.vy += (particle.hy - particle.y) * SPRING_STRENGTH
            particle.vx *= 1 - DAMPING
            particle.vy *= 1 - DAMPING
            particle.x += particle.vx
            particle.y += particle.vy
        }
    }

    private render(): void {
        const context = this.renderContext
        if (!context) return
        context.clearRect(0, 0, this.cssWidth, this.cssHeight)
        let lastFill = ''
        for (const particle of this.particles) {
            if (particle.fill !== lastFill) {
                context.fillStyle = particle.fill
                lastFill = particle.fill
            }
            context.fillRect(particle.x - particle.radius, particle.y - particle.radius, particle.radius * 2, particle.radius * 2)
        }
    }
}

function parseHexColor(color: string): RGB {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
    if (!match) return { r: 108, g: 49, b: 227 } // fall back to the default particle color
    let hex = match[1]
    if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('')
    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
    }
}

function rgbFillString(rgb: RGB): string {
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

/** Shades a base color by a luminance factor, keeping a single hue with light/dark variation. */
function shadedFillString(base: RGB, factor: number): string {
    const clamped = Math.min(SHADE_MAX, Math.max(SHADE_MIN, factor))
    const channel = (value: number) => Math.min(255, Math.round(value * clamped))
    return `rgb(${channel(base.r)}, ${channel(base.g)}, ${channel(base.b)})`
}
