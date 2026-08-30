# Changelog

## [1.3.2] - 2026-08-30

### Features

- Add an "Individual margins" toggle for the logo: when enabled, the four sides (top / right / bottom / left) can each be tuned separately; when disabled (default), the single uniform margin applies
- Move "Logo scale" to the top of the Logo layout settings group

### Bug Fixes

- Fix the particle wordmark occasionally not refreshing after settings changes: logo position, logo scale and logo margins are now part of the rebuild signature (previously only detected when the container happened to resize), a tripped rebuild circuit breaker now retries after a cooldown instead of dropping the pending change, and a rapid-settings race no longer tears down the freshly built engine

## [1.3.1] - 2026-08-30

### Compatibility

- **Plugin id renamed** from `home-tab-plus` to `first-light`: the 1.3.0 release still shipped under the old id. After updating, Obsidian treats this as a different plugin — re-enable it and re-configure its settings once; the old `home-tab-plus` folder can be removed from `.obsidian/plugins/`. Install links now point to `Moyf/first-light`.

### Features

- Add logo position and margin settings for the wordmark area, with dedicated i18n entries
- Add a selection highlight sub-page at the end of Appearance, with i18n entries
- Recent files navigation now loops: continuing past the last entry wraps back to the search bar
- Widen particle effect slider ranges (spacing 1–8, dot size down to 0.2) and tune defaults to a finer lattice

### Bug Fixes

- Fix suggester popovers being trapped behind popout windows: suggestion popups now render in the focused window, and settings-page suggesters (font / icon / image) migrated to the official `AbstractInputSuggest`, which positions itself correctly in popout settings windows
- Fix the particle engine resolving `devicePixelRatio`, computed styles and canvas resources from the main window instead of the window hosting the view (popout-safe)
- Fix a startup race that could wipe stored recent files before they were loaded
- Keep home tab leaf positions across plugin reloads: `onunload` no longer detaches the plugin's leaves
- Fix logo icon color falling back to `currentColor` when no custom color is set
- Bake the computed `stroke` of logo SVGs into the rasterized image so particle icons keep their color (CSS variables do not resolve in standalone SVG images)
- Style the native color input used by declarative settings rows, and re-render the page when a color mode dropdown changes so the custom color picker appears

### Improvements

- Resolve all Obsidian plugin review lint findings: explicit types instead of `Function`/`any`, no `@ts-ignore`, `app` passed explicitly to file utils, `window.`-prefixed timers and animation frames, `createEl` helpers, removal of deprecated `setDynamicTooltip` and of global `app` access (also fixes a latent crash in unresolved-link path resolution)
- Drop unused dependencies (`builtin-modules`, `fs-extra`, `dotenv`)

## [1.3.0] - 2026-08-30

### Features

- Add an interactive particle wordmark effect: render the logo and title as a dot grid that ripples around the cursor, with a monochrome mode (luminance-shaded single hue) and tunable parameters (canvas scale, particle spacing, dot size, disturbance radius/strength)
- Organize settings into native sub-pages (Search / Logo / Title style / Particle effect) with the declarative settings API
- Rebrand the plugin as **First Light**
- Modernize the settings tab with the Obsidian 1.13 declarative settings API (`getSettingDefinitions`)
- Add a plugin icon (`house`) to the settings sidebar
- Add i18n support with English and Simplified Chinese locales (`getLanguage()`-based)

### Improvements

- Fix typos and apply sentence case to setting names ("Show shorcuts" → "Show shortcuts", "Debug Mode" → "Debug mode")
- Split combined control rows (logo, title font, colors) into one-control-per-row layout

### Compatibility

- Raise minimum Obsidian version to 1.13.0 (required by the declarative settings API)

## [1.2.3] - 2026-05-08

### Features

- Add dedicated icons for canvas, base, and database file types (`LayoutDashboard` / `Table` / `Database`)
- Add `.base`, `.components`, `.xdb` as recognized file types in the lookup table
- Add search filter support for the Recent Files section
- Support jumping to headings directly from search results
- Display alias and title matches in search suggestions
- Add hide-on-blur setting

### Improvements

- Improve fuzzy search ranking and match analysis
- Optimize sorting scores for search suggestions
- Improve suggestion item handling and lower match threshold for better recall
- Optimize heading display in suggestions

### Bug Fixes

- Fix keyboard event cleanup by calling `destroy()` in `homeView.onClose()`
- Fix key mapping issues for keyboard navigation

---

## [1.2.2] and earlier

See git history.
