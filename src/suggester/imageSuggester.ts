import { AbstractInputSuggest, TFile, type App } from 'obsidian'
import type Fuse from "fuse.js";
import { DEFAULT_FUSE_OPTIONS, ImageFileFuzzySearch } from "./fuzzySearch";

/**
 * Image file suggester built on the official AbstractInputSuggest, which
 * handles popover positioning (including popout windows) out of the box.
 */
export default class ImageFileSuggester extends AbstractInputSuggest<Fuse.FuseResult<TFile>>{
    private inputEl: HTMLInputElement
    private fuzzySearch: ImageFileFuzzySearch

    constructor(app: App, inputEl: HTMLInputElement){
        super(app, inputEl)
        this.inputEl = inputEl
        this.fuzzySearch = new ImageFileFuzzySearch(app, undefined, {...DEFAULT_FUSE_OPTIONS, ignoreLocation: true, keys: ['name']})
    }

    getSuggestions(query: string): Fuse.FuseResult<TFile>[] {
        return this.fuzzySearch.filteredSearch(query, 0.25, 15)
    }

    renderSuggestion(suggestion: Fuse.FuseResult<TFile>, el: HTMLElement): void {
        el.addClass('suggestion-item')
        el.setText(suggestion.item.name)
    }

    selectSuggestion(suggestion: Fuse.FuseResult<TFile>): void {
        this.inputEl.value = suggestion.item.path
        this.inputEl.trigger("input")
        this.close()
    }
}
