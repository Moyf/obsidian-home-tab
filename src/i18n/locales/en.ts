import type { BaseMessage } from '../types'

const en: BaseMessage = {
	command: {
		openNewTab: 'Open new tab',
		replaceCurrentTab: 'Replace current tab',
	},
	viewName: 'Home tab',
	group: {
		search: 'Search',
		files: 'Files',
		appearance: 'Appearance',
		developer: 'Developer',
		headingJump: 'Heading navigation',
		results: 'Results display',
	},
	page: {
		search: { name: 'Search', desc: 'Search behavior, result display, and heading navigation.' },
		logo: { name: 'Logo', desc: 'Logo type, source, color, and size.' },
		titleStyle: { name: 'Title style', desc: 'Title text, font, size, weight, and color.' },
	},
	setting: {
		replaceNewTabs: {
			name: 'Replace new tabs with Home tab',
		},
		newTabOnStart: {
			name: 'Open new Home tab on Obsidian start',
			desc: "If a Home tab is already open it'll focus it instead of opening a new one.",
		},
		closePreviousSessionTabs: {
			name: 'Close previous session tabs on start',
			desc: 'Enable this to close all the tabs and leave only one Home tab on Obsidian opening.',
		},
		webUrlSuggestions: {
			name: 'Web link suggestions',
			desc: 'Detect web addresses typed in the search bar and offer to open them with the Web Viewer core plugin.',
		},
		useOmnisearch: {
			name: 'Use Omnisearch',
			desc: 'Set Omnisearch as the default search engine.',
		},
		markdownOnly: {
			name: 'Search only markdown files',
		},
		additionalExtensions: {
			name: 'Additional extensions to search',
			desc: 'Comma-separated list of file extensions to search (without the dot). Example: form, base',
		},
		unresolvedLinks: {
			name: 'Show uncreated files',
		},
		searchTitle: {
			name: 'Search file titles',
			desc: 'Enable this to search through file titles.',
		},
		searchHeadings: {
			name: 'Search headings',
			desc: 'Enable this to search through document headings (# Title).',
		},
		autoJumpToHeading: {
			name: 'Jump to heading',
			desc: 'When search results match headings, clicking will automatically jump to the corresponding heading.',
		},
		headingJumpStrategy: {
			name: 'Heading jump strategy',
			desc: 'Smart: Only jump when heading match is more relevant than file name. Always: Jump whenever a heading matches. Never: Never jump to headings.',
			options: {
				smart: 'Smart (Recommended)',
				always: 'Always jump',
				never: 'Never jump',
			},
		},
		showPath: {
			name: 'Show file path',
			desc: 'Displays file path at the right of the filename.',
		},
		showShortcuts: {
			name: 'Show shortcuts',
			desc: 'Displays shortcuts under the search results.',
		},
		maxResults: {
			name: 'Search results',
			desc: 'Set how many results display.',
		},
		searchDelay: {
			name: 'Search delay',
			desc: 'The value is in milliseconds.',
		},
		hideOnBlur: {
			name: 'Hide on blur',
			desc: 'Hide search results when the search input loses focus.',
		},
		showOmnisearchExcerpt: {
			name: 'Show excerpt (Omnisearch)',
			desc: 'Shows the contextual part of the note that matches the search.',
		},
		showBookmarkedFiles: {
			name: 'Show bookmarked files',
			desc: 'Shows bookmarked files under the search bar.',
		},
		showRecentFiles: {
			name: 'Show recent files',
			desc: 'Displays recent files under the search bar.',
		},
		storeRecentFile: {
			name: 'Store last recent files',
			desc: 'Remembers the recent files of the previous session.',
		},
		maxRecentFiles: {
			name: 'Recent files',
			desc: 'Set how many recent files display.',
		},
		logo: {
			name: 'Logo',
			desc: 'Remove or set a custom logo. Accepts local files, links to images or lucide icon ids.',
			placeholder: 'Type anything ... ',
			invalidTooltip: 'The path/link/icon is not valid.',
			options: {
				default: 'Obsidian logo',
				oldLogo: 'Obsidian old logo',
				imagePath: 'Local image',
				imageLink: 'Link',
				lucideIcon: 'Lucide icon',
				none: 'Empty',
			},
		},
		logoSource: {
			name: 'Logo source',
		},
		iconColor: {
			name: 'Logo icon color',
			desc: 'Set the icon color',
		},
		logoScale: {
			name: 'Logo scale',
			desc: 'Set the logo dimensions relative to the title font size.',
		},
		title: {
			name: 'Title',
		},
		titleFont: {
			name: 'Title font',
			desc: 'Interface font, text font, and monospace font options match the fonts set in the Appearance settings tab.',
			invalidTooltip: 'The font is not valid.',
			options: {
				interfaceFont: 'Interface font',
				textFont: 'Text font',
				monospaceFont: 'Monospace font',
				custom: 'Custom font',
			},
		},
		customFontName: {
			name: 'Font name',
		},
		fontSize: {
			name: 'Title font size',
			desc: 'Accepts any CSS font-size value.',
			invalid: 'The CSS unit is not valid.',
		},
		fontWeight: {
			name: 'Title font weight',
		},
		titleColor: {
			name: 'Title color',
		},
		selectionHighlight: {
			name: 'Selection highlight',
			desc: 'Set the color of the selected item.',
		},
		debugMode: {
			name: 'Debug mode',
			desc: 'Enable debug logging for search results and match analysis. Check the developer console for detailed information.',
		},
	},
	common: {
		themeDefault: 'Theme default',
		accentColor: 'Accent color',
		custom: 'Custom',
		resetToDefault: 'Reset to default',
	},
}

export default en
