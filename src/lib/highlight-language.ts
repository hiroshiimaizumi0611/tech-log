import { bundledLanguages, type BundledLanguage } from 'shiki';

export function resolveHighlightLanguage(language: string): BundledLanguage | 'text' {
  return Object.hasOwn(bundledLanguages, language) ? (language as BundledLanguage) : 'text';
}
