import Fuse from "fuse.js";
import type { TFile } from "obsidian";
import { getImageFiles, getMarkdownSearchFiles} from "src/utils/getFilesUtils";
import type { FileType } from "src/utils/getFileTypeUtils"
import type { SurfingItem } from "./surfingSuggester";

export const DEFAULT_FUSE_OPTIONS: Fuse.IFuseOptions<any> = {
    includeScore : true,
    includeMatches : true,
    findAllMatches : true,
    fieldNormWeight : 1.35,
    threshold : 0.2,
    distance: 125,
    useExtendedSearch : true,
}

export interface MarkdownSearchFile{
	name: string
	basename: string
	path: string
	aliases?: string[]
    isCreated: boolean
    file?: TFile
}

export interface SearchFile{
    name: string
    basename: string
    path: string
    aliases?: string[]
    title?: string
    headings?: string[]
    isCreated: boolean
    isUnresolved?: boolean
    file?: TFile
    extension?: string
    fileType?: FileType
    isWebUrl?: boolean
    url?: string
}

class fuzzySearch<T>{
    private fuse: Fuse<T>

    constructor(searchArray: T[], searchOptions: Fuse.IFuseOptions<T> = DEFAULT_FUSE_OPTIONS){
        this.fuse = new Fuse(searchArray, searchOptions)
    }

    rawSearch(query: string, limit?: number): Fuse.FuseResult<T>[]{
        const results = this.fuse.search(query, limit ? { limit } : undefined);

        // 智能排序：优先考虑完全匹配和高质量匹配
        results.sort((a, b): number => {
            const aScore = a.score ?? 1;
            const bScore = b.score ?? 1;
            
            // 基于匹配占比的质量评估（占比比位置更重要）
            const getMatchQuality = (result: typeof a) => {
                if (!result.matches || !result.item) return { ratio: 0, priority: 999, isExact: false };
                
                const queryLower = query.toLowerCase();
                let bestRatio = 0;
                let bestPriority = 999;
                let isExact = false;
                
                // 检查 basename 匹配
                const basenameMatch = result.matches.find(m => m.key === 'basename');
                if (basenameMatch && basenameMatch.value) {
                    const basename = basenameMatch.value.toString().toLowerCase();
                    
                    // 完全匹配
                    if (basename === queryLower) {
                        return { ratio: 1.0, priority: 1, isExact: true };
                    }
                    
                    // 计算匹配占比（不考虑位置，只看占比）
                    const ratio = queryLower.length / basename.length;
                    if (ratio > bestRatio) {
                        bestRatio = ratio;
                        bestPriority = 10; // basename 基础优先级
                    }
                }
                
                // 检查所有别名匹配（基于占比）
                const aliasMatches = result.matches.filter(m => m.key === 'aliases');
                for (const aliasMatch of aliasMatches) {
                    if (aliasMatch.value) {
                        const alias = aliasMatch.value.toString().toLowerCase();
                        
                        // 完全匹配
                        if (alias === queryLower) {
                            return { ratio: 1.0, priority: 1, isExact: true }; // 完全匹配最高优先级
                        }
                        
                        // 计算别名匹配占比
                        const ratio = queryLower.length / alias.length;
                        if (ratio > bestRatio) {
                            bestRatio = ratio;
                            bestPriority = 20; // 别名优先级稍低于 basename
                        }
                    }
                }
                
                // 检查 title 和 headings 匹配（更低优先级）
                const titleMatch = result.matches.find(m => m.key === 'title');
                if (titleMatch && titleMatch.value) {
                    const title = titleMatch.value.toString().toLowerCase();
                    if (title === queryLower) {
                        return { ratio: 1.0, priority: 1, isExact: true };
                    }
                    const ratio = queryLower.length / title.length;
                    if (ratio > bestRatio) {
                        bestRatio = ratio;
                        bestPriority = 30; // title 优先级更低
                    }
                }
                
                return { ratio: bestRatio, priority: bestPriority, isExact: isExact };
            };
            
            const aQuality = getMatchQuality(a);
            const bQuality = getMatchQuality(b);
            
            // 1. 完全匹配优先
            if (aQuality.isExact !== bQuality.isExact) {
                return aQuality.isExact ? -1 : 1;
            }
            
            // 2. 按匹配占比排序（占比越高越好）
            const ratioDiff = bQuality.ratio - aQuality.ratio;
            if (Math.abs(ratioDiff) > 0.01) { // 占比差异超过1%
                return ratioDiff;
            }
            
            // 3. 占比相近时，按字段类型优先级排序
            if (aQuality.priority !== bQuality.priority) {
                return aQuality.priority - bQuality.priority;
            }
            
            // 4. 最后按Fuse.js分数排序
            return aScore - bScore;
        });

        return results;
    }

    filteredSearch(querry: string, scoreThreshold: number = 0.25, maxResults: number = 5){
        return this.rawSearch(querry, maxResults).filter(item => item.score ? item.score < scoreThreshold : true)
    }

    updateSearchArray(newSearchArray: T[]){
        this.fuse.setCollection(newSearchArray)
    }
}

export class ArrayFuzzySearch extends fuzzySearch<string>{
    constructor(searchArray: string[], searchOptions?: Fuse.IFuseOptions<string>){
        super(searchArray, searchOptions)
    }
}

/**
 * @description Search created markdown files by basename and aliases.
 */
export class MarkdownFileFuzzySearch extends fuzzySearch<MarkdownSearchFile>{
    constructor(fileList?: MarkdownSearchFile[], searchOptions?: Fuse.IFuseOptions<MarkdownSearchFile>){
        const searchArray = fileList ?? getMarkdownSearchFiles()
        super(searchArray, searchOptions)
    }

    // Return the best match between the filename and the aliases
    getBestMatch(searchResultElement: Fuse.FuseResult<MarkdownSearchFile>, querry: string): string{
        const searchFile = searchResultElement.item
        if (!searchFile.aliases){
            return searchFile.basename
        }

        const searchArray: string[] = []
        searchArray.push(searchFile.basename)
        searchFile.aliases.forEach((alias) => searchArray.push(alias))

        const fuzzySearch = new ArrayFuzzySearch(searchArray)
        const bestMatch = fuzzySearch.rawSearch(querry, 1)[0]
        
        if(!bestMatch){
            return searchFile.basename
        }

        return bestMatch.item
    }
}

export class FileFuzzySearch extends fuzzySearch<SearchFile>{
    constructor(fileList: SearchFile[], searchOptions?: Fuse.IFuseOptions<SearchFile>){
        const searchArray = fileList
        super(searchArray, searchOptions)
    }

    /**
     * @return Best match between basename and aliases
     */
    getBestMatch(searchResultElement: Fuse.FuseResult<SearchFile>, querry: string): string{
        const searchFile = searchResultElement.item
        // if(searchFile.fileType != 'markdown') return searchFile.name
        
        // Check if the match is from headings
        if (searchResultElement.matches?.some(match => match.key === 'headings')) {
            // Find all heading matches and sort by score
            const headingMatches = searchResultElement.matches
                .filter(match => match.key === 'headings')
                .sort((a, b) => {
                    const scoreA = a.indices[0][0] || 0
                    const scoreB = b.indices[0][0] || 0
                    return scoreA - scoreB
                })

            // Get the best heading match
            const bestHeadingMatch = headingMatches[0]
            if (bestHeadingMatch && bestHeadingMatch.value) {
                return searchFile.basename
            }
        }

        if (!searchFile.aliases) return searchFile.basename

        const searchArray: string[] = []
        searchArray.push(searchFile.basename)
        searchFile.aliases.forEach((alias) => searchArray.push(alias))

        const fuzzySearch = new ArrayFuzzySearch(searchArray)
        const bestMatch = fuzzySearch.rawSearch(querry, 1)[0]
        
        return bestMatch ? bestMatch.item : searchFile.basename
    }

}

/**
 * @description Search image file.
 * @param imageList Optional list of TFile, if not given the search will be in the entire vault.
 */
export class ImageFileFuzzySearch extends fuzzySearch<TFile>{
    constructor(imageList?: TFile[], searchOptions?: Fuse.IFuseOptions<TFile>){
        const searchArray = imageList ?? getImageFiles()
        super(searchArray, searchOptions)
    }
}

export class SurfingItemFuzzySearch extends fuzzySearch<SurfingItem>{
    constructor(surfingItems: SurfingItem[], searchOptions?: Fuse.IFuseOptions<SurfingItem>){
        super(surfingItems, searchOptions)
    }
}
