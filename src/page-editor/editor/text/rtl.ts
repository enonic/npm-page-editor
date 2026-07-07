/**
 * Right-to-left language detection, ported from the legacy
 * `@enonic/lib-admin-ui` `Locale.supportsRtl`. The editing language drives the
 * `dir="rtl"` attribute on text components so their content reads correctly.
 *
 * The list carries both the modern ISO 639-1 codes and the legacy Java codes XP
 * still emits for some locales (Hebrew `iw`, Yiddish `ji`).
 */

const RTL_LANGUAGES: ReadonlySet<string> = new Set([
    'ar', // Arabic
    'arc', // Aramaic
    'dv', // Divehi
    'fa', // Persian
    'ha', // Hausa
    'he', // Hebrew
    'iw', // Hebrew (legacy Java code)
    'khw', // Khowar
    'ks', // Kashmiri
    'ku', // Kurdish
    'ps', // Pashto
    'ur', // Urdu
    'yi', // Yiddish
    'ji', // Yiddish (legacy Java code)

    // Additional codes beyond the legacy port, unambiguously RTL (CLDR default
    // script is Arabic) and explicitly supported here:
    'ckb', // Central Kurdish (Sorani)
    'ug', // Uyghur
]);

export function isRtlLanguage(language: string | undefined): boolean {
    if (language == null) {
        return false;
    }

    const code = language.trim().split(/[-_]/)[0].toLowerCase();
    return RTL_LANGUAGES.has(code);
}
