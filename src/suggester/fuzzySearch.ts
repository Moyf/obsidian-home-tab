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
        // return this.fuse.search(query, limit ? {limit: limit} : undefined);

        const results = this.fuse.search(query, limit ? { limit } : undefined);

		let allScores: string[] = [];

        // 自定义排序：aliases > basename > title，且匹配位置越靠前越优先
        results.sort((a, b): number => {
            // 默认按分数
            // return (a.score ?? 0) - (b.score ?? 0);

			// 匹配数量（以0.3为准，3个为1分）
			const matchedCountWeight = 0.3;
            const getMatchedCount = (item: Fuse.FuseResult<any>): number => {
                if (!item.matches || item.matches.length === 0) return 0;
                return item.matches.length * matchedCountWeight;
            };

			const aMatchedCount = getMatchedCount(a);
			const bMatchedCount = getMatchedCount(b);

            // 匹配比例（完全匹配优先，其次前缀匹配，再其次包含匹配）
			// 权重：3
			const matchedRatioWeight = 3;
            const getBestRatio = (item: Fuse.FuseResult<any>): number => {
                if (!item.matches || item.matches.length === 0) return 0;
                // 取所有字段的最佳比例
                let best = 0;
                for (const m of item.matches) {
                    if (typeof m.value === 'string' && m.indices.length > 0) {
                        for (const [start, end] of m.indices) {
                            const matchLen = end - start + 1;
                            const totalLen = m.value.length;

							const matchedRatio = matchLen / totalLen;
							return matchedRatio * matchedRatioWeight;
							/*
                            // 完全匹配
                            if (matchLen === totalLen && start === 0) return matchedRatioWeight;
                            // 前缀匹配
                            if (start === 0) best = Math.max(best, matchedRatioWeight - 1);
                            // 只要包含
                            best = Math.max(best, matchedRatioWeight - 2);
                            */
                        }
                    }
                }
                return best;
            };

            const aRatio = getBestRatio(a);
            const bRatio = getBestRatio(b);
            
            // if (aRatio !== bRatio) return bRatio - aRatio; // 比例高的排前面

            // 字段优先级（越小越低！）
            const getFieldPriority = (matches: readonly Fuse.FuseResultMatch[] | undefined): {priority: number, source: string, value: string} => {
                if (!matches) return {priority: 3, source: '', value: ''};
                
                if (matches.some(m => m.key === 'aliases')) return {priority: 3, source: 'aliases', value: matches.find(m => m.key === 'aliases')?.value ?? ''};
                if (matches.some(m => m.key === 'basename')) return {priority: 3, source: 'basename', value: matches.find(m => m.key === 'basename')?.value ?? ''};
                if (matches.some(m => m.key === 'headings')) return {priority: 2, source: 'headings', value: matches.find(m => m.key === 'headings')?.value ?? ''};
                if (matches.some(m => m.key === 'title')) return {priority: 4, source: 'title', value: matches.find(m => m.key === 'title')?.value ?? ''};
                
                return {priority: 3, source: '', value: ''};
            };

            const aPriorityData = getFieldPriority(a.matches);
            const bPriorityData = getFieldPriority(b.matches);
            const aPriority = aPriorityData.priority;
            const bPriority = bPriorityData.priority;

			// 接下来以对应的 Data 为准，进行后面的计分（从结果中获取 priorityData 对应的那个字段）
			const aBaseText = aPriorityData.value;
			const bBaseText = bPriorityData.value;

            // 匹配位置优先
            // 匹配位置权重计算（越前面的权重越高，总分值2）
			const indexWeight = 2;
			const getMinIndex = (matches: readonly Fuse.FuseResultMatch[] | undefined): number => {
                if (!matches) return 0;
                let maxScore = 0;
                for (const m of matches) {
                    if (Array.isArray(m.indices) && m.indices.length > 0) {
                        const text = m.value as string;
                        const position = m.indices[0][0];
                        // 计算位置比例权重：(1 - position/length) * 3
                        const score = (1 - position / text.length) * indexWeight;
                        maxScore = Math.max(maxScore, score);
                    }
                }
                return maxScore;
            };

            const aIndex = getMinIndex(a.matches);
            const bIndex = getMinIndex(b.matches);

			const aFinalScore = aIndex + aPriority + aRatio + aMatchedCount;
			const bFinalScore = bIndex + bPriority + bRatio + bMatchedCount;


			const aName = (a.item as { basename?: string }).basename??"null";
			const bName = (b.item as { basename?: string }).basename??"null";
			if (!allScores.includes(aName)){
				allScores.push(aName);
				// console.log(a);
				console.log(`${aName} 总分：${aFinalScore} \n位置得分：${aIndex} | 匹配来源：${aPriorityData.source} 对应优先级分：${aPriority} | 比例得分：${aRatio}（占比${aRatio/matchedRatioWeight}） | 匹配数量得分：${aMatchedCount}`)
			}
			if (!allScores.includes(bName)){
				allScores.push(bName);
				console.log(`${bName} 总分：${bFinalScore} \n位置得分：${bIndex} | 匹配来源：${bPriorityData.source} 对应优先级分：${bPriority} | 比例得分：${bRatio}（占比${bRatio/matchedRatioWeight}） | 匹配数量得分：${bMatchedCount}`)
			}
			
			
			// console.log(`${a.item}: ${aFinalScore}`)
			// console.log(`${b.item}: ${bFinalScore}`)
			
			return bFinalScore - aFinalScore;

            // if (aIndex !== bIndex) return aIndex - bIndex;

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
