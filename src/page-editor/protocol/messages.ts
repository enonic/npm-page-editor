/**
 * Page editor protocol catalog: every message exchanged between the host
 * (Content Studio) and the editor (this package, inside the page iframe),
 * as plain JSON payloads keyed by message type.
 */

import type {InsertableComponentKind, PageJson} from './page';

export const PROTOCOL_CHANNEL = 'enonic:page-editor';

export const PROTOCOL_VERSION = 1;

//
// * Shared Payload Types
//

export type TextUpdateOrigin = 'live' | 'inspector' | 'unknown';

export type ClickPosition = {
    x: number;
    y: number;
};

export type PageEditorParams = {
    contentId: string;
    isFragment?: boolean;
    isFragmentAllowed?: boolean;
    isPageTemplate?: boolean;
    /** Content display name, shown as the page context-menu title. */
    displayName?: string;
    locked?: boolean;
    isResetEnabled?: boolean;
    language?: string;
    modifyPermissions?: boolean;
    enableTextComponent?: boolean;
};

export type ContentInfo = {
    id: string;
    path?: string;
    displayName?: string;
    type?: string;
    language?: string;
};

export type ProjectInfo = {
    name: string;
    displayName?: string;
};

export type InitializePayload = {
    params: PageEditorParams;
    page?: PageJson;
    /** i18n phrases for editor chrome, keyed by phrase key. */
    phrases?: Record<string, string>;
    locale?: string;
    content?: ContentInfo;
    project?: ProjectInfo;
    /** Origin of the hosting Content Studio, e.g. `https://admin.example.com`. */
    hostDomain?: string;
};

/** Serializable subset of a relayed keyboard event. */
export type KeyboardEventInit = {
    bubbles: boolean;
    cancelable: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    key: string;
    code: string;
    /** Deprecated DOM key fields, kept for hosts that re-dispatch through them. */
    keyCode?: number;
    charCode?: number;
};

//
// * Host → Editor
//

export type HostToEditorPayloads = {
    /** Boot the editor. Sent once after the editor reports `editor-loaded`. */
    initialize: InitializePayload;
    /** Replace the page model after a host-side change. */
    'page-state': {page?: PageJson};

    'select-component': {path: string};
    /** Clears the selection; with `path`, only when that component is still selected. */
    'deselect-component': {path?: string};

    'add-component': {path: string; kind: InsertableComponentKind};
    'remove-component': {path: string};
    'move-component': {from: string; to: string};
    'duplicate-component': {path: string};
    'reset-component': {path: string};
    /** Ask the editor to (re)load a component's markup. */
    'load-component': {path: string; existing?: boolean};

    'update-text-component': {path: string; text: string; origin?: TextUpdateOrigin};
    /** Toggle the processing spinner on a component. */
    'set-component-state': {path: string; processing: boolean};

    'set-page-lock-state': {locked: boolean};
    'set-modify-allowed': {allowed: boolean};
    'skip-reload-confirmation': {skip: boolean};

    /** Start/stop a drag session originating from the host's insert panel. */
    'create-or-destroy-draggable': {kind: InsertableComponentKind; create: boolean};
    'set-draggable-visible': {kind: InsertableComponentKind; visible: boolean};
};

//
// * Editor → Host
//

export type EditorToHostPayloads = {
    /** The iframe finished loading; the host may send `initialize`. */
    'editor-loaded': Record<string, never>;
    /** The editor finished booting and parsed the page. */
    ready: Record<string, never>;
    'init-error': {message: string};

    'component-selected': {path: string; position?: ClickPosition; rightClicked?: boolean};
    'component-deselected': {path?: string};
    'component-inspect-requested': {path: string};

    'add-component-requested': {path: string; kind: InsertableComponentKind};
    'remove-component-requested': {path: string};
    'move-component-requested': {from: string; to: string};
    'duplicate-component-requested': {path: string};
    'reset-component-requested': {path: string};

    'save-as-template-requested': Record<string, never>;
    'page-reset-requested': Record<string, never>;
    'page-reload-requested': Record<string, never>;
    'page-locked': Record<string, never>;
    'page-unlocked': Record<string, never>;

    'create-fragment-requested': {path: string};
    'detach-fragment-requested': {path: string};

    'edit-content-requested': {contentId: string};
    'text-edit-requested': {path: string};

    'component-loaded': {path: string};
    'component-load-failed': {path: string; message: string};

    'drag-started': {path: string};
    'drag-stopped': {path: string};
    'drag-canceled': {path: string};
    'drag-dropped': {from: string; to: string};

    /** Inline (non-edit) mode: a navigation inside the page changed the previewed path. */
    'preview-path-changed': {path: string};
    /** Keyboard shortcut relayed to the host (modifier combos, F2). */
    'keyboard-relay': {type: string; init: KeyboardEventInit};
};

//
// * Message Envelopes
//

export type ProtocolMessage<P extends Record<string, unknown>> = {
    [K in keyof P & string]: {
        channel: typeof PROTOCOL_CHANNEL;
        version: number;
        type: K;
        payload: P[K];
    };
}[keyof P & string];

export type HostToEditorMessage = ProtocolMessage<HostToEditorPayloads>;

export type EditorToHostMessage = ProtocolMessage<EditorToHostPayloads>;

export type HostToEditorType = keyof HostToEditorPayloads;

export type EditorToHostType = keyof EditorToHostPayloads;
