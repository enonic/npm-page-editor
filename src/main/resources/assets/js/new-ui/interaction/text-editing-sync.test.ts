const textEditingMocks = vi.hoisted(() => ({
    handlers: [] as Array<(event: {isEditMode(): boolean}) => void>,
    isTextEditMode: vi.fn(),
}));

vi.mock('@enonic/lib-contentstudio/page-editor/PageViewController', () => ({
    PageViewController: {
        get: () => ({
            isTextEditMode: textEditingMocks.isTextEditMode,
        }),
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/TextEditModeChangedEvent', () => ({
    TextEditModeChangedEvent: {
        on: (handler: (event: {isEditMode(): boolean}) => void) => {
            textEditingMocks.handlers.push(handler);
        },
        un: (handler: (event: {isEditMode(): boolean}) => void) => {
            textEditingMocks.handlers = textEditingMocks.handlers.filter((current) => current !== handler);
        },
    },
}));

import {
    $contextMenuState,
    $hoveredPath,
    $textEditing,
    openContextMenu,
    setHoveredPath,
    setTextEditing,
} from '../stores/registry';
import {initTextEditingSync} from './text-editing-sync';

describe('initTextEditingSync', () => {
    afterEach(() => {
        textEditingMocks.handlers = [];
        textEditingMocks.isTextEditMode.mockReset();
        setTextEditing(false);
        setHoveredPath(undefined);
    });

    it('mirrors legacy text edit mode into the new runtime and clears transient chrome', () => {
        textEditingMocks.isTextEditMode.mockReturnValue(false);
        setHoveredPath('/main/0');
        openContextMenu({
            kind: 'component',
            path: '/main/0',
            x: 10,
            y: 20,
        });

        const stop = initTextEditingSync();

        expect($textEditing.get()).toBe(false);
        expect(textEditingMocks.handlers).toHaveLength(1);

        textEditingMocks.handlers[0]({
            isEditMode: () => true,
        });

        expect($textEditing.get()).toBe(true);
        expect($hoveredPath.get()).toBeUndefined();
        expect($contextMenuState.get()).toBeUndefined();

        stop();

        expect($textEditing.get()).toBe(false);
        expect(textEditingMocks.handlers).toHaveLength(0);
    });
});
