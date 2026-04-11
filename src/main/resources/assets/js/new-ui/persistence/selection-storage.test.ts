const persistenceMocks = vi.hoisted(() => ({
    updateSelectedPathInStorage: vi.fn(),
    removeSelectedPathInStorage: vi.fn(),
    getSelectedPathFromStorage: vi.fn(),
    resolveItemView: vi.fn(),
    selectLegacyItemView: vi.fn(),
    scrollLegacyItemViewIntoView: vi.fn(),
}));

vi.mock('@enonic/lib-contentstudio/app/util/SessionStorageHelper', () => ({
    SessionStorageHelper: {
        updateSelectedPathInStorage: persistenceMocks.updateSelectedPathInStorage,
        removeSelectedPathInStorage: persistenceMocks.removeSelectedPathInStorage,
        getSelectedPathFromStorage: persistenceMocks.getSelectedPathFromStorage,
    },
}));

vi.mock('../bridge', () => ({
    resolveItemView: persistenceMocks.resolveItemView,
    selectLegacyItemView: persistenceMocks.selectLegacyItemView,
    scrollLegacyItemViewIntoView: persistenceMocks.scrollLegacyItemViewIntoView,
}));

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {$selectedPath, setSelectedPath} from '../stores/registry';
import {restoreStoredSelection, syncSelectionStorage} from './selection-storage';

describe('selection storage persistence', () => {
    afterEach(() => {
        setSelectedPath(undefined);

        persistenceMocks.updateSelectedPathInStorage.mockReset();
        persistenceMocks.removeSelectedPathInStorage.mockReset();
        persistenceMocks.getSelectedPathFromStorage.mockReset();
        persistenceMocks.resolveItemView.mockReset();
        persistenceMocks.selectLegacyItemView.mockReset();
        persistenceMocks.scrollLegacyItemViewIntoView.mockReset();
    });

    it('persists component selections and clears page-level or empty selections', () => {
        const stop = syncSelectionStorage('content-id');

        setSelectedPath('/main/0');
        expect(persistenceMocks.updateSelectedPathInStorage).toHaveBeenCalledWith(
            'content-id',
            expect.objectContaining({toString: expect.any(Function)}),
        );
        expect(persistenceMocks.updateSelectedPathInStorage.mock.calls[0][1].toString()).toBe('/main/0');

        setSelectedPath(ComponentPath.root().toString());
        setSelectedPath(undefined);

        expect(persistenceMocks.removeSelectedPathInStorage).toHaveBeenCalledTimes(2);
        expect(persistenceMocks.removeSelectedPathInStorage).toHaveBeenNthCalledWith(1, 'content-id');
        expect(persistenceMocks.removeSelectedPathInStorage).toHaveBeenNthCalledWith(2, 'content-id');

        stop();
    });

    it('allows fragment root selections to persist when explicitly enabled', () => {
        const stop = syncSelectionStorage('content-id', true);

        setSelectedPath(ComponentPath.root().toString());

        expect(persistenceMocks.updateSelectedPathInStorage).toHaveBeenCalledWith(
            'content-id',
            expect.objectContaining({toString: expect.any(Function)}),
        );
        expect(persistenceMocks.updateSelectedPathInStorage.mock.calls[0][1].toString()).toBe('/');

        stop();
    });

    it('restores an existing stored selection into both the legacy item view and the new store', () => {
        persistenceMocks.getSelectedPathFromStorage.mockReturnValue(ComponentPath.fromString('/main/1'));
        persistenceMocks.resolveItemView.mockReturnValue({scrollComponentIntoView: vi.fn()});

        restoreStoredSelection('content-id');

        expect(persistenceMocks.selectLegacyItemView).toHaveBeenCalledWith('/main/1');
        expect(persistenceMocks.scrollLegacyItemViewIntoView).toHaveBeenCalledWith('/main/1');
        expect($selectedPath.get()).toBe('/main/1');
    });

    it('drops stale stored paths that no longer resolve in the page view', () => {
        persistenceMocks.getSelectedPathFromStorage.mockReturnValue(ComponentPath.fromString('/missing'));
        persistenceMocks.resolveItemView.mockReturnValue(undefined);

        restoreStoredSelection('content-id');

        expect(persistenceMocks.removeSelectedPathInStorage).toHaveBeenCalledWith('content-id');
        expect(persistenceMocks.selectLegacyItemView).not.toHaveBeenCalled();
        expect($selectedPath.get()).toBeUndefined();
    });

    it('restores fragment root selections when root persistence is enabled', () => {
        persistenceMocks.getSelectedPathFromStorage.mockReturnValue(ComponentPath.root());
        persistenceMocks.resolveItemView.mockReturnValue({scrollComponentIntoView: vi.fn()});

        restoreStoredSelection('content-id', true);

        expect(persistenceMocks.selectLegacyItemView).toHaveBeenCalledWith('/');
        expect(persistenceMocks.scrollLegacyItemViewIntoView).toHaveBeenCalledWith('/');
        expect($selectedPath.get()).toBe('/');
    });
});
