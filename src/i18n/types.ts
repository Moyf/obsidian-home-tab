/**
 * Message catalog type. Every locale file must implement this interface —
 * a missing key triggers a compile-time error.
 */
export interface SettingEntry {
	name: string
	desc?: string
}

export interface DropdownOptions {
	[key: string]: string
}

export interface BaseMessage {
	command: {
		openNewTab: string
		replaceCurrentTab: string
	}
	viewName: string
	group: {
		search: string
		files: string
		appearance: string
		developer: string
		headingJump: string
		results: string
		logoLayout: string
		particleStyle: string
		particleCanvas: string
		particleInteraction: string
	}
	page: {
		search: SettingEntry
		logo: SettingEntry
		titleStyle: SettingEntry
		particleEffect: SettingEntry
	}
	setting: {
		replaceNewTabs: SettingEntry
		newTabOnStart: SettingEntry
		closePreviousSessionTabs: SettingEntry
		webUrlSuggestions: SettingEntry
		useOmnisearch: SettingEntry
		markdownOnly: SettingEntry
		additionalExtensions: SettingEntry
		unresolvedLinks: SettingEntry
		searchTitle: SettingEntry
		searchHeadings: SettingEntry
		autoJumpToHeading: SettingEntry
		headingJumpStrategy: SettingEntry & { options: DropdownOptions }
		showPath: SettingEntry
		showShortcuts: SettingEntry
		maxResults: SettingEntry
		searchDelay: SettingEntry
		hideOnBlur: SettingEntry
		showOmnisearchExcerpt: SettingEntry
		showBookmarkedFiles: SettingEntry
		showRecentFiles: SettingEntry
		storeRecentFile: SettingEntry
		maxRecentFiles: SettingEntry
		logo: SettingEntry & {
			placeholder: string
			invalidTooltip: string
			options: DropdownOptions
		}
		logoSource: SettingEntry
		iconColor: SettingEntry
		logoPosition: SettingEntry & { options: DropdownOptions }
		logoMargin: SettingEntry
		logoScale: SettingEntry
		title: SettingEntry
		titleFont: SettingEntry & {
			invalidTooltip: string
			options: DropdownOptions
		}
		customFontName: SettingEntry
		fontSize: SettingEntry & { invalid: string }
		fontWeight: SettingEntry
		titleColor: SettingEntry
		selectionHighlight: SettingEntry
		particleEffect: SettingEntry
		particleEffectMonochrome: SettingEntry
		particleEffectColor: SettingEntry
		particleEffectScale: SettingEntry
		particleEffectSpacing: SettingEntry
		particleEffectDotSize: SettingEntry
		particleEffectDisturbRadius: SettingEntry
		particleEffectDisturbStrength: SettingEntry
		debugMode: SettingEntry
	}
	common: {
		themeDefault: string
		accentColor: string
		custom: string
		resetToDefault: string
	}
}
