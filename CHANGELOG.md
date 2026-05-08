# Changelog

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
