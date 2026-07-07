const keyboardMocks = vi.hoisted(() => ({
    cancelActiveDrag: vi.fn(),
}));

vi.mock('../drag/component-drag', () => ({
    cancelActiveDrag: keyboardMocks.cancelActiveDrag,
}));

import type {EditorToHostType} from '../../../protocol';
import type {ComponentRecord} from '../../types';

import {ComponentPath} from '../../../protocol';
import {
    $selectedPath,
    setDragState,
    setLocked,
    setModifyAllowed,
    setRegistry,
    setSelectedPath,
} from '../../stores/registry';
import {destroyTransport, getBus, initTransport} from '../../transport/bus';
import {initKeyboardHandling} from './keyboard-handler';

type PostCall = {type: EditorToHostType; payload: Record<string, unknown>};

let posted: PostCall[];

const relayCalls = (): PostCall[] => posted.filter(call => call.type === 'keyboard-relay');
const removeCalls = (): PostCall[] => posted.filter(call => call.type === 'remove-component-requested');
const deselectCalls = (): PostCall[] => posted.filter(call => call.type === 'component-deselected');

function registerRecord(
    path: string,
    type: ComponentRecord['type'] = 'part',
    parentPath: string | undefined = '/main',
): void {
    const record: ComponentRecord = {
        path: ComponentPath.fromString(path),
        type,
        element: document.createElement('div'),
        parentPath,
        children: [],
        empty: false,
        error: false,
        descriptor: 'app:part',
        loading: false,
    };

    setRegistry({[path]: record});
}

type KeyboardEventOptions = {
    key: string;
    keyCode?: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
};

function createKeyboardEvent(type: string, options: KeyboardEventOptions): KeyboardEvent {
    const event = new KeyboardEvent(type, {
        key: options.key,
        bubbles: true,
        cancelable: true,
        ctrlKey: options.ctrlKey,
        metaKey: options.metaKey,
        altKey: options.altKey,
        shiftKey: options.shiftKey,
    });

    Object.defineProperty(event, 'keyCode', {value: options.keyCode ?? 0});
    Object.defineProperty(event, 'charCode', {value: 0});

    return event;
}

describe('initKeyboardHandling', () => {
    beforeEach(() => {
        posted = [];
        initTransport();
        vi.spyOn(getBus()!, 'post').mockImplementation((type, payload) => {
            posted.push({type, payload} as PostCall);
        });
    });

    afterEach(() => {
        keyboardMocks.cancelActiveDrag.mockReset();
        setRegistry({});
        setSelectedPath(undefined);
        setDragState(undefined);
        setLocked(false);
        setModifyAllowed(true);
        destroyTransport();
        vi.restoreAllMocks();
    });

    it('relays modifier shortcuts to the parent and prevents the browser default', () => {
        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 's', keyCode: 83, ctrlKey: true});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(relayCalls()).toHaveLength(1);
        expect(relayCalls()[0].payload).toMatchObject({
            type: 'keydown',
            init: expect.objectContaining({
                ctrlKey: true,
                key: 's',
                keyCode: 83,
            }),
        });

        stop();
    });

    it('relays function keys without preventing browser defaults', () => {
        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'F2', keyCode: 113});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(relayCalls()).toHaveLength(1);

        stop();
    });

    it('does not relay plain printable characters', () => {
        const stop = initKeyboardHandling();
        document.dispatchEvent(createKeyboardEvent('keydown', {key: 'a', keyCode: 65}));

        expect(relayCalls()).toHaveLength(0);

        stop();
    });

    it('does not relay plain arrow keys', () => {
        const stop = initKeyboardHandling();

        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            const event = createKeyboardEvent('keydown', {key});
            document.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
        }

        expect(relayCalls()).toHaveLength(0);

        stop();
    });

    it('does not relay Tab or Enter without a modifier', () => {
        const stop = initKeyboardHandling();

        for (const key of ['Tab', 'Enter']) {
            const event = createKeyboardEvent('keydown', {key});
            document.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
        }

        expect(relayCalls()).toHaveLength(0);

        stop();
    });

    it('relays arrow keys when combined with a modifier', () => {
        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'ArrowDown', keyCode: 40, ctrlKey: true});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(relayCalls()).toHaveLength(1);

        stop();
    });

    it('removes the selected component on Delete', () => {
        registerRecord('/main/0');
        setSelectedPath('/main/0');

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'Delete', keyCode: 46});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(removeCalls()).toEqual([{type: 'remove-component-requested', payload: {path: '/main/0'}}]);
        expect(relayCalls()).toHaveLength(0);

        stop();
    });

    it('removes the selected component on Backspace', () => {
        registerRecord('/main/1');
        setSelectedPath('/main/1');

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'Backspace', keyCode: 8});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(removeCalls()).toEqual([{type: 'remove-component-requested', payload: {path: '/main/1'}}]);

        stop();
    });

    it('skips removal for region and page selections', () => {
        for (const [path, type] of [
            ['/main', 'region'],
            ['/', 'page'],
        ] as const) {
            registerRecord(path, type, undefined);
            setSelectedPath(path);

            const stop = initKeyboardHandling();
            const event = createKeyboardEvent('keydown', {key: 'Delete', keyCode: 46});
            document.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
            expect(removeCalls()).toHaveLength(0);

            stop();
        }
    });

    it('skips removal when the page is locked but still consumes the event', () => {
        registerRecord('/main/0');
        setSelectedPath('/main/0');
        setLocked(true);

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'Delete', keyCode: 46});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(removeCalls()).toHaveLength(0);

        stop();
    });

    it('skips removal when modifications are not allowed', () => {
        setSelectedPath('/main/0');
        setModifyAllowed(false);

        const stop = initKeyboardHandling();
        document.dispatchEvent(createKeyboardEvent('keydown', {key: 'Backspace', keyCode: 8}));

        expect(removeCalls()).toHaveLength(0);

        stop();
    });

    it('clears the current selection on Escape and notifies the host', () => {
        setSelectedPath('/main/0');

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'Escape', keyCode: 27});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect($selectedPath.get()).toBeUndefined();
        expect(deselectCalls()).toEqual([{type: 'component-deselected', payload: {path: '/main/0'}}]);

        stop();
    });

    it('cancels an active drag on Escape and ignores other keys during drag', () => {
        setDragState({
            itemType: 'part',
            itemLabel: 'Hero',
            sourcePath: '/main/0',
            targetPath: '/main',
            dropAllowed: true,
            message: undefined,
            placeholderElement: undefined,
            x: 24,
            y: 48,
        });

        const stop = initKeyboardHandling();

        const escape = createKeyboardEvent('keydown', {key: 'Escape', keyCode: 27});
        document.dispatchEvent(escape);

        expect(escape.defaultPrevented).toBe(true);
        expect(keyboardMocks.cancelActiveDrag).toHaveBeenCalledTimes(1);

        const save = createKeyboardEvent('keydown', {key: 's', keyCode: 83, ctrlKey: true});
        document.dispatchEvent(save);

        expect(save.defaultPrevented).toBe(false);
        expect(relayCalls()).toHaveLength(0);

        stop();
    });

    it('ignores keypress and keyup events entirely', () => {
        const stop = initKeyboardHandling();

        document.dispatchEvent(createKeyboardEvent('keypress', {key: 's', keyCode: 83, ctrlKey: true}));
        document.dispatchEvent(createKeyboardEvent('keyup', {key: 's', keyCode: 83, ctrlKey: true}));

        expect(relayCalls()).toHaveLength(0);

        stop();
    });

    it('removes the keydown listener on teardown', () => {
        const stop = initKeyboardHandling();
        stop();

        document.dispatchEvent(createKeyboardEvent('keydown', {key: 's', keyCode: 83, ctrlKey: true}));

        expect(relayCalls()).toHaveLength(0);
    });
});
