# Changelog

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
