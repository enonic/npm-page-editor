import {EDITOR_PHRASES} from './messages';
import {hasPhrase, i18n, substitute} from './store';

const FALLBACKS = new Map<string, string>(Object.entries(EDITOR_PHRASES));

export type Translate = (key: string, ...args: unknown[]) => string;

/**
 * Resolve a phrase key: loaded Content Studio phrase → English fallback → `#key#`.
 * Once Content Studio gains the key, it transparently overrides the fallback.
 */
const translate: Translate = (key, ...args) => {
    if (hasPhrase(key)) {
        return i18n(key, ...args);
    }

    const fallback = FALLBACKS.get(key);
    return fallback != null ? substitute(fallback, args) : `#${key}#`;
};

/**
 * Hook exposing the editor translate function. No context is needed — phrases
 * live in the module-level store, loaded before the Preact UI mounts.
 */
export function useI18n(): Translate {
    return translate;
}
