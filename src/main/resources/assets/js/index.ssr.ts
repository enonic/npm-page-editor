//
// * SSR-safe entry
//
// Mirrors the public surface of `./index.ts` with inert implementations so the
// package can be imported under Node/SSR without touching browser globals.
// Routed via the `node`/`workerd` conditions in `package.json#exports`.
//

import type {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';

import type {ComponentRecord, PageEditorConfig} from './page-editor/editor/types';
import type {ContentSummaryAndCompareStatus} from '@enonic/lib-contentstudio/app/content/ContentSummaryAndCompareStatus';
import type {EditorEvent, EditorEvents} from './page-editor/event/EditorEvent';

export {EditorEvent, EditorEvents} from './page-editor/event/EditorEvent';
export type {ComponentRecord, ComponentRecordType, PageEditorConfig} from './page-editor/editor/types';
export {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';


export class PageEditor {

    static isInitialized(): boolean {
        return false;
    }

    static getContent(): ContentSummaryAndCompareStatus | undefined {
        return undefined;
    }

    static on(_eventName: EditorEvents, _handler: (event: EditorEvent) => void): void {
        // no-op under SSR
    }

    static un(_eventName: EditorEvents, _handler: (event: EditorEvent) => void): void {
        // no-op under SSR
    }

    static renderLoadingComponent(_path: ComponentPath): void {
        // no-op under SSR
    }

    static renderComponent(_path: ComponentPath, _html: string): void {
        // no-op under SSR
    }

    static renderErrorComponent(_path: ComponentPath, _reason: Error): void {
        // no-op under SSR
    }

    static reloadPage(): void {
        // no-op under SSR
    }

    static getComponentAt(_path: ComponentPath): ComponentRecord | undefined {
        return undefined;
    }

    static getAllComponents(): readonly ComponentRecord[] {
        return [];
    }

    static init(_opts?: PageEditorConfig): Promise<void> {
        return Promise.resolve();
    }
}
