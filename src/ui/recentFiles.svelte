<script lang="ts">
	import { Menu, View, type TFile, getIcon } from "obsidian";
	import type { RecentFileManager, recentFile } from "src/recentFiles";
	import type { HomeTabSettings } from "src/settings";
	import FileDisplayItem from "./svelteComponents/fileDisplayItem.svelte";

    export let view: View
    export let recentFileList: recentFile[]
    export let pluginSettings: HomeTabSettings
    export let recentFileManager: RecentFileManager
    const app = view.leaf.app

    let selectedFile: TFile

    // Filter state
    let filterExpanded = false
    let filterQuery = ''
    let filterInputEl: HTMLInputElement

    $: filteredFileList = filterQuery.trim()
        ? recentFileList.filter(rf => {
            const query = filterQuery.trim().toLowerCase()
            const basename = rf.file.basename.toLowerCase()
            const extension = rf.file.extension.toLowerCase()
            return basename.includes(query) || extension === query
        })
        : recentFileList

    function toggleFilter() {
        filterExpanded = !filterExpanded
        if (filterExpanded) {
            // Focus the input after DOM update
            setTimeout(() => filterInputEl?.focus(), 50)
        } else {
            filterQuery = ''
        }
    }

    function handleFilterKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            filterExpanded = false
            filterQuery = ''
        }
    }

    function handleFilterBlur() {
        filterExpanded = false
        filterQuery = ''
    }

    let contextualMenu: Menu = new Menu()
            .addItem((item) => item
                .setTitle('Hide file')
                .setIcon('eye-off')
                .onClick(() => recentFileManager.removeRecentFile(selectedFile)))
            .setUseNativeMenu(app.vault.config.nativeMenus)
</script>

<div class="home-tab-recent-files-container">
    <div class="home-tab-recent-files-title">
        <span class="home-tab-recent-files-title-text">Recent files</span>
        <div class="home-tab-recent-files-filter" class:expanded={filterExpanded}>
            <input
                class="home-tab-recent-files-filter-input"
                type="text"
                placeholder="Filter..."
                bind:value={filterQuery}
                bind:this={filterInputEl}
                on:keydown={handleFilterKeydown}
                on:blur={handleFilterBlur}
                tabindex={filterExpanded ? 0 : -1}
            />
            <button
                class="home-tab-recent-files-filter-btn clickable-icon"
                on:click={toggleFilter}
                aria-label="Filter recent files"
            >
                {@html getIcon('search')?.outerHTML ?? ''}
            </button>
        </div>
    </div>
    <div class="home-tab-recent-files-wrapper">
        {#each filteredFileList as recentFile (recentFile.file.path)}
            <FileDisplayItem file={recentFile.file} {app} {pluginSettings} {contextualMenu}
            on:itemMenu={(e) => selectedFile = e.detail.file}/>
        {/each}
    </div>
</div>

<style>
    .home-tab-recent-files-container{
        width: 65%;
        display: flex;
        flex-direction: column;

        padding-top: 20px;
        margin: auto;
    }
    .home-tab-recent-files-title{
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-weight: 600;
        font-size: var(--font-ui-large);
        padding-bottom: 5px;
    }
    .home-tab-recent-files-title-text{
        white-space: nowrap;
    }
    .home-tab-recent-files-filter{
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .home-tab-recent-files-filter-btn{
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: none;
        background: none;
        color: var(--text-muted);
        cursor: pointer;
        border-radius: var(--radius-s);
        opacity: 1;
        transition: opacity 0.2s ease 0.15s; /* delay fade-in */
    }
    .home-tab-recent-files-filter.expanded .home-tab-recent-files-filter-btn{
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease; /* no delay on fade-out */
    }
    .home-tab-recent-files-filter-btn:hover{
        color: var(--text-normal);
        background-color: var(--background-modifier-hover);
    }
    .home-tab-recent-files-filter-btn :global(svg){
        width: 16px;
        height: 16px;
    }
    .home-tab-recent-files-filter-input{
        width: 0;
        min-width: 0;
        height: 24px;
        padding: 2px 0;
        font-size: var(--font-ui-small);
        border: 1px solid transparent;
        border-radius: var(--radius-s);
        background-color: transparent;
        color: var(--text-normal);
        outline: none;
        opacity: 0;
        transition: width 0.25s ease, padding 0.25s ease, opacity 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
    }
    .home-tab-recent-files-filter.expanded .home-tab-recent-files-filter-input{
        width: 160px;
        padding: 2px 8px;
        opacity: 1;
        border-color: var(--background-modifier-border);
        background-color: var(--background-modifier-form-field);
    }
    .home-tab-recent-files-filter-input:focus{
        border-color: var(--interactive-accent);
    }
    .home-tab-recent-files-wrapper{
        display: flex;
        /* min-width: 250px; */
        max-width: 900px;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        margin: auto;
    }

    @media(max-width: 600px){
        .home-tab-recent-files-container{
            width: 90%;
            padding-bottom: 75px;
        }
        .home-tab-recent-files-wrapper{
            display: grid;
            grid-template-columns: 1fr;
            gap: 2px;
            /* 取消宽屏居中相关设置 */
            justify-content: unset;
            align-items: unset;
        }
    }
</style>