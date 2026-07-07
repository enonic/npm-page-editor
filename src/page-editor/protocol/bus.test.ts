import {describe, expect, it, vi} from '@voidzero-dev/vite-plus-test';

import {FakeWindow} from '../../test/fake-bus';
import {createEditorBus, createHostBus} from './bus';
import {PROTOCOL_CHANNEL, PROTOCOL_VERSION} from './messages';

function createWindowPair(): {hostWindow: FakeWindow; editorWindow: FakeWindow} {
    const hostWindow = new FakeWindow();
    const editorWindow = new FakeWindow();
    hostWindow.incomingOrigin = 'https://site.example.com';
    editorWindow.incomingOrigin = 'https://admin.example.com';
    hostWindow.peer = editorWindow;
    editorWindow.peer = hostWindow;
    return {hostWindow, editorWindow};
}

describe('PageEditorBus', () => {
    it('delivers typed messages between editor and host', () => {
        const {hostWindow, editorWindow} = createWindowPair();
        const host = createHostBus({remote: editorWindow, remoteOrigin: 'https://site.example.com', local: hostWindow});
        const editor = createEditorBus({
            remote: hostWindow,
            remoteOrigin: 'https://admin.example.com',
            local: editorWindow,
        });

        const selected = vi.fn();
        host.on('component-selected', selected);
        editor.post('component-selected', {path: '/main/0', position: {x: 1, y: 2}});

        expect(selected).toHaveBeenCalledWith({path: '/main/0', position: {x: 1, y: 2}});

        const locked = vi.fn();
        editor.on('set-page-lock-state', locked);
        host.post('set-page-lock-state', {locked: true});

        expect(locked).toHaveBeenCalledWith({locked: true});
    });

    it('posts envelopes with channel, version, and pinned target origin', () => {
        const {hostWindow, editorWindow} = createWindowPair();
        const editor = createEditorBus({
            remote: hostWindow,
            remoteOrigin: 'https://admin.example.com',
            local: editorWindow,
        });

        editor.post('ready', {});

        expect(hostWindow.posted).toEqual([
            {
                message: {channel: PROTOCOL_CHANNEL, version: PROTOCOL_VERSION, type: 'ready', payload: {}},
                targetOrigin: 'https://admin.example.com',
            },
        ]);
    });

    it('ignores messages from unexpected origins', () => {
        const editorWindow = new FakeWindow();
        const editor = createEditorBus({
            remote: new FakeWindow(),
            remoteOrigin: 'https://admin.example.com',
            local: editorWindow,
        });

        const handler = vi.fn();
        editor.on('set-page-lock-state', handler);
        editorWindow.receive(
            {
                channel: PROTOCOL_CHANNEL,
                version: PROTOCOL_VERSION,
                type: 'set-page-lock-state',
                payload: {locked: true},
            },
            'https://evil.example.com',
        );

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores messages whose source is not the remote window', () => {
        const editorWindow = new FakeWindow();
        const editor = createEditorBus({
            remote: new FakeWindow(),
            remoteOrigin: 'https://admin.example.com',
            local: editorWindow,
        });

        const handler = vi.fn();
        editor.on('set-page-lock-state', handler);
        editorWindow.receive(
            {
                channel: PROTOCOL_CHANNEL,
                version: PROTOCOL_VERSION,
                type: 'set-page-lock-state',
                payload: {locked: true},
            },
            'https://admin.example.com',
            window,
        );

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores messages with a null source even when the origin matches', () => {
        const editorWindow = new FakeWindow();
        const editor = createEditorBus({
            remote: new FakeWindow(),
            remoteOrigin: 'https://admin.example.com',
            local: editorWindow,
        });

        const handler = vi.fn();
        editor.on('set-page-lock-state', handler);
        editorWindow.receive(
            {
                channel: PROTOCOL_CHANNEL,
                version: PROTOCOL_VERSION,
                type: 'set-page-lock-state',
                payload: {locked: true},
            },
            'https://admin.example.com',
        );

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores non-protocol messages (foreign envelopes, plain strings, other channels)', () => {
        const editorWindow = new FakeWindow();
        const remote = new FakeWindow();
        const editor = createEditorBus({remote, remoteOrigin: '*', local: editorWindow});

        const handler = vi.fn();
        const anyHandler = vi.fn();
        editor.on('set-page-lock-state', handler);
        editor.onAny(anyHandler);

        editorWindow.receive({eventName: 'SetPageLockStateEvent', detail: '{}'}, 'https://admin.example.com', remote);
        editorWindow.receive('plain string', 'https://admin.example.com', remote);
        editorWindow.receive(
            {channel: 'other:channel', type: 'set-page-lock-state'},
            'https://admin.example.com',
            remote,
        );

        expect(handler).not.toHaveBeenCalled();
        expect(anyHandler).not.toHaveBeenCalled();
    });

    it('warns once on protocol version mismatch but still delivers', () => {
        const editorWindow = new FakeWindow();
        const remote = new FakeWindow();
        const onVersionMismatch = vi.fn();
        const editor = createEditorBus({
            remote,
            remoteOrigin: '*',
            local: editorWindow,
            onVersionMismatch,
        });

        const handler = vi.fn();
        editor.on('set-page-lock-state', handler);

        const message = {channel: PROTOCOL_CHANNEL, version: 99, type: 'set-page-lock-state', payload: {locked: true}};
        editorWindow.receive(message, 'https://admin.example.com', remote);
        editorWindow.receive(message, 'https://admin.example.com', remote);

        expect(handler).toHaveBeenCalledTimes(2);
        expect(onVersionMismatch).toHaveBeenCalledTimes(1);
        expect(onVersionMismatch).toHaveBeenCalledWith(99);
    });

    it('treats a missing or non-numeric version as a mismatch but still delivers', () => {
        const editorWindow = new FakeWindow();
        const remote = new FakeWindow();
        const onVersionMismatch = vi.fn();
        const editor = createEditorBus({remote, remoteOrigin: '*', local: editorWindow, onVersionMismatch});

        const handler = vi.fn();
        editor.on('set-page-lock-state', handler);

        // Envelope with no `version` field at all.
        const message = {channel: PROTOCOL_CHANNEL, type: 'set-page-lock-state', payload: {locked: true}};
        editorWindow.receive(message, 'https://admin.example.com', remote);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(onVersionMismatch).toHaveBeenCalledTimes(1);
        expect(onVersionMismatch).toHaveBeenCalledWith(undefined);
    });

    it('supports unsubscribe and destroy', () => {
        const {hostWindow, editorWindow} = createWindowPair();
        const host = createHostBus({remote: editorWindow, remoteOrigin: 'https://site.example.com', local: hostWindow});
        const editor = createEditorBus({
            remote: hostWindow,
            remoteOrigin: 'https://admin.example.com',
            local: editorWindow,
        });

        const first = vi.fn();
        const second = vi.fn();
        const unsubscribe = host.on('page-locked', first);
        host.on('page-unlocked', second);

        unsubscribe();
        editor.post('page-locked', {});
        expect(first).not.toHaveBeenCalled();

        host.destroy();
        editor.post('page-unlocked', {});
        expect(second).not.toHaveBeenCalled();

        editor.destroy();
        editor.post('ready', {});
        expect(hostWindow.posted.filter(entry => (entry.message as {type?: string}).type === 'ready')).toHaveLength(0);
    });
});
