import {markError, markLoading, reconcileSubtree} from './editor/adapter/reconcile';
import {replaceComponentHtml} from './editor/dom/mutate';
import {type ComponentPath} from './protocol';

export function renderComponentHtml(path: ComponentPath, html: string): boolean {
    const key = path.toString();

    if (!replaceComponentHtml(key, html)) {
        console.warn(`PageEditor: cannot render component at [${key}] — no component element found`);
        return false;
    }

    markLoading(key, false);
    markError(key, false);

    reconcileSubtree(key);
    return true;
}

export function markComponentLoading(path: ComponentPath): void {
    const key = path.toString();
    markError(key, false);
    markLoading(key, true);
}

export function markComponentError(path: ComponentPath): void {
    const key = path.toString();
    markLoading(key, false);
    markError(key, true);
}
