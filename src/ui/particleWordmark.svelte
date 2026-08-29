<script lang="ts">
    import { onDestroy, onMount } from 'svelte'
    import { pluginSettingsStore } from '../store'
    import { ParticleWordmarkEngine, type ParticleWordmarkMode } from '../utils/particleEngine'
    import type { HomeTabSettings } from '../settings'

    export let enabled: boolean
    export let mode: ParticleWordmarkMode
    export let monochrome: boolean
    export let color: string
    export let zoom: number
    export let spacing: number
    export let dotSize: number
    export let disturbRadius: number
    export let disturbStrength: number

    let rootEl: HTMLElement

    let engine: ParticleWordmarkEngine | null = null
    let rebuildTimer: number | undefined
    let hasBuilt = false
    let loading = false
    let unsubscribeSettings: (() => void) | undefined

    function destroyEngine(): void {
        console.log('[home-tab] particle: destroying engine')
        loading = false
        releaseLayout()
        if (engine) {
            engine.destroy()
            engine = null
        }
    }

    /**
     * Reserves the zoomed layout height synchronously, before the first
     * paint, so the search bar never appears and then gets pushed down.
     * The wrapper carries the padding; the engine only measures the content
     * element, which stays padding-free.
     */
    function reserveLayout(): void {
        if (!rootEl) return
        const content = rootEl.querySelector<HTMLElement>('.home-tab-wordmark-container')
        if (!content) return
        const height = content.getBoundingClientRect().height
        if (height <= 0) return
        rootEl.style.padding = `${((zoom - 1) * height) / 2}px 0`
    }

    function releaseLayout(): void {
        if (rootEl) rootEl.style.padding = ''
    }

    /**
     * Builds the engine. The source wordmark is hidden immediately (via the
     * loading class) so the original never flashes before the canvas is
     * ready; on any fallback the class is removed and the normal rendering
     * takes over again.
     */
    async function createEngine(): Promise<void> {
        if (!rootEl) return
        reserveLayout()
        engine = new ParticleWordmarkEngine(rootEl, {
            mode,
            monochrome,
            color,
            zoom,
            spacing,
            dotSize,
            repulsionRadius: disturbRadius,
            repulsionStrength: disturbStrength,
        })
        loading = true
        const tookOver = await engine.build()
        loading = false
        console.log(`[home-tab] particle: engine built, tookOver=${tookOver}`)
        if (!tookOver) {
            releaseLayout()
            engine.destroy()
            engine = null
        }
    }

    /**
     * Debounced destroy + recreate, so dragging the color picker or switching
     * dropdowns doesn't thrash the engine. The first run builds immediately.
     */
    function scheduleRebuild(): void {
        if (!rootEl) return
        window.clearTimeout(rebuildTimer)
        if (!enabled) {
            destroyEngine()
            hasBuilt = true
            return
        }
        if (!hasBuilt) {
            hasBuilt = true
            void createEngine()
            return
        }
        rebuildTimer = window.setTimeout(() => {
            rebuildTimer = undefined
            destroyEngine()
            void createEngine()
        }, 250)
    }

    // Reactive: (re)build whenever the engine props or the root element change.
    // The arguments exist to establish the Svelte reactive dependencies.
    function propsChanged(enabledDep: boolean, modeDep: ParticleWordmarkMode, monochromeDep: boolean, colorDep: string, zoomDep: number, spacingDep: number, dotSizeDep: number, disturbRadiusDep: number, disturbStrengthDep: number, rootElDep: HTMLElement): void {
        void enabledDep
        void modeDep
        void monochromeDep
        void colorDep
        void zoomDep
        void spacingDep
        void dotSizeDep
        void disturbRadiusDep
        void disturbStrengthDep
        void rootElDep
        scheduleRebuild()
    }

    $: propsChanged(enabled, mode, monochrome, color, zoom, spacing, dotSize, disturbRadius, disturbStrength, rootEl)

    /**
     * Wordmark-related settings that require resampling the particles.
     * Embedded views (search-bar code blocks) are never rebuilt on settings
     * changes, so the settings store is their only update path.
     */
    function appearanceSignature(settings: HomeTabSettings): string {
        return [
            settings.logoType,
            JSON.stringify(settings.logo),
            settings.iconColorType,
            settings.iconColor,
            settings.wordmark,
            settings.customFont,
            settings.font,
            settings.fontSize,
            settings.fontWeight,
            settings.fontColorType,
            settings.fontColor,
        ].join('|')
    }

    onMount(() => {
        let lastAppearance: string | null = null
        unsubscribeSettings = pluginSettingsStore.subscribe((settings) => {
            if (!settings) return
            const signature = appearanceSignature(settings)
            // Skip the initial emit: the initial build already reflects it.
            if (lastAppearance === null) {
                lastAppearance = signature
                return
            }
            if (signature === lastAppearance) return
            lastAppearance = signature
            if (!enabled || !hasBuilt) return
            scheduleRebuild()
        })
    })

    onDestroy(() => {
        window.clearTimeout(rebuildTimer)
        destroyEngine()
        if (unsubscribeSettings) unsubscribeSettings()
    })
</script>

<div bind:this={rootEl} class:home-tab-particle-loading={loading} data-scope={mode}><slot/></div>

<style>
    /* Hide the original wordmark synchronously while the particle canvas
       builds, so it never flashes; elements outside the capture scope stay
       visible (e.g. the title when the scope is logo-only). */
    .home-tab-particle-loading :global(.home-tab-logo),
    .home-tab-particle-loading :global(.home-tab-wordmark) {
        visibility: hidden;
    }
    .home-tab-particle-loading[data-scope='logo'] :global(.home-tab-wordmark) {
        visibility: visible;
    }
    .home-tab-particle-loading[data-scope='title'] :global(.home-tab-logo) {
        visibility: visible;
    }
</style>
