import type {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';

export type ComponentRecordType = 'page' | 'region' | 'text' | 'part' | 'layout' | 'fragment';

export interface ComponentRecord {
    readonly path: ComponentPath;
    readonly type: ComponentRecordType;
    readonly element: HTMLElement | undefined;
    readonly parentPath: string | undefined;
    readonly children: readonly string[];
    readonly empty: boolean;
    readonly error: boolean;
    readonly descriptor: string | undefined;
    readonly loading: boolean;
}

export interface ContextMenuState {
    kind: 'component' | 'locked-page';
    path: string;
    x: number;
    y: number;
    /** When true, `x` is treated as the menu's horizontal center (menu shifts left by half its measured width). */
    centerX?: boolean;
    bumpKey?: number;
}

export interface DragState {
    itemType: string;
    itemLabel: string;
    sourcePath: string | undefined;
    targetPath: string | undefined;
    dropAllowed: boolean;
    message: string | undefined;
    placeholderElement: HTMLElement | undefined;
    x: number | undefined;
    y: number | undefined;
}

export interface SelectParentPulse {
    path: string;
    key: number;
}

export interface PlaceholderIsland {
    container: HTMLElement;
    host: HTMLElement;
    shadow: ShadowRoot;
    unmount: () => void;
}
