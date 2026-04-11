const keyboardMocks = vi.hoisted(() => {
    const parentStore = {
        has: vi.fn(),
        get: vi.fn(),
    };

    return {
        fireEvent: vi.fn(),
        parentStore,
    };
});

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

vi.mock('@enonic/lib-admin-ui/store/Store', () => ({
    Store: {
        parentInstance: () => keyboardMocks.parentStore,
    },
}));

import {setDragState, setTextEditing} from '../stores/registry';
import {initKeyboardHandling} from './keyboard-handler';

function createKeyboardEvent(type: string, options: {keyCode: number; ctrlKey?: boolean; altKey?: boolean}): KeyboardEvent {
    const event = new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        ctrlKey: options.ctrlKey,
        altKey: options.altKey,
    });

    Object.defineProperty(event, 'keyCode', {value: options.keyCode});
    Object.defineProperty(event, 'which', {value: options.keyCode});
    Object.defineProperty(event, 'charCode', {value: 0});

    return event;
}

describe('initKeyboardHandling', () => {
    afterEach(() => {
        keyboardMocks.fireEvent.mockReset();
        keyboardMocks.parentStore.has.mockReset();
        keyboardMocks.parentStore.get.mockReset();
        setTextEditing(false);
        setDragState(undefined);
    });

    it('forwards matching modifier shortcuts to the parent frame', () => {
        keyboardMocks.parentStore.has.mockReturnValue(true);
        keyboardMocks.parentStore.get.mockReturnValue({
            getActiveBindings: () => [
                {getCombination: () => 'mod+s'},
            ],
        });

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {keyCode: 83, ctrlKey: true});

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

    it('ignores keyboard events without a matching parent binding', () => {
        keyboardMocks.parentStore.has.mockReturnValue(true);
        keyboardMocks.parentStore.get.mockReturnValue({
            getActiveBindings: () => [
                {getCombination: () => 'mod+del'},
            ],
        });

        const stop = initKeyboardHandling();
        document.dispatchEvent(createKeyboardEvent('keydown', {keyCode: 83, ctrlKey: true}));

        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });

    it('leaves keyboard shortcuts alone while text editing is active', () => {
        keyboardMocks.parentStore.has.mockReturnValue(true);
        keyboardMocks.parentStore.get.mockReturnValue({
            getActiveBindings: () => [
                {getCombination: () => 'mod+s'},
            ],
        });
        setTextEditing(true);

        const stop = initKeyboardHandling();
        const event = createKeyboardEvent('keydown', {keyCode: 83, ctrlKey: true});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });

    it('leaves keyboard shortcuts alone while drag feedback is active', () => {
        keyboardMocks.parentStore.has.mockReturnValue(true);
        keyboardMocks.parentStore.get.mockReturnValue({
            getActiveBindings: () => [
                {getCombination: () => 'mod+s'},
            ],
        });
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
        const event = createKeyboardEvent('keydown', {keyCode: 83, ctrlKey: true});

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(keyboardMocks.fireEvent).not.toHaveBeenCalled();

        stop();
    });
});
