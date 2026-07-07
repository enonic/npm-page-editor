import {
    createEditorBus,
    createHostBus,
    type EditorBus,
    type HostBus,
    type MessageListenerHost,
    type MessagePort,
} from '../page-editor/protocol';

type Listener = (event: MessageEvent) => void;

const ORIGIN = 'https://admin.example.com';

/** Structural Window double for driving both ends of the protocol bus. */
export class FakeWindow implements MessagePort, MessageListenerHost {
    private readonly listeners = new Set<Listener>();

    /** Origin attributed to messages posted into this window. */
    incomingOrigin = '';

    /** Window attributed as the `source` of messages posted into this window. */
    peer: MessagePort | undefined = undefined;

    posted: {message: unknown; targetOrigin: string}[] = [];

    postMessage(message: unknown, targetOrigin: string): void {
        this.posted.push({message, targetOrigin});
        this.receive(message, this.incomingOrigin, this.peer);
    }

    receive(data: unknown, origin: string, source?: MessagePort): void {
        // FakeWindow stands in for a real Window; MessageEvent's source typing
        // only accepts DOM sources, so cast our structural double across it.
        const event = new MessageEvent('message', {
            data,
            origin,
            source: (source ?? null) as MessageEventSource | null,
        });
        this.listeners.forEach(listener => listener(event));
    }

    addEventListener(_type: 'message', listener: Listener): void {
        this.listeners.add(listener);
    }

    removeEventListener(_type: 'message', listener: Listener): void {
        this.listeners.delete(listener);
    }
}

export type FakeBusPair = {
    editor: EditorBus;
    host: HostBus;
    editorWindow: FakeWindow;
    hostWindow: FakeWindow;
};

/**
 * Wires an editor bus and a host bus over fake windows so tests can drive the
 * editor by posting from the host (`pair.host.post('select-component', …)`)
 * and assert what the editor posted (`pair.hostWindow.posted`).
 */
export function createFakeBusPair(): FakeBusPair {
    const editorWindow = new FakeWindow();
    const hostWindow = new FakeWindow();
    editorWindow.incomingOrigin = ORIGIN;
    hostWindow.incomingOrigin = ORIGIN;
    // Each window's incoming messages come from the other; attribute the source
    // so they pass the bus's `verifySource` check.
    editorWindow.peer = hostWindow;
    hostWindow.peer = editorWindow;

    const editor = createEditorBus({remote: hostWindow, remoteOrigin: ORIGIN, local: editorWindow});
    const host = createHostBus({remote: editorWindow, remoteOrigin: ORIGIN, local: hostWindow});

    return {editor, host, editorWindow, hostWindow};
}
