import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {SessionStorageHelper} from '@enonic/lib-contentstudio/app/util/SessionStorageHelper';
import {
    resolveItemView,
    scrollLegacyItemViewIntoView,
    selectLegacyItemView,
} from '../bridge';
import {$selectedPath, setSelectedPath} from '../stores/registry';

function isPersistablePath(path: string | undefined): path is string {
    return !!path && path !== ComponentPath.root().toString();
}

export function syncSelectionStorage(contentId: string | undefined): () => void {
    if (!contentId) {
        return () => undefined;
    }

    return $selectedPath.listen((path) => {
        if (!isPersistablePath(path)) {
            SessionStorageHelper.removeSelectedPathInStorage(contentId);
            return;
        }

        SessionStorageHelper.updateSelectedPathInStorage(contentId, ComponentPath.fromString(path));
    });
}

export function restoreStoredSelection(contentId: string | undefined): void {
    const storedPath = SessionStorageHelper.getSelectedPathFromStorage(contentId)?.toString();
    if (!isPersistablePath(storedPath)) {
        return;
    }

    if (!resolveItemView(storedPath)) {
        SessionStorageHelper.removeSelectedPathInStorage(contentId);
        return;
    }

    selectLegacyItemView(storedPath);
    scrollLegacyItemViewIntoView(storedPath);
    setSelectedPath(storedPath);
}
