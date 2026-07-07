import type {ComponentRecord, PageEditorConfig} from './editor/types';

import {markComponentError, markComponentLoading, renderComponentHtml} from './componentRendering';
import {EditorBoot} from './editor/EditorBoot';
import {getHostContext} from './editor/stores/host';
import {getRecord, getRegistry} from './editor/stores/registry';
import {getBus, initTransport} from './editor/transport/bus';
import {type ComponentPath, type ContentInfo} from './protocol';
import {
    isDownloadLink,
    isNavigatingOutsideOfXP,
    isNavigatingWithinSamePage,
    trimAnchor,
    trimUrlParams,
    trimWindowProtocolAndPortFromHref,
} from './util/uri';

/** Subscribes external host glue to an editor event; see `event/editorEvents`. */
export {subscribe} from './event/editorEvents';

type EditorMode = 'edit' | 'inline';

//
// * Module State
//

let mode: EditorMode | undefined;

//
// * Internal Helpers
//

function postPreviewPathChange(window: Window, clickedLink: string): void {
    if (isNavigatingOutsideOfXP(clickedLink, window)) {
        return;
    }

    const contentPreviewPath = '/' + trimUrlParams(trimAnchor(trimWindowProtocolAndPortFromHref(clickedLink, window)));

    if (!isNavigatingWithinSamePage(contentPreviewPath, window) && !isDownloadLink(contentPreviewPath)) {
        getBus()?.post('preview-path-changed', {path: contentPreviewPath});
    }
}

function createWindowClickListener(window: Window): (event: MouseEvent) => void {
    return (event: MouseEvent): void => {
        const clickedLink = getClickedLink(event);

        if (clickedLink) {
            postPreviewPathChange(window, clickedLink);
        }
    };
}

function getClickedLink(event: MouseEvent): string {
    const findPath = (a: HTMLAnchorElement): string => {
        return a.dataset.contentPath || a.href;
    };

    // `closest` lives on `Element`, so it also resolves the anchor when the click
    // lands on an inline `<svg>` icon (an `SVGElement`, not an `HTMLElement`).
    const target = event.target;
    const anchor = target instanceof Element ? target.closest('a') : null;

    return anchor ? findPath(anchor) : '';
}

function initListeners(editMode: boolean): void {
    if (editMode) {
        const postEditorLoaded = (): void => {
            getBus()?.post('editor-loaded', {});
        };

        // The host waits for `editor-loaded` before sending `initialize`, so
        // post right away when `init()` runs after the window already loaded.
        if (document.readyState === 'complete') {
            postEditorLoaded();
        } else {
            window.addEventListener('load', postEditorLoaded, {once: true});
        }
    }

    window.addEventListener('click', createWindowClickListener(window));
}

//
// * Public API
//
// NB! Mirror every change here in the SSR shell `../index.ssr.ts`.
// Consumed as a namespace: `import * as PageEditor from '@enonic/page-editor'`.
//

export function isInitialized(): boolean {
    return !!mode;
}

export function getContent(): ContentInfo | undefined {
    return getHostContext().content;
}

export function renderLoadingComponent(path: ComponentPath): void {
    markComponentLoading(path);
}

export function renderComponent(path: ComponentPath, html: string): void {
    if (!renderComponentHtml(path, html)) {
        return;
    }
    getBus()?.post('component-loaded', {path: path.toString()});
}

export function renderErrorComponent(path: ComponentPath, reason: Error): void {
    console.warn(`PageEditor: component load at [${path.toString()}] failed:`, reason);
    markComponentError(path);
    getBus()?.post('component-load-failed', {path: path.toString(), message: reason.message});
}

export function reloadPage(): void {
    getBus()?.post('page-reload-requested', {});
}

export function getComponentAt(path: ComponentPath): ComponentRecord | undefined {
    return getRecord(path?.toString());
}

export function getAllComponents(): readonly ComponentRecord[] {
    return Object.values(getRegistry());
}

export function init(config?: PageEditorConfig): void {
    if (mode) {
        throw new Error(`Page editor is already initialized in "${mode}" mode.`);
    }

    const editMode = config?.editMode ?? false;

    mode = editMode ? 'edit' : 'inline';

    const bus = initTransport({hostOrigin: config?.hostOrigin});
    initListeners(editMode);

    if (editMode) {
        // The boot instance stays alive via its bus subscriptions.
        new EditorBoot(bus);
    }
}
