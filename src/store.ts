import { writable } from 'svelte/store'
import type { HomeTabSettings } from './settings'
import type { recentFile } from './recentFiles'
import type { bookmarkedFile } from './bookmarkedFiles'

export const pluginSettingsStore = writable<HomeTabSettings>()
export const bookmarkedFiles = writable<bookmarkedFile[]>()
export const recentFiles = writable<recentFile[]>([])
// Request the recent files filter input to expand and grab focus (search bar -> filter Tab navigation)
export const recentFilterFocusRequest = writable(0)
// Request the recent files list to grab focus on its first item (search bar -> list Shift+Tab navigation)
export const recentListFocusRequest = writable(0)