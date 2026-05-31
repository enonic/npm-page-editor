import {Messages, i18n} from '@enonic/lib-admin-ui/util/Messages';

import {EDITOR_PHRASES} from './messages';

const FALLBACKS = new Map<string, string>(Object.entries(EDITOR_PHRASES));

export type Translate = (key: string, ...args: unknown[]) => string;

/**
 * Resolve a phrase key: loaded Content Studio phrase → English fallback → `#key#`.
 * Once Content Studio gains the key, it transparently overrides the fallback.
 */
const translate: Translate = (key, ...args) => {
    if (Messages.hasMessage(key)) {
        return i18n(key, ...args);
    }
    return FALLBACKS.get(key) ?? `#${key}#`;
};

/**
 * Hook exposing the editor translate function. No context is needed — phrases live
 * in the global lib-admin-ui Messages store, loaded before the Preact UI mounts.
 */
export function useI18n(): Translate {
    return translate;
}
