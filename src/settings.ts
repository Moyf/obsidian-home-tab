import { App, Setting, PluginSettingTab, normalizePath, Platform } from 'obsidian'
import type { IconName, SettingDefinitionItem, SettingDefinitionRender } from 'obsidian'
import type HomeTab from './main'
import iconSuggester from './suggester/iconSuggester'
import { lucideIcons, type LucideIcon } from './utils/lucideIcons'
import ImageFileSuggester from './suggester/imageSuggester'
import cssUnitValidator from './utils/cssUnitValidator'
import isLink from './utils/isLink'
import fontSuggester from './suggester/fontSuggester'
import type { recentFileStore } from './recentFiles'
import type { bookmarkedFileStore } from './bookmarkedFiles'
import { checkFont } from './utils/fontValidator'
import { t as getLocale } from './i18n'

type ColorChoices = 'default' | 'accentColor' | 'custom'
type LogoChoices = 'default' | 'imagePath' | 'imageLink' | 'lucideIcon' | 'oldLogo' | 'none'
type LogoPosition = 'top' | 'bottom' | 'left' | 'right'
type FontChoices = 'interfaceFont' | 'textFont' | 'monospaceFont' | 'custom'

interface ObjectKeys {
    [key: string]: unknown
}

interface logoStore extends ObjectKeys{
    lucideIcon: LucideIcon | ''
    imagePath: string
    imageLink: string
}

export interface HomeTabSettings extends ObjectKeys{
    logoType: LogoChoices
    logo: logoStore
    logoPosition: LogoPosition
    logoMargin: number
    logoScale: number
    iconColor?: string
    iconColorType: ColorChoices
    wordmark: string
    customFont: FontChoices
    font?: string
    fontSize: string
    fontColor?: string
    fontColorType: ColorChoices
    fontWeight: number
    particleEffect: boolean
    particleEffectMonochrome: boolean
    particleEffectColor: string
    particleEffectScale: number
    particleEffectSpacing: number
    particleEffectDotSize: number
    particleEffectDisturbRadius: number
    particleEffectDisturbStrength: number
    maxResults: number
    showbookmarkedFiles: boolean
    showRecentFiles: boolean
    maxRecentFiles: number
    storeRecentFile: boolean
    showPath: boolean
    selectionHighlight: ColorChoices
    showShortcuts: boolean
    markdownOnly: boolean
    additionalExtensions: string // 新增：额外搜索的文件后缀名，英文逗号分隔
    unresolvedLinks: boolean
    searchTitle: boolean
    searchHeadings: boolean // 是否启用标题（heading）搜索
    autoJumpToHeading?: boolean // 新增：标题匹配时自动跳转到 heading
    headingJumpStrategy?: 'never' | 'always' | 'smart' // 新增：标题跳转策略
    recentFilesStore: recentFileStore[]
    bookmarkedFileStore: bookmarkedFileStore[]
    searchDelay: number
    replaceNewTabs: boolean
    newTabOnStart: boolean
    closePreviousSessionTabs: boolean
    omnisearch: boolean
    showOmnisearchExcerpt: boolean
    webUrlSuggestions: boolean // 新增：网址功能开关，检测搜索栏输入的网址并建议用网页浏览器打开
    debugMode?: boolean // 新增：调试模式，显示搜索和匹配的详细信息
    hideOnBlur?: boolean // 新增：失去焦点时是否隐藏搜索结果
}

export const DEFAULT_SETTINGS: HomeTabSettings = {
    logoType: 'default',
    logo: {
        lucideIcon: '', 
        imagePath: '', 
        imageLink: '',},
    logoPosition: 'left',
    logoMargin: 12,
    logoScale: 1.2,
    iconColorType: 'default',
    wordmark: 'Obsidian',
    customFont: 'interfaceFont',
    fontSize: '4em',
    fontColorType: 'default',
    fontWeight: 600,
    particleEffect: false,
    particleEffectMonochrome: false,
    particleEffectColor: '#6C31E3',
    particleEffectScale: 1.9,
    particleEffectSpacing: 2,
    particleEffectDotSize: 0.5,
    particleEffectDisturbRadius: 124,
    particleEffectDisturbStrength: 1.8,
    maxResults: 5,
    // Cannot read app.internalPlugins at module level: the real availability
    // check happens in main.ts onLayoutReady (disabled -> forced to false)
    showbookmarkedFiles: true,
    showRecentFiles: true,
    maxRecentFiles: 12,
    storeRecentFile: true,
    showPath: true,
    selectionHighlight: 'default',
    showShortcuts: true,
    markdownOnly: false,
    additionalExtensions: '', // 新增：额外搜索的文件后缀名，默认为空
    unresolvedLinks: false,
    searchTitle: false,
    searchHeadings: true,
    autoJumpToHeading: true, // 新增：标题匹配时自动跳转到 heading，默认开启
    headingJumpStrategy: 'smart', // 新增：默认使用智能跳转策略
    recentFilesStore: [],
    bookmarkedFileStore: [],
    searchDelay: 0,
    replaceNewTabs: true,
    newTabOnStart: false,
    closePreviousSessionTabs: false,
    omnisearch: false,
    showOmnisearchExcerpt: true,
    webUrlSuggestions: true, // 新增：默认开启网址功能（仅当网页浏览器核心插件可用时生效）
    debugMode: false, // 新增：默认关闭调试模式
    hideOnBlur: true, // 新增：默认情况下失去焦点时隐藏搜索结果
}

export class HomeTabSettingTab extends PluginSettingTab {
    plugin: HomeTab
    icon: IconName = 'tower-control'

    /** Settings whose change requires rebuilding the open Home tab views */
    private static readonly REFRESH_OPEN_VIEWS_KEYS: ReadonlySet<string> = new Set([
        'webUrlSuggestions',
        'omnisearch',
        'markdownOnly',
        'additionalExtensions',
        'unresolvedLinks',
        'searchTitle',
        'searchHeadings',
        'showPath',
        'showShortcuts',
        'searchDelay',
        'hideOnBlur',
        'showbookmarkedFiles',
        'showRecentFiles',
        'selectionHighlight',
    ])
    // NOTE: particle-effect settings are intentionally NOT in this set — the
    // ParticleWordmark component rebuilds itself in place from prop/store
    // changes; a full rebuildView() here visibly blinks the whole view.

    constructor(app: App, plugin: HomeTab){
        super(app, plugin)
        this.plugin = plugin
    }

    /**
     * Persists control-bound values through `plugin.saveSettings()` (which also
     * syncs the settings store used by the Svelte views) and rebuilds open
     * Home tab views when the changed setting affects their rendering.
     */
    override async setControlValue(key: string, value: unknown): Promise<void> {
        this.plugin.settings[key] = value
        await this.plugin.saveSettings()
        if (HomeTabSettingTab.REFRESH_OPEN_VIEWS_KEYS.has(key)) {
            this.plugin.refreshOpenViews()
        }
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        const t = getLocale()
        const s = this.plugin.settings
        const colorOptions = () => ({
            default: t.common.themeDefault,
            accentColor: t.common.accentColor,
            custom: t.common.custom,
        })
        const searchVisible = () => !s.omnisearch

        return [
            // General — no heading (first group)
            {
                name: t.setting.replaceNewTabs.name,
                control: { type: 'toggle', key: 'replaceNewTabs' },
            },
            {
                name: t.setting.newTabOnStart.name,
                desc: t.setting.newTabOnStart.desc,
                control: { type: 'toggle', key: 'newTabOnStart' },
            },
            {
                name: t.setting.closePreviousSessionTabs.name,
                desc: t.setting.closePreviousSessionTabs.desc,
                visible: () => s.newTabOnStart,
                control: { type: 'toggle', key: 'closePreviousSessionTabs' },
            },

            // Search — sub-page entry under its own heading
            {
                type: 'group',
                heading: t.group.search,
                items: [
                    {
                        type: 'page',
                        name: t.page.search.name,
                        desc: t.page.search.desc,
                        items: [
                            {
                                name: t.setting.useOmnisearch.name,
                                desc: t.setting.useOmnisearch.desc,
                                visible: () => !!this.app.plugins.getPlugin('omnisearch'),
                                control: { type: 'toggle', key: 'omnisearch' },
                            },
                            {
                                name: t.setting.markdownOnly.name,
                                visible: searchVisible,
                                control: { type: 'toggle', key: 'markdownOnly' },
                            },
                            {
                                name: t.setting.additionalExtensions.name,
                                desc: t.setting.additionalExtensions.desc,
                                visible: () => searchVisible() && s.markdownOnly,
                                control: { type: 'text', key: 'additionalExtensions' },
                            },
                            {
                                name: t.setting.unresolvedLinks.name,
                                visible: searchVisible,
                                control: { type: 'toggle', key: 'unresolvedLinks' },
                            },
                            {
                                name: t.setting.webUrlSuggestions.name,
                                desc: t.setting.webUrlSuggestions.desc,
                                visible: () => !!this.app.internalPlugins.getPluginById('webviewer') || !!this.app.internalPlugins.getPluginById('webbrowser'),
                                control: { type: 'toggle', key: 'webUrlSuggestions' },
                            },
                            {
                                name: t.setting.searchTitle.name,
                                desc: t.setting.searchTitle.desc,
                                visible: searchVisible,
                                control: { type: 'toggle', key: 'searchTitle' },
                            },
                            {
                                type: 'group',
                                heading: t.group.headingJump,
                                items: [
                                    {
                                        name: t.setting.searchHeadings.name,
                                        desc: t.setting.searchHeadings.desc,
                                        visible: searchVisible,
                                        control: { type: 'toggle', key: 'searchHeadings' },
                                    },
                                    {
                                        name: t.setting.autoJumpToHeading.name,
                                        desc: t.setting.autoJumpToHeading.desc,
                                        visible: () => searchVisible() && s.searchHeadings,
                                        control: { type: 'toggle', key: 'autoJumpToHeading', defaultValue: true },
                                    },
                                    {
                                        name: t.setting.headingJumpStrategy.name,
                                        desc: t.setting.headingJumpStrategy.desc,
                                        visible: () => searchVisible() && s.searchHeadings && (s.autoJumpToHeading ?? true),
                                        control: {
                                            type: 'dropdown',
                                            key: 'headingJumpStrategy',
                                            defaultValue: 'smart',
                                            options: t.setting.headingJumpStrategy.options,
                                        },
                                    },
                                ],
                            },
                            {
                                type: 'group',
                                heading: t.group.results,
                                items: [
                                    {
                                        name: t.setting.showPath.name,
                                        desc: t.setting.showPath.desc,
                                        visible: searchVisible,
                                        control: { type: 'toggle', key: 'showPath' },
                                    },
                                    {
                                        name: t.setting.showShortcuts.name,
                                        desc: t.setting.showShortcuts.desc,
                                        control: { type: 'toggle', key: 'showShortcuts' },
                                    },
                                    this.sliderWithReset('maxResults', t.setting.maxResults.name, t.setting.maxResults.desc, 1, 25, 1),
                                    this.sliderWithReset('searchDelay', t.setting.searchDelay.name, t.setting.searchDelay.desc, 0, 500, 10, { refreshAfterChange: true }),
                                    {
                                        name: t.setting.hideOnBlur.name,
                                        desc: t.setting.hideOnBlur.desc,
                                        control: { type: 'toggle', key: 'hideOnBlur', defaultValue: true },
                                    },
                                    {
                                        name: t.setting.showOmnisearchExcerpt.name,
                                        desc: t.setting.showOmnisearchExcerpt.desc,
                                        visible: () => !!this.app.plugins.getPlugin('omnisearch'),
                                        control: { type: 'toggle', key: 'showOmnisearchExcerpt' },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },

            // Files
            {
                type: 'group',
                heading: t.group.files,
                items: [
                    {
                        name: t.setting.showBookmarkedFiles.name,
                        desc: t.setting.showBookmarkedFiles.desc,
                        visible: () => !!this.app.internalPlugins.getPluginById('bookmarks'),
                        control: { type: 'toggle', key: 'showbookmarkedFiles' },
                    },
                    {
                        name: t.setting.showRecentFiles.name,
                        desc: t.setting.showRecentFiles.desc,
                        control: { type: 'toggle', key: 'showRecentFiles' },
                    },
                    {
                        name: t.setting.storeRecentFile.name,
                        desc: t.setting.storeRecentFile.desc,
                        visible: () => s.showRecentFiles,
                        control: { type: 'toggle', key: 'storeRecentFile' },
                    },
                    {
                        ...this.sliderWithReset('maxRecentFiles', t.setting.maxRecentFiles.name, t.setting.maxRecentFiles.desc, 1, 25, 1),
                        visible: () => s.showRecentFiles,
                        render: (setting) => {
                            setting
                                .addSlider((slider) => slider
                                    .setValue(s.maxRecentFiles)
                                    .setLimits(1, 25, 1)
                                    .onChange((value) => {
                                        this.plugin.recentFileManager.onNewMaxListLenght(value)
                                        s.maxRecentFiles = value
                                        void this.plugin.saveSettings()
                                    }))
                            this.addResetButton(setting, 'maxRecentFiles')
                        },
                    },
                ],
            },

            // Appearance — two sub-pages under one heading
            {
                type: 'group',
                heading: t.group.appearance,
                items: [
                    {
                        type: 'page',
                        name: t.page.logo.name,
                        desc: t.page.logo.desc,
                        items: [
                            this.dropdownWithReset('logoType', t.setting.logo.name, t.setting.logo.desc, t.setting.logo.options, { rebuildAfterChange: true }),
                            {
                                name: t.setting.logoSource.name,
                                visible: () => ['imagePath', 'imageLink', 'lucideIcon'].includes(s.logoType),
                                render: (setting) => this.renderLogoSource(setting, t),
                            },
                            this.dropdownWithReset('iconColorType', t.setting.iconColor.name, t.setting.iconColor.desc, colorOptions(), {
                                visible: () => s.logoType === 'lucideIcon',
                                rebuildAfterChange: true, // re-render so the custom color picker shows up
                            }),
                            {
                                name: t.setting.iconColor.name,
                                desc: t.setting.iconColor.desc,
                                visible: () => s.logoType === 'lucideIcon' && s.iconColorType === 'custom',
                                control: { type: 'color', key: 'iconColor', defaultValue: '#000000' },
                            },
                            {
                                type: 'group',
                                heading: t.group.logoLayout,
                                items: [
                                    {
                                        // Placement applies to every rendered logo (including the built-in ones)
                                        ...this.dropdownWithReset('logoPosition', t.setting.logoPosition.name, t.setting.logoPosition.desc, t.setting.logoPosition.options),
                                        visible: () => s.logoType !== 'none',
                                    },
                                    {
                                        ...this.sliderWithReset('logoMargin', t.setting.logoMargin.name, t.setting.logoMargin.desc, 0, 50, 1),
                                        visible: () => s.logoType !== 'none',
                                    },
                                    this.sliderWithReset('logoScale', t.setting.logoScale.name, t.setting.logoScale.desc, 0.3, 3, 0.1),
                                ],
                            },
                        ],
                    },
                    {
                        type: 'page',
                        name: t.page.titleStyle.name,
                        desc: t.page.titleStyle.desc,
                        items: [
                            {
                                name: t.setting.title.name,
                                render: (setting) => {
                                    setting.addText((text) => text
                                        .setValue(s.wordmark)
                                        .onChange((value) => {
                                            s.wordmark = value
                                            void this.plugin.saveSettings()
                                        }))
                                    this.addResetButton(setting, 'wordmark')
                                },
                            },
                            this.dropdownWithReset('customFont', t.setting.titleFont.name, t.setting.titleFont.desc, t.setting.titleFont.options, { rebuildAfterChange: true }),
                            {
                                name: t.setting.customFontName.name,
                                visible: () => s.customFont === 'custom',
                                render: (setting) => this.renderCustomFontName(setting, t),
                            },
                            {
                                name: t.setting.fontSize.name,
                                desc: t.setting.fontSize.desc,
                                render: (setting) => {
                                    let invalidFontSizeIcon: HTMLElement
                                    setting
                                        .addExtraButton((button) => {button
                                            .setIcon('alert-circle')
                                            .setTooltip(t.setting.fontSize.invalid)
                                            invalidFontSizeIcon = button.extraSettingsEl
                                            invalidFontSizeIcon.addClass('mod-warning')
                                            invalidFontSizeIcon.toggleVisibility(false)
                                        })
                                        .addText((text) => text
                                            .setValue(s.fontSize)
                                            .onChange((value) => {
                                                if(cssUnitValidator(value)){
                                                    s.fontSize = value
                                                    void this.plugin.saveSettings()
                                                    invalidFontSizeIcon.toggleVisibility(false)
                                                }
                                                else{
                                                    invalidFontSizeIcon.toggleVisibility(true)
                                                }
                                            }))
                                    this.addResetButton(setting, 'fontSize')
                                },
                            },
                            this.sliderWithReset('fontWeight', t.setting.fontWeight.name, t.setting.fontWeight.desc, 100, 900, 100),
                            this.dropdownWithReset('fontColorType', t.setting.titleColor.name, undefined, colorOptions(), {
                                rebuildAfterChange: true, // re-render so the custom color picker shows up
                            }),
                            {
                                name: t.setting.titleColor.name,
                                visible: () => s.fontColorType === 'custom',
                                control: { type: 'color', key: 'fontColor', defaultValue: '#000000' },
                            },
                        ],
                    },
                    {
                        type: 'page',
                        name: t.page.selectionHighlight.name,
                        desc: t.page.selectionHighlight.desc,
                        items: [
                            this.dropdownWithReset('selectionHighlight', t.setting.selectionHighlight.name, t.setting.selectionHighlight.desc,
                                { default: t.common.themeDefault, accentColor: t.common.accentColor }, { refreshAfterChange: true }),
                        ],
                    },
                    {
                        type: 'page',
                        name: t.page.particleEffect.name,
                        desc: t.page.particleEffect.desc,
                        items: [
                            {
                                name: t.setting.particleEffect.name,
                                desc: t.setting.particleEffect.desc,
                                control: { type: 'toggle', key: 'particleEffect', defaultValue: false },
                            },
                            {
                                type: 'group',
                                heading: t.group.particleStyle,
                                items: [
                                    {
                                        name: t.setting.particleEffectMonochrome.name,
                                        desc: t.setting.particleEffectMonochrome.desc,
                                        visible: () => s.particleEffect,
                                        control: { type: 'toggle', key: 'particleEffectMonochrome', defaultValue: false },
                                    },
                                    {
                                        name: t.setting.particleEffectColor.name,
                                        desc: t.setting.particleEffectColor.desc,
                                        visible: () => s.particleEffect && s.particleEffectMonochrome,
                                        render: (setting) => {
                                            setting.addColorPicker((picker) => picker
                                                .setValue(s.particleEffectColor)
                                                .onChange((value) => {
                                                    s.particleEffectColor = value
                                                    void this.plugin.saveSettings()
                                                }))
                                            this.addResetButton(setting, 'particleEffectColor')
                                        },
                                    },
                                ],
                            },
                            {
                                type: 'group',
                                heading: t.group.particleCanvas,
                                items: [
                                    {
                                        ...this.sliderWithReset('particleEffectScale', t.setting.particleEffectScale.name, t.setting.particleEffectScale.desc, 1, 3, 0.1),
                                        visible: () => s.particleEffect,
                                    },
                                    {
                                        ...this.sliderWithReset('particleEffectSpacing', t.setting.particleEffectSpacing.name, t.setting.particleEffectSpacing.desc, 1, 8, 0.5),
                                        visible: () => s.particleEffect,
                                    },
                                    {
                                        ...this.sliderWithReset('particleEffectDotSize', t.setting.particleEffectDotSize.name, t.setting.particleEffectDotSize.desc, 0.2, 3, 0.1),
                                        visible: () => s.particleEffect,
                                    },
                                ],
                            },
                            {
                                type: 'group',
                                heading: t.group.particleInteraction,
                                items: [
                                    {
                                        ...this.sliderWithReset('particleEffectDisturbRadius', t.setting.particleEffectDisturbRadius.name, t.setting.particleEffectDisturbRadius.desc, 10, 150, 1),
                                        visible: () => s.particleEffect,
                                    },
                                    {
                                        ...this.sliderWithReset('particleEffectDisturbStrength', t.setting.particleEffectDisturbStrength.name, t.setting.particleEffectDisturbStrength.desc, 0.1, 3, 0.1),
                                        visible: () => s.particleEffect,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },

            // Developer
            {
                type: 'group',
                heading: t.group.developer,
                items: [
                    {
                        name: t.setting.debugMode.name,
                        desc: t.setting.debugMode.desc,
                        control: { type: 'toggle', key: 'debugMode', defaultValue: false },
                    },
                ],
            },
        ]
    }

    /** Logo value input with the suggester matching the selected logo type */
    private renderLogoSource(setting: Setting, t: ReturnType<typeof getLocale>): void {
        const s = this.plugin.settings
        let invalidInputIcon: HTMLElement
        setting
            .addExtraButton((button) => {button
                .setIcon('alert-circle')
                .setTooltip(t.setting.logo.invalidTooltip)
                invalidInputIcon = button.extraSettingsEl
                invalidInputIcon.toggleVisibility(false)
                invalidInputIcon.addClass('mod-warning')})

        setting
            .addSearch((text) => {
                const logoType = s.logoType
                if(logoType === 'imagePath'){
                    new ImageFileSuggester(this.app, text.inputEl)
                }
                else if(logoType === 'lucideIcon'){
                    new iconSuggester(this.app, text.inputEl, true)
                }
                text
                    .setPlaceholder(t.setting.logo.placeholder)
                    .setValue(logoType !== 'default' && s.logo[logoType] != '' ? String(s.logo[logoType]) : '')
                    .onChange(async (value) => {
                        if(value === '' || value == '/'){
                            invalidInputIcon.toggleVisibility(false)
                            return
                        }
                        const currentType = s.logoType
                        if(currentType === 'imagePath'){
                            const normalizedPath = normalizePath(value)
                            if (await this.app.vault.adapter.exists(normalizedPath)){
                                invalidInputIcon.toggleVisibility(false)
                                s.logo['imagePath'] = normalizedPath
                                void this.plugin.saveSettings()
                            }
                            else{
                                invalidInputIcon.toggleVisibility(true)
                            }
                        }
                        else if(currentType === 'imageLink'){
                            if(isLink(value)){
                                invalidInputIcon.toggleVisibility(false)
                                s.logo['imageLink'] = value
                                void this.plugin.saveSettings()
                            }
                            else{
                                invalidInputIcon.toggleVisibility(true)
                            }
                        }
                        else if(currentType === 'lucideIcon'){
                            if(lucideIcons.includes(value as LucideIcon)){
                                s.logo['lucideIcon'] = value as LucideIcon
                                void this.plugin.saveSettings()
                                invalidInputIcon.toggleVisibility(false)
                            }
                            else{
                                invalidInputIcon.toggleVisibility(true)
                            }
                        }
                    })
                    .inputEl.parentElement?.addClass('wide-input-container')
            })
    }

    /** Custom font name input with the font suggester (desktop, non-macOS only) */
    private renderCustomFontName(setting: Setting, t: ReturnType<typeof getLocale>): void {
        const s = this.plugin.settings
        let invalidFontIcon: HTMLElement
        setting
            .addExtraButton((button) => {button
                .setIcon('alert-circle')
                .setTooltip(t.setting.titleFont.invalidTooltip)
                invalidFontIcon = button.extraSettingsEl
                invalidFontIcon.toggleVisibility(false)
                invalidFontIcon.addClass('mod-warning')})

        setting.addSearch((text) => {
            text.setValue(s.font ? s.font.replace(/"/g, ''): '')
            text.setPlaceholder(t.setting.logo.placeholder)
            const suggester: fontSuggester | undefined = Platform.isMobile || Platform.isMacOS ? undefined : new fontSuggester(this.app, text.inputEl, true)

            text.onChange(async (value) => {
                value = value.indexOf(' ') >= 0 ? `"${value}"` : value //Restore "" if font name contains whitespaces
                if((suggester && (await suggester.getInstalledFonts()).includes(value)) || checkFont(value) ){
                    s.font = value
                    void this.plugin.saveSettings()
                    invalidFontIcon.toggleVisibility(false)
                }
                else{
                    invalidFontIcon.toggleVisibility(true)
                }
            })
            .inputEl.parentElement?.addClass('wide-input-container')
        })
    }

    private sliderWithReset(
        key: string,
        name: string,
        desc: string | undefined,
        min: number,
        max: number,
        step: number,
        opts?: { refreshAfterChange?: boolean },
    ): SettingDefinitionRender {
        return {
            name,
            desc,
            render: (setting) => {
                setting
                    .addSlider((slider) => slider
                        .setLimits(min, max, step)
                        .setValue(this.plugin.settings[key] as number)
                        .onChange((value) => {
                            this.plugin.settings[key] = value
                            void this.plugin.saveSettings()
                            if(opts?.refreshAfterChange){this.plugin.refreshOpenViews()}
                        }))
                this.addResetButton(setting, key)
            },
        }
    }

    private dropdownWithReset(
        key: string,
        name: string,
        desc: string | undefined,
        options: Record<string, string>,
        opts?: { visible?: () => boolean; rebuildAfterChange?: boolean; refreshAfterChange?: boolean },
    ): SettingDefinitionRender {
        return {
            name,
            desc,
            visible: opts?.visible,
            render: (setting) => {
                setting
                    .addDropdown((dropdown) => dropdown
                        .addOptions(options)
                        .setValue(this.plugin.settings[key] as string)
                        .onChange((value) => {
                            this.plugin.settings[key] = value
                            void this.plugin.saveSettings()
                            if(opts?.rebuildAfterChange){this.update()}
                            if(opts?.refreshAfterChange){this.plugin.refreshOpenViews()}
                        }))
                this.addResetButton(setting, key)
            },
        }
    }

    addResetButton(settingElement: Setting, settingKey: string){
        settingElement
            .addExtraButton((button) => button
                    .setIcon('reset')
                    .setTooltip(getLocale().common.resetToDefault)
                    .onClick(async () => {
                        this.plugin.settings[settingKey] = DEFAULT_SETTINGS[settingKey]
                        await this.plugin.saveSettings()
                        this.update()
                    }))
    }
}
