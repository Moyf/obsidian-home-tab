import { normalizePath, Platform, TAbstractFile, TFile, View, debounce, type App } from 'obsidian'
import type Fuse from 'fuse.js'
import { DEFAULT_FUSE_OPTIONS, FileFuzzySearch, type SearchFile } from './fuzzySearch'
import type HomeTab from '../main'
import type HomeTabSearchBar from "src/homeTabSearchbar"
import { generateSearchFile,  getParentFolderFromPath,  getSearchFiles, getUnresolvedMarkdownFiles } from 'src/utils/getFilesUtils'
import { TextInputSuggester } from './suggester'
import { generateHotkeySuggestion } from 'src/utils/htmlUtils'
import { isValidExtension, type FileExtension, type FileType } from 'src/utils/getFileTypeUtils'
import { get } from 'svelte/store'
import HomeTabFileSuggestion from 'src/ui/svelteComponents/homeTabFileSuggestion.svelte'
import { isValidUrl } from 'src/utils/urlUtils'
import { MatchAnalyzer } from 'src/utils/matchAnalyzer'

declare module 'obsidian'{
    interface MetadataCache{
        onCleanCache: Function
    }
}

export default class HomeTabFileSuggester extends TextInputSuggester<Fuse.FuseResult<SearchFile>>{
    private files: SearchFile[]
    private fuzzySearch: FileFuzzySearch

    private view: View
    private plugin: HomeTab
    private searchBar: HomeTabSearchBar

    private activeFilter: FileType | FileExtension  | null
    private matchAnalyzer: MatchAnalyzer

    constructor(app: App, plugin: HomeTab, view: View, searchBar: HomeTabSearchBar) {
        super(app, get(searchBar.searchBarEl), get(searchBar.suggestionContainerEl), {
                // @ts-ignore
                containerClass: `home-tab-suggestion-container ${Platform.isPhone ? 'is-phone' : ''}`,
                additionalClasses: `${plugin.settings.selectionHighlight === 'accentColor' ? 'use-accent-color' : ''}`,
                additionalModalInfo: plugin.settings.showShortcuts ? generateHotkeySuggestion([
                    {hotkey: '↑↓', action: 'to navigate'},
                    {hotkey: '↵', action: 'to open'},
                    {hotkey: 'shift ↵', action: 'to create'},
                    {hotkey: 'ctrl ↵', action: 'to open in new tab'},
                    {hotkey: 'esc', action: 'to dismiss'},], 
                    'home-tab-hotkey-suggestions') : undefined
                }, plugin.settings.searchDelay)
        this.plugin = plugin
        this.view = view
        this.searchBar = searchBar
        this.matchAnalyzer = new MatchAnalyzer(plugin.settings)

        this.app.metadataCache.onCleanCache(() => {
            if (this.plugin.settings.markdownOnly) {
                // 获取所有文件
                const allFiles = getSearchFiles(this.plugin.settings.unresolvedLinks);
                
                // 先过滤出 markdown 文件
                let filteredFiles = this.filterSearchFileArray('markdown', allFiles);
                
                // 如果设置了额外的后缀名，添加这些文件
                if (this.plugin.settings.additionalExtensions) {
                    const additionalFiles = this.getAdditionalExtensionFiles(allFiles);
                    filteredFiles = [...filteredFiles, ...additionalFiles];
                }
                
                this.files = filteredFiles;
            } else {
                this.files = getSearchFiles(this.plugin.settings.unresolvedLinks);
            }
            
            this.fuzzySearch = new FileFuzzySearch(this.files, { 
                ...DEFAULT_FUSE_OPTIONS, 
                ignoreLocation: true, 
                // 完全禁用字段标准化权重，让单一最佳匹配主导
                fieldNormWeight: 0.5,  // 完全消除多字段匹配的累积效应
                // 超极化权重：basename 绝对优先
                keys: [
                    {name: 'basename', weight: 10.0},  // 文件名绝对权重
                    {name: 'aliases', weight: 8.0},    // 别名高权重  
                    ...(this.plugin.settings.searchTitle ? [{name: 'title', weight: 2.5}] : []),   // 标题中等权重
                    ...(this.plugin.settings.searchHeadings ? [{name: 'headings', weight: 1.0}] : [])  // 标题内容极低权重
                ] 
            })
        })

        // Open file in new tab
        this.scope.register(['Mod'], 'Enter', (e) => {
            e.preventDefault()
            this.useSelectedItem(this.suggester.getSelectedItem(), true)
        })
        // Create file
        this.scope.register(['Shift'], 'Enter', async(e) => {
            e.preventDefault()
            await this.handleFileCreation()
        })
        // Create file and open in new tab
        this.scope.register(['Shift', 'Mod'], 'Enter', async(e) => {
            e.preventDefault()
            await this.handleFileCreation(undefined, true)
        })

        this.view.registerEvent(this.app.vault.on('create', (file: TAbstractFile) => { if(file instanceof TFile){this.updateSearchfilesList(file)}}))
        this.view.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => { if(file instanceof TFile){this.updateSearchfilesList(file)}}))
        this.view.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => { if(file instanceof TFile){this.updateSearchfilesList(file, oldPath)}}))
        this.view.registerEvent(this.app.metadataCache.on('resolved', () => this.updateUnresolvedFiles()))
    }

    // 重写 close 方法来检查 hideOnBlur 设置
    close(): void {
        // 如果是通过 blur 事件触发的 close，检查设置
        // 通过检查当前焦点来判断是否是 blur 事件触发的
        if (document.activeElement !== this.inputEl) {
            // 当前元素失去焦点，检查 hideOnBlur 设置
            if (!(this.plugin.settings.hideOnBlur ?? true)) {
                // 如果设置为不隐藏，则不关闭
                return;
            }
        }
        
        // 调用父类的 close 方法
        super.close();
    }

    updateSearchBarContainerElState(isActive: boolean){
        this.inputEl.parentElement?.toggleClass('is-active', isActive)
    }

    onOpen(): void {
        this.updateSearchBarContainerElState(this.suggester.getSuggestions().length > 0 ? true : false)    
    }

    onClose(): void {
        this.updateSearchBarContainerElState(false)
    }

    filterSearchFileArray(filterKey: FileType | FileExtension, fileArray: SearchFile[]): SearchFile[]{
        const arrayToFilter = fileArray
        return arrayToFilter.filter(file => isValidExtension(filterKey) ? file.extension === filterKey : file.fileType === filterKey)
    }

    updateUnresolvedFiles(){
        const unresolvedFiles = getUnresolvedMarkdownFiles()
        let newFiles = false
        if(this.files){
            unresolvedFiles.forEach((unresolvedFile) => {
                if(!this.files.includes(unresolvedFile)){
                    this.files.push(unresolvedFile)
                    newFiles = true
                }
            })
            if(newFiles) this.fuzzySearch.updateSearchArray(this.files)
        }
    }

    updateSearchfilesList(file:TFile, oldPath?: string){
        this.app.metadataCache.onCleanCache(() => {
            if(oldPath){
                this.files.splice(this.files.findIndex((f) => f.path === oldPath),1)
                this.files.push(generateSearchFile(file))
            }
            if(file.deleted){
                this.files.splice(this.files.findIndex((f) => f.path === file.path),1)
    
                // if(isUnresolved({name: file.name, path: file.path, basename: file.basename, extension: file.extension})){
                //     this.files.push(generateMarkdownUnresolvedFile(file.path))
                // }
            }
            else{
                const fileIndex = this.files.findIndex((f) => f.path === file.path)
                if(fileIndex === -1){
                    this.files.push(generateSearchFile(file))
                }
                else if(this.files[fileIndex].isUnresolved){
                    this.files[fileIndex] = generateSearchFile(file)
                }
            }
            this.fuzzySearch.updateSearchArray(this.files)
        })
    }

    onNoSuggestion(): void {
        const input = this.inputEl.value.trim();
        
        // 如果是普通输入，保持原有的文件创建建议
        if(!this.activeFilter || this.activeFilter === 'markdown' || this.activeFilter === 'md'){
            if (!!input) {
                this.suggester.setSuggestions([{
                    item: {
                        name: `${input}.md`,
                        path: `${input}.md`,
                        basename: input,
                        isCreated: false,
                        fileType: 'markdown',
                        extension: 'md',
                    },
                    refIndex: 0,
                    score: 0,
                }]);
                this.open();
            }
            else{
                this.close();
            }
        }
        else{
            this.close();
        }
    }
    
    getSuggestions(inputStr: string): Fuse.FuseResult<SearchFile>[] {
        const query = inputStr.trim();

        // 先尝试搜索文件
        if(!query) return []
        
        // 重置分析器状态
        this.matchAnalyzer.resetForNewSearch();
        
        const results = this.fuzzySearch.rawSearch(query, this.plugin.settings.maxResults);
        
        // Debug 模式下输出单行格式的搜索结果汇总
        if (this.plugin.settings.debugMode) {
            console.clear();
            console.log(`🔍 SEARCH: "${query}" | Results: ${results.length}`);
            
            // 生成单行汇总
            const summary = results.map((result, index) => {
                const matches = result.matches?.map(m => `${m.key}="${m.value}"`).join(',') || 'no-matches';
                return `#${index+1}: "${result.item.basename}" | score=${result.score?.toExponential(2)} | matches=[${matches}]`;
            }).join('\n');
            
            console.log(summary);
            console.log('===================');
        }
        
        return results;
    }

    useSelectedItem(selectedItem: Fuse.FuseResult<SearchFile>, newTab?: boolean): void {
        // 使用智能匹配分析器分析匹配意图
        const query = this.inputEl.value.trim();
        const analysis = this.matchAnalyzer.analyzeMatch(selectedItem, query);
        const item = selectedItem.item;
        
        if (this.plugin.settings.debugMode) {
            console.log('[HomeTabSuggester] Selected item action:', {
                file: item.basename,
                query: query,
                action: analysis.shouldJumpToHeading ? 'Jump to heading' : 'Open file',
                heading: analysis.matchedHeading,
                newTab: newTab
            });
        }
        
        // 根据分析结果决定跳转行为
        if (analysis.shouldJumpToHeading && analysis.matchedHeading) {
            const link = `${item.path}#${analysis.matchedHeading}`;
            this.app.workspace.openLinkText(link, '', newTab ?? false);
            return;
        }
        // 处理 WebViewer URL
        if (selectedItem.item.isWebUrl) {
            const leaf = newTab 
                ? this.app.workspace.getLeaf('tab') 
                : this.app.workspace.getLeaf();

            leaf.setViewState({
                type: "webviewer",
                active: true,
                state: {
                    url: selectedItem.item.url
                }
            });
            return;
        }

        // 处理普通文件
        if(selectedItem.item.isCreated && selectedItem.item.file){
            this.openFile(selectedItem.item.file, newTab);
        }
        else{
            this.handleFileCreation(selectedItem.item, newTab);
        }
    }

    getDisplayElementProps(suggestion: Fuse.FuseResult<SearchFile>): {nameToDisplay: string, filePath?: string, matchedHeading?: string, matchedAlias?: string, matchedTitle?: string}{
        if (!this.inputEl || !(this.inputEl instanceof HTMLInputElement)) {
            return {
                nameToDisplay: suggestion.item.basename,
                filePath: undefined
            };
        }

        // 如果是 WebViewer URL
        if (suggestion.item.isWebUrl) {
            return {
                nameToDisplay: 'Open link: ' + suggestion.item.url,
                filePath: 'WebViewer'
            };
        }

        // 处理普通文件
        let nameToDisplay = suggestion.item.basename;
        let filePath: string | undefined = undefined;
        let matchedHeading: string | undefined = undefined;
        let matchedAlias: string | undefined = undefined;
        let matchedTitle: string | undefined = undefined;

        if(this.plugin.settings.showPath){
            filePath = suggestion.item.file && suggestion.item.file.parent 
                ? suggestion.item.file.parent.name 
                : getParentFolderFromPath(suggestion.item.path);
        }

        // 使用智能匹配分析器分析匹配意图
        if (suggestion.matches) {
            const query = this.inputEl.value.trim();
            const analysis = this.matchAnalyzer.analyzeMatch(suggestion, query);
            
            // Debug: 输出最终显示属性
            if (this.plugin.settings.debugMode) {
                const finalDisplay = `📋 DISPLAY: "${suggestion.item.basename}" → name="${analysis.displayInfo.showAlias ? analysis.displayInfo.matchedAlias : analysis.displayInfo.showTitle ? analysis.displayInfo.matchedTitle : suggestion.item.basename}" | showAlias=${analysis.displayInfo.showAlias} | showTitle=${analysis.displayInfo.showTitle} | showHeading=${analysis.displayInfo.showHeading}`
                console.log(finalDisplay);
            }
            
            // 根据分析结果设置显示信息
            if (analysis.displayInfo.showHeading && analysis.matchedHeading) {
                matchedHeading = analysis.matchedHeading;
                nameToDisplay = suggestion.item.basename;
                if (this.plugin.settings.debugMode) {
                    console.log(`📝 SET HEADING: nameToDisplay="${nameToDisplay}" | matchedHeading="${matchedHeading}"`);
                }
            } else if (analysis.displayInfo.showAlias && analysis.displayInfo.matchedAlias) {
                matchedAlias = analysis.displayInfo.matchedAlias;
                nameToDisplay = analysis.displayInfo.matchedAlias;
                if (this.plugin.settings.debugMode) {
                    console.log(`📝 SET ALIAS: nameToDisplay="${nameToDisplay}" | matchedAlias="${matchedAlias}"`);
                }
            } else if (analysis.displayInfo.showTitle && analysis.displayInfo.matchedTitle) {
                matchedTitle = analysis.displayInfo.matchedTitle;
                nameToDisplay = analysis.displayInfo.matchedTitle;
                if (this.plugin.settings.debugMode) {
                    console.log(`📝 SET TITLE: nameToDisplay="${nameToDisplay}" | matchedTitle="${matchedTitle}"`);
                }
            } else {
                nameToDisplay = this.fuzzySearch.getBestMatch(suggestion, this.inputEl.value);
                if (this.plugin.settings.debugMode) {
                    console.log(`📝 SET FALLBACK: nameToDisplay="${nameToDisplay}" | getBestMatch result`);
                }
            }
            
            return {
                nameToDisplay: nameToDisplay,
                filePath: filePath,
                matchedHeading: matchedHeading,
                matchedAlias: matchedAlias,
                matchedTitle: matchedTitle
            };
        }

        nameToDisplay = this.fuzzySearch.getBestMatch(suggestion, this.inputEl.value);
        
        return {
            nameToDisplay: nameToDisplay,
            filePath: filePath,
            matchedHeading: matchedHeading,
            matchedAlias: matchedAlias,
            matchedTitle: matchedTitle
        };
    }

    getDisplayElementComponentType(): typeof HomeTabFileSuggestion{
        return HomeTabFileSuggestion
    }

    async handleFileCreation(selectedFile?: SearchFile, newTab?: boolean): Promise<void>{
        let newFile: TFile
        
        if(selectedFile?.isUnresolved){
            const folderPath = selectedFile.path.replace(selectedFile.name, '')
            if(!await this.app.vault.adapter.exists(folderPath)){
                await this.app.vault.createFolder(folderPath)
            }
            newFile = await this.app.vault.create(selectedFile.path, '')
        }
        else{
            const input = this.inputEl.value;
            // If a file with the same filename exists open it
            // Mimics the behaviour of the default quick switcher
            const files = this.files.filter(file => file.fileType === 'markdown')
            if(files.map(file => file.basename).includes(input)){
                const fileToOpen = files.find(f => f.basename === input)?.file
                if(fileToOpen && fileToOpen instanceof TFile){
                    this.openFile(fileToOpen, newTab)
                }
            }
            newFile = await this.app.vault.create(normalizePath(`${this.app.fileManager.getNewFileParent('').path}/${input}.md`), '')
        }
        
        
        this.openFile(newFile, newTab)
    }

    openFile(file: TFile, newTab?: boolean): void{
        // TODO Check if file is already open
        if(newTab){
            this.app.workspace.createLeafInTabGroup().openFile(file)
            // this.inputEl.value = ''
        }
        else{
            this.view.leaf.openFile(file);
        }
    }

    /**
     * 从文件数组中过滤出具有额外后缀名的文件
     * @param files 要过滤的文件数组
     * @returns 符合额外后缀名的文件数组
     */
    getAdditionalExtensionFiles(files: SearchFile[]): SearchFile[] {
        // 如果没有设置额外后缀名，返回空数组
        if (!this.plugin.settings.additionalExtensions) {
            return [];
        }
        
        // 解析额外后缀名，去除空格并转为小写
        const extensions = this.plugin.settings.additionalExtensions
            .split(',')
            .map(ext => ext.trim().toLowerCase())
            .filter(ext => ext.length > 0);
            
        // 如果没有有效的后缀名，返回空数组
        if (extensions.length === 0) {
            return [];
        }
        
        // 过滤出符合额外后缀名的文件
        return files.filter(file => {
            if (!file.extension) return false;
            return extensions.includes(file.extension.toLowerCase());
        });
    }
    
    setFileFilter(filterKey: FileType | FileExtension): void{
        this.activeFilter = filterKey
        
        this.app.metadataCache.onCleanCache(() => {
            let filesToFilter = this.plugin.settings.markdownOnly ? getSearchFiles(this.plugin.settings.unresolvedLinks) : this.files;
            
            // 如果启用了 markdownOnly 并且有额外后缀名，需要特殊处理
            if (this.plugin.settings.markdownOnly && this.plugin.settings.additionalExtensions && filterKey === 'markdown') {
                let filteredFiles = this.filterSearchFileArray(filterKey, filesToFilter);
                const additionalFiles = this.getAdditionalExtensionFiles(filesToFilter);
                filteredFiles = [...filteredFiles, ...additionalFiles];
                this.fuzzySearch.updateSearchArray(filteredFiles);
            } else {
                this.fuzzySearch.updateSearchArray(this.filterSearchFileArray(filterKey, filesToFilter));
            }
        })
        
        this.suggester.setSuggestions([]) // Reset search suggestions
        this.close()
    }

    destroy(): void {
        // 调用父类的 destroy 方法
        super.destroy()
    }
}
