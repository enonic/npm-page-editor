const keyboardMocks = vi.hoisted(() => ({
    fireEvent: vi.fn(),
    cancelActiveDrag: vi.fn(),
    removedPaths: [] as string[],
}));

vi.mock('@enonic/lib-admin-ui/event/IframeEventBus', () => ({
    IframeEventBus: {
        get: () => ({
            fireEvent: keyboardMocks.fireEvent,
        }),
    },
}));

vi.mock('@enonic/lib-admin-ui/event/IframeEvent', () => ({
    IframeEvent: class {
        type: string;

        data?: unknown;

        constructor(type: string) {
            this.type = type;
        }

        setData(data: unknown): this {
            this.data = data;
            return this;
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/RemoveComponentRequest', () => ({
    RemoveComponentRequest: class {
        private readonly path: {toString(): string};

        constructor(path: {toString(): string}) {
            this.path = path;
        }

        fire(): void {
            keyboardMocks.removedPaths.push(this.path.toString());
        }
    },
}));

vi.mock('../drag/component-drag', () => ({
    cancelActiveDrag: keyboardMocks.cancelActiveDrag,
}));

import {
    $selectedPath,
    setDragState,
    setLocked,
    setModifyAllowed,
    setSelectedPath,
} from '../../stores/registry';
import {initKeyboardHandling} from './keyboard-handler';

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
    afterEach(() => {
        keyboardMocks.fireEvent.mockReset();
        keyboardMocks.cancelActiveDrag.mockReset();
        keyboardMocks.removedPaths.length = 0;
        setSelectedPath(undefined);
        setDragState(undefined);
        setLocked(false);
        setModifyAllowed(true);
    });

    it('relays modifier shortcuts to the parent and prevents the browser default', () => {
        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 's', keyCode: 83, ctrlKey: true});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(keyboardMocks.fireEvent).toHaveBeenCalledTimes(1);
        expect(keyboardMocks.fireEvent.mock.calls[0][0]).toMatchObject({
            type: 'editor-modifier-pressed',
            data: {
                type: 'keydown',
                config: expect.objectContaining({
                    ctrlKey: true,
                    keyCode: 83,
                }),
            },
        });

        stop();
    });

    it('relays function keys without preventing browser defaults', () => {
        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'F2', keyCode: 113});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(keyboardMocks.fireEvent).toHaveBeenCalledTimes(1);

        stop();
    });

    it('does not relay plain printable characters', () => {
        const stop = initKeyboardHandling();
        document.dispatchEvent(createKeyboardEvent('keydown', {key: 'a', keyCode: 65}));

        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });

    it('does not relay plain arrow keys', () => {
        const stop = initKeyboardHandling();

        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            const event = createKeyboardEvent('keydown', {key});
            document.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
        }

        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });

    it('does not relay Tab or Enter without a modifier', () => {
        const stop = initKeyboardHandling();

        for (const key of ['Tab', 'Enter']) {
            const event = createKeyboardEvent('keydown', {key});
            document.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
        }

        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });

    it('relays arrow keys when combined with a modifier', () => {
        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'ArrowDown', keyCode: 40, ctrlKey: true});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(keyboardMocks.fireEvent).toHaveBeenCalledTimes(1);

        stop();
    });

    it('removes the selected component on Delete', () => {
        setSelectedPath('/main/0');

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'Delete', keyCode: 46});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(keyboardMocks.removedPaths).toEqual(['/main/0']);
        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });

    it('removes the selected component on Backspace', () => {
        setSelectedPath('/main/1');

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'Backspace', keyCode: 8});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(keyboardMocks.removedPaths).toEqual(['/main/1']);

        stop();
    });

    it('skips removal when the page is locked but still consumes the event', () => {
        setSelectedPath('/main/0');
        setLocked(true);

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'Delete', keyCode: 46});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(keyboardMocks.removedPaths).toHaveLength(0);

        stop();
    });

    it('skips removal when modifications are not allowed', () => {
        setSelectedPath('/main/0');
        setModifyAllowed(false);

        const stop = initKeyboardHandling();
        document.dispatchEvent(createKeyboardEvent('keydown', {key: 'Backspace', keyCode: 8}));

        expect(keyboardMocks.removedPaths).toHaveLength(0);

        stop();
    });

    it('clears the current selection on Escape', () => {
        setSelectedPath('/main/0');

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {key: 'Escape', keyCode: 27});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect($selectedPath.get()).toBeUndefined();

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
        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });

    it('ignores keypress and keyup events entirely', () => {
        const stop = initKeyboardHandling();

        document.dispatchEvent(createKeyboardEvent('keypress', {key: 's', keyCode: 83, ctrlKey: true}));
        document.dispatchEvent(createKeyboardEvent('keyup', {key: 's', keyCode: 83, ctrlKey: true}));

        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });

    it('removes the keydown listener on teardown', () => {
        const stop = initKeyboardHandling();
        stop();

        document.dispatchEvent(createKeyboardEvent('keydown', {key: 's', keyCode: 83, ctrlKey: true}));

        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();
    });
});
