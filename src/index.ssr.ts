// Mirrors the public surface of `./index.ts` with inert implementations so the
// package can be imported under Node/SSR without touching browser globals.
// Routed via the `node`/`workerd` conditions in `package.json#exports`.

import type {ComponentRecord, PageEditorConfig} from './page-editor/editor/types';
import type {EditorEventPayloads, EditorEventType} from './page-editor/event/editorEvents';
import type {ComponentPath, ContentInfo} from './page-editor/protocol';

export type {EditorEventPayloads, EditorEventType} from './page-editor/event/editorEvents';
export type {ComponentRecord, ComponentRecordType, PageEditorConfig} from './page-editor/editor/types';
export {ComponentPath} from './page-editor/protocol';

export function isInitialized(): boolean {
    return false;
}

export function getContent(): ContentInfo | undefined {
    return undefined;
}

export function subscribe<T extends EditorEventType>(
    _type: T,
    _handler: (payload: EditorEventPayloads[T]) => void,
): () => void {
    return () => undefined;
}

export function renderLoadingComponent(_path: ComponentPath): void {
    // no-op under SSR
}

export function renderComponent(_path: ComponentPath, _html: string): void {
    // no-op under SSR
}

export function renderErrorComponent(_path: ComponentPath, _reason: Error): void {
    // no-op under SSR
}

export function reloadPage(): void {
    // no-op under SSR
}

export function getComponentAt(_path: ComponentPath): ComponentRecord | undefined {
    return undefined;
}

export function getAllComponents(): readonly ComponentRecord[] {
    return [];
}

export function init(_config?: PageEditorConfig): void {
    // no-op under SSR
}
