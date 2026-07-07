const persistenceMocks = vi.hoisted(() => ({
    updateSelectedPathInStorage: vi.fn(),
    removeSelectedPathInStorage: vi.fn(),
    getSelectedPathFromStorage: vi.fn(),
    scrollComponentIntoView: vi.fn(),
}));

vi.mock('./storage', () => ({
    updateSelectedPathInStorage: persistenceMocks.updateSelectedPathInStorage,
    removeSelectedPathInStorage: persistenceMocks.removeSelectedPathInStorage,
    getSelectedPathFromStorage: persistenceMocks.getSelectedPathFromStorage,
}));

vi.mock('../dom/scroll', () => ({
    scrollComponentIntoView: persistenceMocks.scrollComponentIntoView,
}));

import type {ComponentRecord} from '../types';

import {ComponentPath} from '../../protocol';
import {$selectedPath, setRegistry, setSelectedPath} from '../stores/registry';
import {restoreStoredSelection, syncSelectionStorage} from './selection-storage';

function seedRecord(path: string): void {
    const record = {
        path: ComponentPath.fromString(path),
        type: 'part',
        element: document.createElement('div'),
        parentPath: '/main',
        children: [],
        empty: false,
        error: false,
        descriptor: 'app:part',
        loading: false,
    } satisfies ComponentRecord;

    setRegistry({[path]: record});
}

describe('selection storage persistence', () => {
    afterEach(() => {
        setSelectedPath(undefined);
        setRegistry({});

        persistenceMocks.updateSelectedPathInStorage.mockReset();
        persistenceMocks.removeSelectedPathInStorage.mockReset();
        persistenceMocks.getSelectedPathFromStorage.mockReset();
        persistenceMocks.scrollComponentIntoView.mockReset();
    });

    it('persists component selections and clears page-level or empty selections', () => {
        const stop = syncSelectionStorage('content-id');

        setSelectedPath('/main/0');
        expect(persistenceMocks.updateSelectedPathInStorage).toHaveBeenCalledWith('content-id', '/main/0');

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

        expect(persistenceMocks.updateSelectedPathInStorage).toHaveBeenCalledWith('content-id', '/');

        stop();
    });

    it('restores an existing stored selection into the store and scrolls it into view', () => {
        persistenceMocks.getSelectedPathFromStorage.mockReturnValue('/main/1');
        seedRecord('/main/1');

        restoreStoredSelection('content-id');

        expect($selectedPath.get()).toBe('/main/1');
        expect(persistenceMocks.scrollComponentIntoView).toHaveBeenCalledWith('/main/1');
    });

    it('drops stale stored paths that no longer resolve in the registry', () => {
        persistenceMocks.getSelectedPathFromStorage.mockReturnValue('/missing');
        setRegistry({});

        restoreStoredSelection('content-id');

        expect(persistenceMocks.removeSelectedPathInStorage).toHaveBeenCalledWith('content-id');
        expect(persistenceMocks.scrollComponentIntoView).not.toHaveBeenCalled();
        expect($selectedPath.get()).toBeUndefined();
    });

    it('restores fragment root selections when root persistence is enabled', () => {
        persistenceMocks.getSelectedPathFromStorage.mockReturnValue('/');
        seedRecord('/');

        restoreStoredSelection('content-id', true);

        expect($selectedPath.get()).toBe('/');
        expect(persistenceMocks.scrollComponentIntoView).toHaveBeenCalledWith('/');
    });
});
