/**
 * Public editor event surface, consumed by external host glue via
 * `PageEditor.subscribe`. A tiny typed emitter keyed by event type: payloads are
 * declared in `EditorEventPayloads`, so `subscribe`/`emit` stay type-safe without
 * a wrapper event object.
 */

import type {ComponentPath} from '../protocol';

export type EditorEventType = 'component-load-request';

export type EditorEventPayloads = {
    /** The host asked the editor to (re)load a component; glue fetches its markup. */
    'component-load-request': {path: ComponentPath; isExisting: boolean};
};

type EditorEventHandler<T extends EditorEventType> = (payload: EditorEventPayloads[T]) => void;

const handlers = new Map<EditorEventType, Set<EditorEventHandler<EditorEventType>>>();

/** Registers `handler` for `type` and returns a function that removes it. */
export function subscribe<T extends EditorEventType>(type: T, handler: EditorEventHandler<T>): () => void {
    let set = handlers.get(type);
    if (set == null) {
        set = new Set();
        handlers.set(type, set);
    }
    // ? Handlers are stored type-erased; the generic signature keeps callers safe.
    const erased = handler as EditorEventHandler<EditorEventType>;
    set.add(erased);
    return () => set.delete(erased);
}

export function emit<T extends EditorEventType>(type: T, payload: EditorEventPayloads[T]): void {
    handlers.get(type)?.forEach(handler => handler(payload));
}

/** Clears all subscriptions. Intended for test teardown. */
export function reset(): void {
    handlers.clear();
}
