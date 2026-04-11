import type {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';

export type ComponentRecordType = 'page' | 'region' | 'text' | 'part' | 'layout' | 'fragment';

export interface ComponentRecord {
    path: ComponentPath;
    type: ComponentRecordType;
    element: HTMLElement | undefined;
    parentPath: string | undefined;
    children: string[];
    empty: boolean;
    error: boolean;
    descriptor: string | undefined;
    loading: boolean;
}

export interface ContextMenuState {
    kind: 'component' | 'locked-page';
    path: string;
    x: number;
    y: number;
}

export interface PlaceholderIsland {
    container: HTMLElement;
    host: HTMLElement;
    shadow: ShadowRoot;
    unmount: () => void;
}
