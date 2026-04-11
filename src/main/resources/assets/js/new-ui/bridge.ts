import type {Action} from '@enonic/lib-admin-ui/ui/Action';
import {ItemViewContextMenuPosition} from '../page-editor/ItemViewContextMenuPosition';
import type {PageView} from '../page-editor/PageView';
import type {ItemView} from '../page-editor/ItemView';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';

let currentPageView: PageView | undefined;

export function setCurrentPageView(pageView: PageView | undefined): void {
    currentPageView = pageView;
}

export function getCurrentPageView(): PageView | undefined {
    return currentPageView;
}

export function resolveItemView(path: string): ItemView | undefined {
    return currentPageView?.getComponentViewByPath(ComponentPath.fromString(path)) as ItemView | undefined;
}

export function getActionsForPath(path: string): Action[] {
    return resolveItemView(path)?.getContextMenuActions() ?? [];
}

export function getLockedPageActions(): Action[] {
    return currentPageView?.getLockedMenuActions() ?? [];
}

export function selectLegacyItemView(path: string): void {
    const itemView = resolveItemView(path);
    if (itemView && !itemView.isSelected()) {
        itemView.select(undefined, ItemViewContextMenuPosition.NONE, true);
    }
}

export function deselectLegacyItemView(path?: string): void {
    if (path) {
        resolveItemView(path)?.deselect(true);
        return;
    }

    currentPageView?.getSelectedView()?.deselect(true);
}
