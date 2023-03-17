import { MarkdownView, Plugin, WorkspaceLeaf } from 'obsidian';
import { EmbeddedHomeTab, HomeTabView, VIEW_TYPE } from 'src/homeView';
import { HomeTabSettingTab, DEFAULT_SETTINGS, type HomeTabSettings } from './settings'
import { pluginSettingsStore, starredFiles } from './store'
import { RecentFileManager } from './recentFiles';
import { starredFileManager } from './starredFiles';

declare module 'obsidian'{
	interface App{
		internalPlugins: InternalPlugins
		dom: any
		isMobile: boolean
	}
	interface InternalPlugins{
		getPluginById: Function
		plugins: {
			starred: StarredPlugin
		}
	}
	interface StarredPlugin extends Plugin_2{
		instance: {
			items: StarredFile[]
			toggleFileStar: Function
		}
	}
	interface StarredFile{
		type: string,
		title: string,
		path: string
	}
	interface config{
		nativeMenus: boolean
	}
	interface Vault{
		config: config
	}
	interface Workspace{
		createLeafInTabGroup: Function
	}
	interface WorkspaceLeaf{
		rebuildView: Function
		parent: WorkspaceSplit
		activeTime: number
		app: App
	}
	interface WorkspaceSplit{
		children: WorkspaceLeaf[]
	}
	interface TFile{
		deleted: boolean
	}
}

export default class HomeTab extends Plugin {
	settings: HomeTabSettings;
	recentFileManager: RecentFileManager
	starredFileManager: starredFileManager
	activeEmbeddedHomeTabViews: EmbeddedHomeTab[]
	
	async onload() {
		console.log('Loading home-tab plugin')
		
		await this.loadSettings();
		this.addSettingTab(new HomeTabSettingTab(this.app, this))
		this.registerView(VIEW_TYPE, (leaf) => new HomeTabView(leaf, this));		

		// Replace new tabs with home tab view
		this.registerEvent(this.app.workspace.on('layout-change', () => this.activateView()))
		// Refocus search bar on leaf change
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf) => {if(leaf.view instanceof HomeTabView){leaf.view.searchBar.focusSearchbar()}}))

		pluginSettingsStore.set(this.settings) // Store the settings for the svelte components

		this.activeEmbeddedHomeTabViews = []

		this.recentFileManager = new RecentFileManager(app, this)
		this.recentFileManager.load()

		// Wait for all plugins to load before check if the starred plugin is enabled
		this.app.workspace.onLayoutReady(() => {
			if(this.app.internalPlugins.getPluginById('starred')){
				this.starredFileManager = new starredFileManager(app, this, starredFiles)
				this.starredFileManager.load()
			}

			this.registerMarkdownCodeBlockProcessor('search-bar', (source, el, ctx) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView)
				if(view){
					let embeddedHomeTab = new EmbeddedHomeTab(el, view, this, source)
					this.activeEmbeddedHomeTabViews.push(embeddedHomeTab)
					ctx.addChild(embeddedHomeTab)
				}
			})
		})

	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE)
		this.activeEmbeddedHomeTabViews.forEach(view => view.unload())
		this.recentFileManager.unload()
		this.starredFileManager.unload()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
		pluginSettingsStore.update(() => this.settings)
	}

	activateView() {
		const leaf = app.workspace.getMostRecentLeaf()
		if(leaf && leaf.getViewState().type === 'empty'){
			leaf.setViewState({
				type: VIEW_TYPE,
			})
		}
	}

	refreshOpenViews(){
		this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => leaf.rebuildView())
	}
}