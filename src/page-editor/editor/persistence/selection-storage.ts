import {ComponentPath} from '../../protocol';
import {scrollComponentIntoView} from '../dom/scroll';
import {$selectedPath, getRecord, setSelectedPath} from '../stores/registry';
import {getSelectedPathFromStorage, removeSelectedPathInStorage, updateSelectedPathInStorage} from './storage';

function isPersistablePath(path: string | undefined, allowRootSelection: boolean): path is string {
    return !!path && (allowRootSelection || path !== ComponentPath.root().toString());
}

export function syncSelectionStorage(contentId: string | undefined, allowRootSelection = false): () => void {
    if (!contentId) {
        return () => undefined;
    }

    return $selectedPath.listen(path => {
        if (!isPersistablePath(path, allowRootSelection)) {
            removeSelectedPathInStorage(contentId);
            return;
        }

        updateSelectedPathInStorage(contentId, path);
    });
}

export function restoreStoredSelection(contentId: string | undefined, allowRootSelection = false): void {
    const storedPath = getSelectedPathFromStorage(contentId);
    if (!isPersistablePath(storedPath, allowRootSelection)) {
        return;
    }

    if (!getRecord(storedPath)) {
        removeSelectedPathInStorage(contentId);
        return;
    }

    setSelectedPath(storedPath);
    scrollComponentIntoView(storedPath);
}
