import type { BaseMessage } from '../types'

const zhCN: BaseMessage = {
	command: {
		openNewTab: '打开新标签页',
		replaceCurrentTab: '替换当前标签页',
	},
	viewName: 'First Light',
	group: {
		search: '搜索',
		files: '文件',
		appearance: '外观',
		developer: '开发者',
		headingJump: '标题跳转',
		results: '结果显示',
		logoLayout: 'Logo 布局',
		particleStyle: '样式',
		particleCanvas: '画布',
		particleInteraction: '交互',
	},
	page: {
		search: { name: '搜索', desc: '搜索行为、结果显示与标题跳转' },
		logo: { name: 'Logo', desc: 'Logo 图标、来源、颜色与尺寸' },
  titleStyle: { name: '标题', desc: '标题文本、字体、字号、字重与颜色' },
		selectionHighlight: { name: '选中高亮', desc: '设置文件项选中时的高亮方式' },
		particleEffect: { name: '粒子特效', desc: 'Logo 与标题的交互式粒子渲染' },
	},
	setting: {
		replaceNewTabs: {
			name: '将新标签页替换为 Home tab',
		},
		newTabOnStart: {
			name: 'Obsidian 启动时打开 Home tab',
			desc: '如果已有打开的 Home tab，将聚焦它而不是打开新的。',
		},
		closePreviousSessionTabs: {
			name: '启动时关闭上次会话的标签页',
			desc: '启用后，Obsidian 启动时会关闭所有标签页，只保留一个 Home tab。',
		},
		webUrlSuggestions: {
			name: '网址链接建议',
			desc: '检测在搜索栏中输入的网址，并建议使用网页查看核心插件打开。',
		},
		useOmnisearch: {
			name: '使用 Omnisearch',
			desc: '将 Omnisearch 设为默认搜索引擎。',
		},
		markdownOnly: {
			name: '仅搜索 Markdown 文件',
			desc: '开启后搜索结果仅包含 Markdown 笔记，不再匹配附件。',
		},
		additionalExtensions: {
			name: '额外搜索的扩展名',
			desc: '要额外搜索的文件扩展名，英文逗号分隔（不含点号）。示例：form, base',
		},
		unresolvedLinks: {
			name: '显示未创建的文件',
			desc: '在搜索结果中显示指向尚未创建的文件的链接。',
		},
		searchTitle: {
			name: '搜索文件标题',
			desc: '启用后将搜索文件标题。',
		},
		searchHeadings: {
			name: '搜索文内标题',
			desc: '启用后将搜索文档中的标题（# 标题）。',
		},
		autoJumpToHeading: {
			name: '跳转到文内标题',
			desc: '当搜索结果匹配文内标题时，点击将自动跳转到对应位置。',
		},
		headingJumpStrategy: {
			name: '标题跳转策略',
			desc: '智能：仅当标题匹配比文件名更相关时跳转；总是：只要匹配标题就跳转；从不：从不跳转到标题。',
			options: {
				smart: '智能（推荐）',
				always: '总是跳转',
				never: '从不跳转',
			},
		},
		showPath: {
			name: '显示文件路径',
			desc: '在文件名右侧显示文件路径。',
		},
		showShortcuts: {
			name: '显示快捷方式',
			desc: '在搜索结果下方显示快捷方式。',
		},
		maxResults: {
			name: '搜索结果数量',
			desc: '设置显示的搜索结果数量。',
		},
		searchDelay: {
			name: '搜索延迟',
			desc: '数值单位为毫秒。',
		},
		hideOnBlur: {
			name: '失焦时隐藏',
			desc: '当搜索框失去焦点时隐藏搜索结果。',
		},
		showOmnisearchExcerpt: {
			name: '显示摘要（Omnisearch）',
			desc: '显示笔记中与搜索匹配的上下文片段。',
		},
		showBookmarkedFiles: {
			name: '显示书签文件',
			desc: '在搜索栏下方显示已加书签的文件。',
		},
		showRecentFiles: {
			name: '显示最近文件',
			desc: '在搜索栏下方显示最近打开的文件。',
		},
		storeRecentFile: {
			name: '记住上次的最近文件',
			desc: '记住上一次会话的最近文件列表。',
		},
		maxRecentFiles: {
			name: '最近文件数量',
			desc: '设置显示的最近文件数量。',
		},
		logo: {
			name: 'Logo',
			desc: '移除或设置自定义 Logo。支持本地文件、图片链接或 Lucide 图标 ID。',
			placeholder: '输入任意内容 ... ',
			invalidTooltip: '路径/链接/图标无效。',
			options: {
				default: 'Obsidian 默认 Logo',
				oldLogo: 'Obsidian 旧版 Logo',
				imagePath: '本地图片',
				imageLink: '链接',
				lucideIcon: 'Lucide 图标',
				none: '空白',
			},
		},
		logoSource: {
			name: 'Logo 来源',
		},
		iconColor: {
			name: 'Logo 图标颜色',
			desc: '设置图标颜色',
		},
		logoPosition: {
			name: 'Logo 位置',
			desc: '设置 Logo 相对于标题的摆放位置。',
			options: {
				top: '上方',
				bottom: '下方',
				left: '左侧',
				right: '右侧',
			},
		},
		logoMargin: {
			name: 'Logo 边距',
			desc: '设置 Logo 四周留出的间距（像素）。',
		},
		logoMarginIndividual: {
			name: '单独调整各方向边距',
			desc: '分别为 Logo 的四个方向设置边距。',
		},
		logoMarginTop: {
			name: '上边距',
			desc: 'Logo 上方留出的间距（像素）。',
		},
		logoMarginRight: {
			name: '右边距',
			desc: 'Logo 右侧留出的间距（像素）。',
		},
		logoMarginBottom: {
			name: '下边距',
			desc: 'Logo 下方留出的间距（像素）。',
		},
		logoMarginLeft: {
			name: '左边距',
			desc: 'Logo 左侧留出的间距（像素）。',
		},
		logoScale: {
			name: 'Logo 缩放',
			desc: '设置 Logo 相对于标题字号的尺寸。',
		},
		title: {
			name: '标题',
		},
		titleFont: {
			name: '标题字体',
			desc: '界面字体、文本字体和等宽字体选项与外观设置中的字体一致。',
			invalidTooltip: '字体无效。',
			options: {
				interfaceFont: '界面字体',
				textFont: '文本字体',
				monospaceFont: '等宽字体',
				custom: '自定义字体',
			},
		},
		customFontName: {
			name: '字体名称',
		},
		fontSize: {
			name: '标题字号',
			desc: '接受任意 CSS font-size 值。',
			invalid: 'CSS 单位无效。',
		},
		fontWeight: {
			name: '标题字重',
		},
		titleColor: {
			name: '标题颜色',
		},
		selectionHighlight: {
			name: '选中项高亮',
			desc: '设置选中项的颜色。',
		},
		particleEffect: {
			name: '启用粒子特效',
			desc: '将主页的 Logo 与标题渲染为可交互的粒子点阵，鼠标经过时产生涟漪效果',
		},
		particleEffectMonochrome: {
			name: '单色模式',
			desc: '开启后所有粒子使用统一颜色；关闭时继承 Logo 与标题的原始颜色',
		},
		particleEffectColor: {
			name: '粒子颜色',
			desc: '单色模式下粒子的统一颜色',
		},
		particleEffectScale: {
			name: '画布倍率',
			desc: '粒子画布内容相对原 Logo 与标题区域的放大倍数',
		},
		particleEffectSpacing: {
			name: '粒子间距',
			desc: '采样点阵的间距，越小越密集',
		},
		particleEffectDotSize: {
			name: '粒子大小',
			desc: '单个粒子的半径',
		},
		particleEffectDisturbRadius: {
			name: '扰动范围',
			desc: '鼠标扰动作用的半径',
		},
		particleEffectDisturbStrength: {
			name: '扰动力度',
			desc: '鼠标推开粒子的强度',
		},
		debugMode: {
			name: '调试模式',
			desc: '启用搜索结果与匹配分析的调试日志。详情请查看开发者控制台。',
		},
	},
	common: {
		themeDefault: '跟随主题',
		accentColor: '强调色',
		custom: '自定义',
		resetToDefault: '重置为默认值',
	},
}

export default zhCN
