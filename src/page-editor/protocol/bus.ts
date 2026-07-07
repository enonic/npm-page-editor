/**
 * Typed postMessage transport for the page editor protocol.
 *
 * One endpoint runs inside the edited page (editor), the other inside
 * Content Studio (host). Messages are plain JSON envelopes; no class
 * registry, no cross-window introspection. The remote origin is pinned:
 * outgoing messages target it and incoming messages from any other origin
 * are ignored. `'*'` must be opted into explicitly (tests, sandboxed docs).
 */

import {type EditorToHostPayloads, type HostToEditorPayloads, PROTOCOL_CHANNEL, PROTOCOL_VERSION} from './messages';

//
// * Endpoint Contracts
//

/** Structural subset of `Window` used by the bus; enables non-DOM tests. */
export type MessagePort = {
    postMessage: (message: unknown, targetOrigin: string) => void;
};

export type MessageListenerHost = {
    addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
    removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
};

export type PageEditorBusOptions = {
    /** Window the messages are posted to (`parent` on the editor side). */
    remote: MessagePort;
    /** Origin of the remote window. Required; pass `'*'` only deliberately. */
    remoteOrigin: string;
    /** Window receiving messages; defaults to the global `window`. */
    local?: MessageListenerHost;
    /**
     * Reject incoming messages whose `source` is not the remote window. A
     * message with a null source is rejected too, so a missing source cannot
     * bypass the check (defaults to `true`).
     */
    verifySource?: boolean;
    onVersionMismatch?: (remoteVersion: unknown) => void;
};

type Envelope = {
    channel?: unknown;
    version?: unknown;
    type?: unknown;
    payload?: unknown;
};

function isEnvelope(data: unknown): data is Envelope {
    return typeof data === 'object' && data != null && (data as Envelope).channel === PROTOCOL_CHANNEL;
}

//
// * Bus
//

export class PageEditorBus<In extends Record<string, unknown>, Out extends Record<string, unknown>> {
    private readonly remote: MessagePort;

    private readonly remoteOrigin: string;

    private readonly local: MessageListenerHost;

    private readonly verifySource: boolean;

    private readonly onVersionMismatch?: (remoteVersion: unknown) => void;

    private readonly handlers = new Map<string, Set<(payload: never) => void>>();

    private readonly anyHandlers = new Set<(type: string, payload: unknown) => void>();

    private hasWarnedVersion = false;

    private destroyed = false;

    constructor(options: PageEditorBusOptions) {
        this.remote = options.remote;
        this.remoteOrigin = options.remoteOrigin;
        this.local = options.local ?? window;
        this.verifySource = options.verifySource ?? true;
        this.onVersionMismatch = options.onVersionMismatch;

        this.local.addEventListener('message', this.handleMessage);
    }

    post<K extends keyof Out & string>(type: K, payload: Out[K]): void {
        if (this.destroyed) return;

        this.remote.postMessage(
            {
                channel: PROTOCOL_CHANNEL,
                version: PROTOCOL_VERSION,
                type,
                payload,
            },
            this.remoteOrigin,
        );
    }

    /** Subscribes to one message type; returns the unsubscribe function. */
    on<K extends keyof In & string>(type: K, handler: (payload: In[K]) => void): () => void {
        let set = this.handlers.get(type);
        if (set == null) {
            set = new Set();
            this.handlers.set(type, set);
        }
        set.add(handler);

        return () => set.delete(handler);
    }

    /** Subscribes to every protocol message; returns the unsubscribe function. */
    onAny(handler: (type: string, payload: unknown) => void): () => void {
        this.anyHandlers.add(handler);

        return () => this.anyHandlers.delete(handler);
    }

    destroy(): void {
        this.destroyed = true;
        this.handlers.clear();
        this.anyHandlers.clear();
        this.local.removeEventListener('message', this.handleMessage);
    }

    private readonly handleMessage = (event: MessageEvent): void => {
        if (this.destroyed || !this.isTrusted(event) || !isEnvelope(event.data)) return;

        const {version, type, payload} = event.data;
        if (typeof type !== 'string') return;

        if (version !== PROTOCOL_VERSION && !this.hasWarnedVersion) {
            this.hasWarnedVersion = true;
            if (this.onVersionMismatch) {
                this.onVersionMismatch(version);
            } else {
                console.warn(
                    `[page-editor] protocol version mismatch: local ${PROTOCOL_VERSION}, remote ${String(version)}`,
                );
            }
        }

        this.handlers.get(type)?.forEach(handler => {
            (handler as (value: unknown) => void)(payload);
        });
        this.anyHandlers.forEach(handler => handler(type, payload));
    };

    private isTrusted(event: MessageEvent): boolean {
        if (this.remoteOrigin !== '*' && event.origin !== this.remoteOrigin) return false;
        // A null source is rejected too: otherwise it would bypass this check and,
        // under a `'*'` origin, let any window drive the editor.
        if (this.verifySource && event.source !== this.remote) return false;

        return true;
    }
}

//
// * Factories
//

export type EditorBus = PageEditorBus<HostToEditorPayloads, EditorToHostPayloads>;

export type HostBus = PageEditorBus<EditorToHostPayloads, HostToEditorPayloads>;

/** Creates the endpoint living inside the edited page (talks to the host). */
export function createEditorBus(options: PageEditorBusOptions): EditorBus {
    return new PageEditorBus(options);
}

/** Creates the endpoint living inside Content Studio (talks to the iframe). */
export function createHostBus(options: PageEditorBusOptions): HostBus {
    return new PageEditorBus(options);
}
