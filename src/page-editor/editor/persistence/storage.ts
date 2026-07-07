/**
 * Local sessionStorage wrapper for live-edit selection state.
 *
 * The storage key is a byte-identical contract shared with Content Studio for
 * same-origin embedding (`contentstudio:liveedit:selectedPath:<contentId>`).
 * Cross-origin embedding gets isolated — and therefore harmless — copies. Do
 * not change the key string.
 *
 * The API is intentionally string-based so this module stays free of any
 * `ComponentPath`/lib dependency; callers convert paths with `.toString()`.
 */

const SELECTED_PATH_STORAGE_KEY = 'contentstudio:liveedit:selectedPath';

export function updateSelectedPathInStorage(contentId: string | undefined, path: string | undefined): void {
    if (!contentId) return;

    if (path) {
        sessionStorage.setItem(`${SELECTED_PATH_STORAGE_KEY}:${contentId}`, path);
    } else {
        removeSelectedPathInStorage(contentId);
    }
}

export function removeSelectedPathInStorage(contentId: string | undefined): void {
    if (!contentId) return;

    sessionStorage.removeItem(`${SELECTED_PATH_STORAGE_KEY}:${contentId}`);
}

export function getSelectedPathFromStorage(contentId: string | undefined): string | undefined {
    if (!contentId) return undefined;

    return sessionStorage.getItem(`${SELECTED_PATH_STORAGE_KEY}:${contentId}`) ?? undefined;
}
