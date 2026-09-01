import { getLanguage } from 'obsidian'
import type { BaseMessage } from './types'
import en from './locales/en'
import zhCN from './locales/zh-CN'

/**
 * Locale registry. Keys match the codes returned by `getLanguage()`:
 * 'en', 'zh' (Simplified), 'zh-TW' (Traditional, falls back to English).
 */
const messages: Record<string, BaseMessage> = {
	en,
	zh: zhCN,
}

/**
 * Returns the message catalog for the current Obsidian language.
 * Falls back to English for unsupported languages.
 */
export function t(): BaseMessage {
	return messages[getLanguage()] ?? en
}
