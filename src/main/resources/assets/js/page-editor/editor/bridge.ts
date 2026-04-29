import type {Action} from '@enonic/lib-admin-ui/ui/Action';
import type {PageView} from '../PageView';
import {ItemView} from '../ItemView';
import {StringHelper} from '@enonic/lib-admin-ui/util/StringHelper';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {TextComponent} from '@enonic/lib-contentstudio/app/page/region/TextComponent';
import {PageState} from '@enonic/lib-contentstudio/app/wizard/page/PageState';

const TEXT_SNIPPET_MAX_LENGTH = 100;

export const SELECT_PARENT_ACTION_CLASS = ItemView.SELECT_PARENT_ACTION_CLASS;

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

export function getLegacyParentPath(path: string): string | undefined {
    const parent = resolveItemView(path)?.getParentItemView();
    return parent?.getPath().toString();
}

/**
 * Aligns the legacy item's *top edge* with the viewport top (instantly) and
 * returns its post-scroll bounding rect. Used by the new context menu's
 * "Select parent" flow so the menu can be anchored to the parent's top without
 * waiting for scrollend.
 */
export function focusLegacyItemViewInstant(path: string): DOMRect | undefined {
    const itemView = resolveItemView(path);
    if (!itemView) return undefined;

    const element = itemView.getEl().getHTMLElement();
    element.scrollIntoView({behavior: 'auto', block: 'start'});
    return element.getBoundingClientRect();
}

export function getLegacyItemViewLabel(path: string): string | undefined {
    return resolveItemView(path)?.getName();
}

export function getComponentName(path: string): string | undefined {
    const item = PageState.getComponentByPath(ComponentPath.fromString(path));
    if (item == null) return undefined;

    if (item instanceof TextComponent) {
        const snippet = getTextSnippet(item);
        if (snippet.length > 0) return snippet;
    }

    const named = item as {getName?: () => {toString(): string} | undefined};
    const name = named.getName?.()?.toString();
    return name != null && name.length > 0 ? name : undefined;
}

function getTextSnippet(component: TextComponent): string {
    const text = StringHelper.htmlToString(component.getText() || '')
        .replace(/\s+/g, ' ')
        .trim();
    const codepoints = Array.from(text);
    return codepoints.length > TEXT_SNIPPET_MAX_LENGTH
        ? codepoints.slice(0, TEXT_SNIPPET_MAX_LENGTH).join('')
        : text;
}

export function getLockedPageActions(): Action[] {
    return currentPageView?.getLockedMenuActions() ?? [];
}

export function selectLegacyItemView(path: string): void {
    const itemView = resolveItemView(path);
    if (itemView && !itemView.isSelected()) {
        itemView.select(undefined, true);
    }
}

export function scrollLegacyItemViewIntoView(path: string): void {
    resolveItemView(path)?.scrollComponentIntoView();
}

export function deselectLegacyItemView(path?: string): void {
    if (path) {
        resolveItemView(path)?.deselect(true);
        return;
    }

    currentPageView?.getSelectedView()?.deselect(true);
}

export function setLegacyItemViewMoving(path: string, value: boolean): void {
    const itemView = resolveItemView(path) as ItemView & {setMoving?: (moving: boolean) => void} | undefined;

    itemView?.setMoving?.(value);
}

export function legacyFragmentContainsLayout(path: string): boolean {
    const itemView = resolveItemView(path) as ItemView & {containsLayout?: () => boolean} | undefined;

    return itemView?.containsLayout?.() ?? false;
}
