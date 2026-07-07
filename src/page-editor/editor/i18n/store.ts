/**
 * Module-level phrase registry for the editor. Populated at boot from the
 * `initialize` payload so the editor i18n is self-contained.
 *
 * Provides key lookup with `{0}`/`{1}` placeholder substitution.
 */

const phrases = new Map<string, string>();

/** Merge additional phrase entries into the registry. */
export function addPhrases(incoming: Record<string, string>): void {
    for (const key of Object.keys(incoming)) {
        phrases.set(key, incoming[key]);
    }
}

/** Return true when the key is present in the registry. */
export function hasPhrase(key: string): boolean {
    return phrases.has(key);
}

/**
 * Replace `{0}`, `{1}`, … placeholders in `template` with the supplied
 * arguments. A missing argument renders as the literal string `undefined`.
 */
export function substitute(template: string, args: unknown[]): string {
    return template
        .replace(/{(\d+)}/g, (_substring, index: string) => {
            return String(args[Number(index)]);
        })
        .trim();
}

/**
 * Look up a phrase by key, substituting `{0}`, `{1}`, … placeholders with
 * the supplied arguments. Returns `#key#` when the key is missing.
 */
export function i18n(key: string, ...args: unknown[]): string {
    return substitute(phrases.get(key) ?? `#${key}#`, args);
}
