<script lang="ts">
    import { onDestroy, onMount } from 'svelte'
    import { pluginSettingsStore } from '../store'
    import { ParticleWordmarkEngine } from '../utils/particleEngine'
    import type { HomeTabSettings } from '../settings'

    // Deliberately prop-free: everything is read from the settings store, so
    // parent re-renders can never invalidate this component and trigger
    // spurious rebuilds. The store subscription is the only update path.
    let rootEl: HTMLElement

    let engine: ParticleWordmarkEngine | null = null
    let rebuildTimer: number | undefined
    let hasBuilt = false
    let loading = false
    let unsubscribeSettings: (() => void) | undefined
    let rebuildTimestamps: number[] = []
    let settings: HomeTabSettings | undefined = undefined

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
        if (!rootEl || !settings) return
        const content = rootEl.querySelector<HTMLElement>('.home-tab-wordmark-container')
        if (!content) return
        const height = content.getBoundingClientRect().height
        if (height <= 0) return
        rootEl.style.padding = `${((settings.particleEffectScale - 1) * height) / 2}px 0`
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
        if (!rootEl || !settings) return
        reserveLayout()
        const next = new ParticleWordmarkEngine(rootEl, {
            monochrome: settings.particleEffectMonochrome,
            color: settings.particleEffectColor,
            zoom: settings.particleEffectScale,
            spacing: settings.particleEffectSpacing,
            dotSize: settings.particleEffectDotSize,
            repulsionRadius: settings.particleEffectDisturbRadius,
            repulsionStrength: settings.particleEffectDisturbStrength,
        })
        engine = next
        loading = true
        const tookOver = await next.build()
        loading = false
        // A newer rebuild superseded this one (shared `engine` moved on):
        // leave the current engine alone instead of tearing it down.
        if (engine !== next) return
        console.log(`[home-tab] particle: engine built, tookOver=${tookOver}`)
        if (!tookOver) {
            releaseLayout()
            next.destroy()
            engine = null
        }
    }

    /** Destroys the engine and rebuilds it with the current settings. */
    function rebuildEngine(): void {
        rebuildTimer = undefined
        destroyEngine()
        void createEngine()
    }

    /**
     * Debounced destroy + recreate, so dragging the color picker or switching
     * dropdowns doesn't thrash the engine. The first run builds immediately.
     * A circuit breaker pauses auto-rebuilds when something triggers them in
     * a tight loop; the pending rebuild is retried after a cooldown instead
     * of being dropped, so the last settings state is never lost.
     */
    function scheduleRebuild(): void {
        if (!rootEl || !settings) return
        window.clearTimeout(rebuildTimer)
        if (!settings.particleEffect) {
            destroyEngine()
            hasBuilt = true
            return
        }
        const now = Date.now()
        rebuildTimestamps = rebuildTimestamps.filter((time) => now - time < 3000)
        rebuildTimestamps.push(now)
        if (rebuildTimestamps.length > 5) {
            console.warn('[home-tab] particle: rebuild loop detected; retrying after a 3s cooldown.')
            rebuildTimer = window.setTimeout(rebuildEngine, 3000)
            return
        }
        if (!hasBuilt) {
            hasBuilt = true
            void createEngine()
            return
        }
        rebuildTimer = window.setTimeout(rebuildEngine, 250)
    }

    /** Everything the engine or the rasterized source rendering depends on. */
    function appearanceSignature(s: HomeTabSettings): string {
        return [
            s.particleEffect,
            s.particleEffectMonochrome,
            s.particleEffectColor,
            s.particleEffectScale,
            s.particleEffectSpacing,
            s.particleEffectDotSize,
            s.particleEffectDisturbRadius,
            s.particleEffectDisturbStrength,
            s.logoType,
            JSON.stringify(s.logo),
            s.iconColorType,
            s.iconColor,
            s.logoPosition,
            s.logoScale,
            s.logoMargin,
            s.logoMarginIndividual,
            s.logoMarginTop,
            s.logoMarginRight,
            s.logoMarginBottom,
            s.logoMarginLeft,
            s.wordmark,
            s.customFont,
            s.font,
            s.fontSize,
            s.fontWeight,
            s.fontColorType,
            s.fontColor,
        ].join('|')
    }

    onMount(() => {
        let lastAppearance: string | null = null
        unsubscribeSettings = pluginSettingsStore.subscribe((s) => {
            if (!s) return
            settings = s
            const signature = appearanceSignature(s)
            // The first emit drives the initial build; later ones only
            // rebuild when the signature actually changed.
            if (lastAppearance === null) {
                lastAppearance = signature
                if (s.particleEffect) scheduleRebuild()
                return
            }
            if (signature === lastAppearance) return
            lastAppearance = signature
            scheduleRebuild()
        })
    })

    onDestroy(() => {
        window.clearTimeout(rebuildTimer)
        destroyEngine()
        if (unsubscribeSettings) unsubscribeSettings()
    })
</script>

<div bind:this={rootEl} class:home-tab-particle-loading={loading}><slot/></div>

<style>
    /* Hide the original wordmark synchronously while the particle canvas
       builds, so it never flashes (both parts are always captured). */
    .home-tab-particle-loading :global(.home-tab-logo),
    .home-tab-particle-loading :global(.home-tab-wordmark) {
        visibility: hidden;
    }
</style>
