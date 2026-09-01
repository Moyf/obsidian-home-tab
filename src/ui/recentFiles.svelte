<script lang="ts">
	import { Menu, View, type TFile, getIcon } from "obsidian";
	import type { RecentFileManager, recentFile } from "src/recentFiles";
	import type { HomeTabSettings } from "src/settings";
	import type HomeTabSearchBar from "src/homeTabSearchbar";
	import { recentFilterFocusRequest, recentListFocusRequest } from "src/store";
	import { get } from "svelte/store";
	import FileDisplayItem from "./svelteComponents/fileDisplayItem.svelte";

    export let view: View
    export let recentFileList: recentFile[]
    export let pluginSettings: HomeTabSettings
    export let recentFileManager: RecentFileManager
    export let HomeTabSearchBar: HomeTabSearchBar
    const app = view.leaf.app

    let selectedFile: TFile

    // Filter state
    let filterExpanded = false
    let filterQuery = ''
    let filterInputEl: HTMLInputElement
    let listWrapperEl: HTMLElement
    let selectedFileIndex = -1 // -1 = no keyboard selection

    $: filteredFileList = filterQuery.trim()
        ? recentFileList.filter(rf => {
            const query = filterQuery.trim().toLowerCase()
            const basename = rf.file.basename.toLowerCase()
            const extension = rf.file.extension.toLowerCase()
            return basename.includes(query) || extension === query
        })
        : recentFileList

    // Reset the keyboard selection whenever the filter text changes
    $: filterQuery, selectedFileIndex = -1

    function toggleFilter() {
        filterExpanded = !filterExpanded
        if (filterExpanded) {
            // Focus the input after DOM update
            setTimeout(() => filterInputEl?.focus(), 50)
        } else {
            collapseFilter()
        }
    }

    function expandAndFocusFilter() {
        filterExpanded = true
        // Focus the input after DOM update
        setTimeout(() => filterInputEl?.focus(), 50)
    }

    function collapseFilter() {
        filterExpanded = false
        filterQuery = ''
        selectedFileIndex = -1
    }

    // Expand and focus the filter when requested from the search bar (Tab navigation).
    // Baseline against the current store value so a freshly mounted component
    // (new tab) doesn't replay stale requests and steal the focus from the search bar.
    let lastSeenFocusRequest = get(recentFilterFocusRequest)
    $: if ($recentFilterFocusRequest > lastSeenFocusRequest) {
        lastSeenFocusRequest = $recentFilterFocusRequest
        expandAndFocusFilter()
    }

    // Focus the first list item when requested from the search bar (Shift+Tab reverse navigation)
    let lastSeenListFocusRequest = get(recentListFocusRequest)
    $: if ($recentListFocusRequest > lastSeenListFocusRequest) {
        lastSeenListFocusRequest = $recentListFocusRequest
        focusFirstListItem()
    }

    function focusFirstListItem(): void {
        if (filteredFileList.length === 0) return
        selectedFileIndex = 0
        setTimeout(() => listWrapperEl?.focus(), 0)
    }

    function openFile(file: TFile): void {
        const leaf = app.workspace.getLeaf(false)
        leaf.openFile(file)
    }

    function scrollSelectedItemIntoView(): void {
        const items = listWrapperEl?.querySelectorAll('.home-tab-file-item')
        items?.[selectedFileIndex]?.scrollIntoView({ block: 'nearest' })
    }

    /**
     * Grid-aware vertical navigation: the list is a flex-wrap layout, so rows
     * wrap depending on the container width. Moving up/down keeps the current
     * column by jumping to the item whose horizontal center is the closest one
     * in the target row (no wrap-around at the first/last row).
     */
    function moveSelectionVertically(delta: 1 | -1): void {
        const items = Array.from(listWrapperEl?.querySelectorAll<HTMLElement>('.home-tab-file-item') ?? [])
        const rects = items.map(el => el.getBoundingClientRect())
        const current = rects[selectedFileIndex]
        if (!current) return

        // Group the items into visual rows by their vertical center
        const rowCenters: number[] = []
        const rows: number[][] = []
        rects.forEach((rect, i) => {
            const cy = rect.top + rect.height / 2
            const rowIndex = rowCenters.findIndex(center => Math.abs(center - cy) < rect.height / 2)
            if (rowIndex === -1) {
                rowCenters.push(cy)
                rows.push([i])
            } else {
                rows[rowIndex].push(i)
            }
        })

        const currentCy = current.top + current.height / 2
        const currentRowIndex = rowCenters.findIndex(center => Math.abs(center - currentCy) < current.height / 2)
        const targetRowIndex = currentRowIndex + delta
        if (currentRowIndex === -1 || targetRowIndex < 0 || targetRowIndex >= rows.length) return

        // In the target row, pick the item closest to the current column
        const currentCx = current.left + current.width / 2
        let best = rows[targetRowIndex][0]
        let bestDistance = Infinity
        for (const i of rows[targetRowIndex]) {
            const cx = rects[i].left + rects[i].width / 2
            const distance = Math.abs(cx - currentCx)
            if (distance < bestDistance) {
                bestDistance = distance
                best = i
            }
        }
        selectedFileIndex = best
        scrollSelectedItemIntoView()
    }

    function moveSelectionHorizontally(delta: 1 | -1): void {
        selectedFileIndex = (selectedFileIndex + delta + filteredFileList.length) % filteredFileList.length
        scrollSelectedItemIntoView()
    }

    function handleFilterKeydown(e: KeyboardEvent) {
        if (e.key === 'Tab') {
            e.preventDefault()
            // Shift+Tab (reverse loop): back to the search bar
            if (e.shiftKey) {
                HomeTabSearchBar?.focusSearchbar()
                return
            }
            // Tab (forward loop): enter the list navigation on the first item;
            // fall back to the search bar when there is nothing to select
            if (filteredFileList.length === 0) {
                HomeTabSearchBar?.focusSearchbar()
                return
            }
            focusFirstListItem()
            return
        }
        if (e.key === 'Escape') {
            collapseFilter()
        }
    }

    function handleListKeydown(e: KeyboardEvent) {
        if (filteredFileList.length === 0) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            moveSelectionVertically(1)
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault()
            moveSelectionVertically(-1)
        }
        else if (e.key === 'ArrowRight') {
            e.preventDefault()
            moveSelectionHorizontally(1)
        }
        else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            moveSelectionHorizontally(-1)
        }
        else if (e.key === 'Enter') {
            e.preventDefault()
            const entry = filteredFileList[selectedFileIndex]
            if (entry) {
                openFile(entry.file)
                collapseFilter()
            }
        }
        else if (e.key === 'Escape') {
            e.preventDefault()
            selectedFileIndex = -1
            if (filterExpanded) {
                setTimeout(() => filterInputEl?.focus(), 0)
            } else {
                // Filter is not open (e.g. entered the list via Shift+Tab): go back to the search bar
                HomeTabSearchBar?.focusSearchbar()
            }
        }
        else if (e.key === 'Tab') {
            e.preventDefault()
            selectedFileIndex = -1
            if (e.shiftKey) {
                // Shift+Tab (reverse loop): back to the filter
                expandAndFocusFilter()
            } else {
                // Tab (forward loop): back to the search bar
                HomeTabSearchBar?.focusSearchbar()
            }
        }
    }

    // Keep the filter open when the focus moves between the filter and the list
    function shouldKeepFilterOpen(e: FocusEvent): boolean {
        const related = e.relatedTarget
        if (!(related instanceof Node)) return false
        return related === filterInputEl || (listWrapperEl?.contains(related) ?? false)
    }

    function handleFilterBlur(e: FocusEvent) {
        if (shouldKeepFilterOpen(e)) return
        collapseFilter()
    }

    function handleListBlur(e: FocusEvent) {
        if (shouldKeepFilterOpen(e)) return
        collapseFilter()
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
    <div class="home-tab-recent-files-wrapper"
        bind:this={listWrapperEl}
        tabindex="-1"
        on:keydown={handleListKeydown}
        on:blur={handleListBlur}
    >
        {#each filteredFileList as recentFile (recentFile.file.path)}
            <FileDisplayItem file={recentFile.file} {app} {pluginSettings} {contextualMenu}
            selected={filteredFileList.indexOf(recentFile) === selectedFileIndex}
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
        transition: width 0.25s ease, padding 0.25s ease, margin 0.25s ease, opacity 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
    }
    .home-tab-recent-files-filter.expanded .home-tab-recent-files-filter-input{
        width: 160px;
        margin-left: 6px;
        padding: 2px 8px;
        opacity: 1;
        border-color: var(--background-modifier-border);
        background-color: var(--background-modifier-form-field);
    }
    /* Keep the focused background identical to the search bar (Obsidian would otherwise darken it on focus) */
    .home-tab-recent-files-filter-input:focus{
        border-color: var(--interactive-accent);
        background-color: var(--background-modifier-form-field);
    }
    .home-tab-recent-files-wrapper{
        display: flex;
        /* min-width: 250px; */
        max-width: 900px;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        margin: auto;
        outline: none;
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