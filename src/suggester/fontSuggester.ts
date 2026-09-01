import { AbstractInputSuggest, type App } from 'obsidian'
import type Fuse from 'fuse.js'
import { ArrayFuzzySearch } from "./fuzzySearch"

/**
 * System font suggester built on the official AbstractInputSuggest, which
 * handles popover positioning (including popout windows) out of the box.
 */
export default class fontSuggester extends AbstractInputSuggest<Fuse.FuseResult<string>>{
    private inputEl: HTMLInputElement
    private fontList: string[]
    private fuzzySearch: ArrayFuzzySearch
    private renderFont: boolean | undefined

    constructor(app: App, inputEl: HTMLInputElement, renderFont?: boolean){
        super(app, inputEl)
        this.inputEl = inputEl
        this.renderFont = renderFont

        void this.getInstalledFonts().then(fontList => {
            this.fontList = fontList
            this.fuzzySearch = new ArrayFuzzySearch(fontList)
        })
    }

    async getInstalledFonts(): Promise<string[]>{
        if(!this.fontList){
            try {
                const fontList = await import('font-list');
                this.fontList = await fontList.getFonts();
            } catch(e) {
                console.warn('Failed to get system fonts', e);
                this.fontList = [];
            }
        }
        return this.fontList
    }

    getSuggestions(query: string): Fuse.FuseResult<string>[] {
        // The font list may still be loading
        if (!this.fuzzySearch) return []
        // If the input is blank display all installed fonts
        if (!query){
            return this.fontList.map(font => ({
                item: font,
                refIndex: 0,
                score: 0,
            }))
        }
        return this.fuzzySearch.filteredSearch(query, 0.25, 15)
    }

    renderSuggestion(suggestion: Fuse.FuseResult<string>, el: HTMLElement): void {
        el.addClass('suggestion-item')
        const fontName = suggestion.item.replace(/"/g, ``)
        if (this.renderFont) {
            el.style.fontFamily = suggestion.item
        }
        el.setText(fontName)
    }

    selectSuggestion(suggestion: Fuse.FuseResult<string>): void {
        this.inputEl.value = suggestion.item.replace(/"/g, ``)
        this.inputEl.trigger("input")
        this.close()
    }
}
