/**
 * Editor-owned phrases with their English fallbacks. Content Studio supplies the
 * real translations at runtime; until a key is added there, the fallback renders.
 * This map doubles as the canonical list of keys to register in Content Studio.
 */
export const EDITOR_PHRASES = {
    'live.view.region.drop': 'Drop components here...',
    'live.view.component.renderError': 'This component could not be rendered.',
    'live.view.page.locked': 'Locked',
} as const;

export type EditorPhraseKey = keyof typeof EDITOR_PHRASES;
