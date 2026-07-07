import {getSelectedPathFromStorage, removeSelectedPathInStorage, updateSelectedPathInStorage} from './storage';

const CONTENT_ID = 'abc-123';
const SELECTED_PATH_KEY = `contentstudio:liveedit:selectedPath:${CONTENT_ID}`;

describe('selection storage', () => {
    afterEach(() => {
        sessionStorage.clear();
    });

    it('writes the selected path under the shared Content Studio key', () => {
        updateSelectedPathInStorage(CONTENT_ID, '/main/0');

        expect(sessionStorage.getItem(SELECTED_PATH_KEY)).toBe('/main/0');
    });

    it('reads the selected path back as a plain string', () => {
        sessionStorage.setItem(SELECTED_PATH_KEY, '/main/1');

        expect(getSelectedPathFromStorage(CONTENT_ID)).toBe('/main/1');
    });

    it('removes the selected path entry', () => {
        sessionStorage.setItem(SELECTED_PATH_KEY, '/main/0');

        removeSelectedPathInStorage(CONTENT_ID);

        expect(sessionStorage.getItem(SELECTED_PATH_KEY)).toBeNull();
        expect(getSelectedPathFromStorage(CONTENT_ID)).toBeUndefined();
    });

    it('clears the selected path when updating with an empty value', () => {
        sessionStorage.setItem(SELECTED_PATH_KEY, '/main/0');

        updateSelectedPathInStorage(CONTENT_ID, undefined);

        expect(sessionStorage.getItem(SELECTED_PATH_KEY)).toBeNull();
    });

    it('is a no-op without a content id', () => {
        updateSelectedPathInStorage(undefined, '/main/0');
        removeSelectedPathInStorage(undefined);

        expect(sessionStorage.length).toBe(0);
        expect(getSelectedPathFromStorage(undefined)).toBeUndefined();
    });
});
