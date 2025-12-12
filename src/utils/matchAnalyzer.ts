import type Fuse from 'fuse.js'
import type { SearchFile } from '../suggester/fuzzySearch'
import type { HomeTabSettings } from '../settings'

// 匹配意图优先级 (数值越小优先级越高)
export enum MatchIntent {
    EXACT_FILE = 1,        // 精确文件匹配 (basename完全匹配)
    FILE_ALIAS = 2,        // 文件别名匹配  
    FILE_PARTIAL = 3,      // 文件名部分匹配
    TITLE_MATCH = 4,       // 文档标题匹配
    HEADING_CONTENT = 5    // 标题内容匹配
}

export interface MatchAnalysis {
    intent: MatchIntent
    confidence: number     // 0-1 之间的置信度
    shouldJumpToHeading: boolean
    matchedHeading?: string
    displayInfo: {
        showHeading: boolean
        showAlias: boolean
        showTitle: boolean
        highlightType: 'file' | 'heading' | 'alias' | 'title'
        primaryMatch: string
        matchedAlias?: string
        matchedTitle?: string
    }
}

export class MatchAnalyzer {
    private hasAnalyzed = false;
    
    constructor(private settings: HomeTabSettings) {}
    
    /**
     * 重置分析器状态（每次新搜索时调用）
     */
    resetForNewSearch() {
        this.hasAnalyzed = false;
        if (this.settings.debugMode) {
            console.log('[MatchAnalyzer] 🔄 RESET for new search');
        }
    }
    
    private debug(...args: any[]) {
        if (this.settings.debugMode) {
            console.log('[MatchAnalyzer]', ...args)
        }
    }

    /**
     * 分析搜索结果的匹配意图和质量
     */
    analyzeMatch(
        suggestion: Fuse.FuseResult<SearchFile>, 
        query: string
    ): MatchAnalysis {
        const matches = suggestion.matches || []
        const item = suggestion.item
        
        // Debug: 检查是否是第一次分析
        const isFirstAnalysis = !this.hasAnalyzed
        if (!this.hasAnalyzed) {
            this.hasAnalyzed = true
            this.debug(`🚀 FIRST ANALYSIS SESSION`)
        }
        
        this.debug(`🔎 ANALYZING: "${query}" → "${item.basename}" | Path: ${item.path} | First=${isFirstAnalysis}`)
        
        // 分析各种匹配类型
        const basenameMatch = matches.find(m => m.key === 'basename')
        const aliasMatch = matches.find(m => m.key === 'aliases')  
        const titleMatch = matches.find(m => m.key === 'title')
        const headingMatch = matches.find(m => m.key === 'headings')

        const matchTypes = [
            basenameMatch && 'basename',
            aliasMatch && 'alias', 
            titleMatch && 'title',
            headingMatch && 'heading'
        ].filter(Boolean).join(', ')

        // 计算匹配质量和意图
        const analysis = this.calculateMatchIntent(
            query, matches, basenameMatch, aliasMatch, titleMatch, headingMatch, item
        )

        // 决定跳转行为
        analysis.shouldJumpToHeading = this.shouldJumpToHeading(analysis, query)
        
        // 设置显示信息
        analysis.displayInfo = this.getDisplayInfo(analysis, basenameMatch, headingMatch)

        const intentName = {
            1: 'EXACT_FILE',
            2: 'FILE_ALIAS', 
            3: 'FILE_PARTIAL',
            4: 'TITLE_MATCH',
            5: 'HEADING_CONTENT'
        }[analysis.intent] || 'UNKNOWN'
        
        const action = analysis.shouldJumpToHeading ? `Jump→${analysis.matchedHeading}` : 'Open'
        const displayAlias = analysis.displayInfo.showAlias ? `alias="${analysis.displayInfo.matchedAlias}"` : 'no-alias'
        const displayTitle = analysis.displayInfo.showTitle ? `title="${analysis.displayInfo.matchedTitle}"` : 'no-title'
        
        this.debug(`🎯 RESULT: "${query}" → "${item.basename}" | ${matchTypes} | ${intentName}(${(analysis.confidence * 100).toFixed(1)}%) | ${action} | ${displayAlias} | ${displayTitle}`)
        
        return analysis
    }

    /**
     * 计算匹配意图和置信度
     */
    private calculateMatchIntent(
        query: string,
        matches: readonly Fuse.FuseResultMatch[],
        basenameMatch?: Fuse.FuseResultMatch,
        aliasMatch?: Fuse.FuseResultMatch, 
        titleMatch?: Fuse.FuseResultMatch,
        headingMatch?: Fuse.FuseResultMatch,
        item?: SearchFile
    ): MatchAnalysis {
        const normalizedQuery = query.toLowerCase().trim()
        
        // 检查精确文件名匹配
        if (basenameMatch && item?.basename) {
            const exactMatch = item.basename.toLowerCase() === normalizedQuery
            const confidence = this.calculateMatchConfidence(basenameMatch, normalizedQuery)
            
            this.debug(`📁 Basename: "${item.basename}" | exact=${exactMatch} | conf=${(confidence*100).toFixed(1)}%`)
            
            if (exactMatch) {
                return {
                    intent: MatchIntent.EXACT_FILE,
                    confidence: 1.0,
                    shouldJumpToHeading: false,
                    displayInfo: {
                        showHeading: false,
                        showAlias: false,
                        showTitle: false,
                        highlightType: 'file',
                        primaryMatch: item.basename
                    }
                }
            }
            
            // 任何文件名匹配都应该优先于标题匹配
            return {
                intent: MatchIntent.FILE_PARTIAL,
                confidence,
                shouldJumpToHeading: false,
                displayInfo: {
                    showHeading: false,
                    showAlias: false,
                    showTitle: false,
                    highlightType: 'file', 
                    primaryMatch: item.basename
                }
            }
        }

        // 检查别名匹配 - 找到最佳匹配的别名
        const aliasMatches = matches.filter(m => m.key === 'aliases')
        if (aliasMatches.length > 0) {
            let bestAlias = null
            let bestConfidence = 0
            let isExactMatch = false
            
            // 找到置信度最高的别名匹配
            for (const match of aliasMatches) {
                if (match.value && typeof match.value === 'string') {
                    const exactMatch = match.value.toLowerCase() === normalizedQuery
                    const confidence = this.calculateMatchConfidence(match, normalizedQuery)
                    
                    this.debug(`🔍 Checking alias: "${match.value}" | exact=${exactMatch} | conf=${(confidence*100).toFixed(1)}%`)
                    
                    if (exactMatch || confidence > bestConfidence) {
                        bestAlias = match.value
                        bestConfidence = confidence
                        isExactMatch = exactMatch
                        this.debug(`✅ New best alias: "${bestAlias}" | exact=${isExactMatch} | conf=${(bestConfidence*100).toFixed(1)}%`)
                        if (exactMatch) break; // 找到完全匹配就停止
                    }
                }
            }
            
            if (bestAlias) {
                this.debug(`🏷️ Alias: "${bestAlias}" | exact=${isExactMatch} | conf=${(bestConfidence*100).toFixed(1)}%`)
                
                // 任何别名匹配都应该优先于标题匹配
                return {
                    intent: MatchIntent.FILE_ALIAS,
                    confidence: isExactMatch ? 1.0 : bestConfidence,
                    shouldJumpToHeading: false,
                    displayInfo: {
                        showHeading: false,
                        showAlias: true,
                        showTitle: false,
                        highlightType: 'alias',
                        primaryMatch: bestAlias,
                        matchedAlias: bestAlias
                    }
                }
            }
        }

        // 检查标题匹配
        if (titleMatch && typeof titleMatch.value === 'string') {
            const confidence = this.calculateMatchConfidence(titleMatch, normalizedQuery)
            if (confidence > 0.6) {
                return {
                    intent: MatchIntent.TITLE_MATCH,
                    confidence,
                    shouldJumpToHeading: false,
                    displayInfo: {
                        showHeading: false,
                        showAlias: false,
                        showTitle: true,
                        highlightType: 'title',
                        primaryMatch: titleMatch.value,
                        matchedTitle: titleMatch.value
                    }
                }
            }
        }

        // 检查标题内容匹配
        if (headingMatch && typeof headingMatch.value === 'string') {
            const confidence = this.calculateMatchConfidence(headingMatch, normalizedQuery)
            return {
                intent: MatchIntent.HEADING_CONTENT,
                confidence,
                shouldJumpToHeading: false, // 稍后根据策略决定
                matchedHeading: headingMatch.value,
                displayInfo: {
                    showHeading: true,
                    showAlias: false,
                    showTitle: false,
                    highlightType: 'heading',
                    primaryMatch: headingMatch.value
                }
            }
        }

        // 默认返回文件部分匹配
        return {
            intent: MatchIntent.FILE_PARTIAL,
            confidence: 0.3,
            shouldJumpToHeading: false,
            displayInfo: {
                showHeading: false,
                showAlias: false,
                showTitle: false,
                highlightType: 'file',
                primaryMatch: item?.basename || ''
            }
        }
    }

    /**
     * 计算匹配置信度 (0-1)
     */
    private calculateMatchConfidence(
        match: Fuse.FuseResultMatch, 
        query: string
    ): number {
        if (!match.indices || !match.value || typeof match.value !== 'string') {
            return 0
        }

        const value = match.value.toLowerCase()
        const normalizedQuery = query.toLowerCase()
        
        // 简化置信度计算调试
        
        // 完全匹配
        if (value === normalizedQuery) return 1.0
        
        // 计算最大连续匹配长度
        let maxMatchLength = 0
        for (const [start, end] of match.indices) {
            const matchLength = end - start + 1
            maxMatchLength = Math.max(maxMatchLength, matchLength)
        }
        
        // 基础置信度：匹配长度 / 查询长度
        const lengthRatio = Math.min(maxMatchLength / normalizedQuery.length, 1)
        
        // 位置权重：开头匹配更重要
        const firstMatch = match.indices[0]
        const positionWeight = firstMatch[0] === 0 ? 1 : 0.7
        
        // 字符串相似度权重  
        const similarity = this.calculateSimilarity(value, normalizedQuery)
        
        const confidence = lengthRatio * positionWeight * similarity
        
        // 仅在需要时显示详细置信度信息
        
        return confidence
    }

    /**
     * 计算字符串相似度 (简化版)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2
        const shorter = str1.length > str2.length ? str2 : str1
        
        if (longer.length === 0) return 1.0
        
        const distance = this.levenshteinDistance(longer, shorter)
        return (longer.length - distance) / longer.length
    }

    /**
     * 计算编辑距离
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = []
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i]
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1]
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    )
                }
            }
        }
        
        return matrix[str2.length][str1.length]
    }

    /**
     * 根据策略决定是否跳转到标题
     */
    private shouldJumpToHeading(analysis: MatchAnalysis, query: string): boolean {
        if (!this.settings.autoJumpToHeading || !analysis.matchedHeading) {
            this.debug('Jump to heading disabled or no heading match')
            return false
        }

        const strategy = this.settings.headingJumpStrategy || 'smart'
        this.debug('Jump strategy:', strategy)
        
        let result = false
        switch (strategy) {
            case 'never':
                result = false
                break
            case 'always':
                result = analysis.intent === MatchIntent.HEADING_CONTENT
                break
            case 'smart':
            default:
                if (analysis.intent === MatchIntent.HEADING_CONTENT) {
                    // 智能策略：动态阈值，短查询词使用更低阈值
                    const queryLength = query.length
                    let threshold: number
                    
                    if (queryLength <= 3) {
                        threshold = 0.05  // 短查询词 (1-3字符) 提高阈值避免过于激进
                    } else if (queryLength <= 6) {
                        threshold = 0.08  // 中等查询词 (4-6字符)
                    } else {
                        threshold = 0.15  // 长查询词 (7+字符)
                    }
                    
                    result = analysis.confidence > threshold
                    this.debug(`🧠 Smart: ${(analysis.confidence * 100).toFixed(1)}% vs ${(threshold * 100).toFixed(0)}% threshold (${queryLength} chars) = ${result ? '✅' : '❌'}`)
                } else {
                    result = false
                    this.debug('Smart strategy decision (no heading match):', {
                        intent: analysis.intent,
                        result
                    })
                }
                break
        }
        
        return result
    }

    /**
     * 获取显示信息
     */
    private getDisplayInfo(
        analysis: MatchAnalysis,
        basenameMatch?: Fuse.FuseResultMatch,
        headingMatch?: Fuse.FuseResultMatch
    ): MatchAnalysis['displayInfo'] {
        // 如果会跳转到标题，显示标题信息
        if (analysis.shouldJumpToHeading && analysis.matchedHeading) {
            return {
                showHeading: true,
                showAlias: false,
                showTitle: false,
                highlightType: 'heading',
                primaryMatch: analysis.matchedHeading
            }
        }
        
        // 如果已经有别名或标题的显示信息，保持不变
        if (analysis.displayInfo.showAlias || analysis.displayInfo.showTitle) {
            return analysis.displayInfo;
        }
        
        // 否则显示文件信息
        let primaryMatch = ''
        if (basenameMatch && typeof basenameMatch.value === 'string') {
            primaryMatch = basenameMatch.value
        } else {
            // 如果没有basename匹配，使用文件名
            primaryMatch = analysis.displayInfo?.primaryMatch || ''
        }
        

        return {
            showHeading: false,
            showAlias: false,
            showTitle: false,
            highlightType: 'file',
            primaryMatch: primaryMatch
        }
    }
}