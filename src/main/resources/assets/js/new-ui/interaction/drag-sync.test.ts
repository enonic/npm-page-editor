const dragSyncMocks = vi.hoisted(() => ({
    stateHandlers: [] as Array<(state: {
        itemType: string;
        itemLabel: string;
        sourcePath?: string;
        targetPath?: string;
        dropAllowed: boolean;
        message?: string;
        placeholderElement?: HTMLElement;
    } | undefined) => void>,
    getState: vi.fn(),
}));

vi.mock('../../page-editor/DragAndDrop', () => ({
    DragAndDrop: {
        get: () => ({
            getState: dragSyncMocks.getState,
            onStateChanged: (handler: typeof dragSyncMocks.stateHandlers[number]) => {
                dragSyncMocks.stateHandlers.push(handler);
            },
            unStateChanged: (handler: typeof dragSyncMocks.stateHandlers[number]) => {
                dragSyncMocks.stateHandlers = dragSyncMocks.stateHandlers.filter((current) => current !== handler);
            },
        }),
    },
}));

import {
    $contextMenuState,
    $dragState,
    $hoveredPath,
    openContextMenu,
    setDragState,
    setHoveredPath,
} from '../stores/registry';
import {initDragSync} from './drag-sync';

describe('initDragSync', () => {
    afterEach(() => {
        dragSyncMocks.stateHandlers = [];
        dragSyncMocks.getState.mockReset();
        setDragState(undefined);
        setHoveredPath(undefined);
    });

    it('mirrors legacy drag state into the new runtime and tracks pointer coordinates', () => {
        dragSyncMocks.getState.mockReturnValue(undefined);
        setHoveredPath('/main/0');
        openContextMenu({
            kind: 'component',
            path: '/main/0',
            x: 10,
            y: 20,
        });

        const stop = initDragSync();

        expect(dragSyncMocks.stateHandlers).toHaveLength(1);

        dragSyncMocks.stateHandlers[0]({
            itemType: 'part',
            itemLabel: 'Hero banner',
            sourcePath: '/main/0',
            targetPath: '/main',
            dropAllowed: true,
            message: undefined,
            placeholderElement: undefined,
        });

        expect($hoveredPath.get()).toBeUndefined();
        expect($contextMenuState.get()).toBeUndefined();
        expect($dragState.get()).toMatchObject({
            itemType: 'part',
            itemLabel: 'Hero banner',
            targetPath: '/main',
            dropAllowed: true,
        });

        document.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: 80,
            clientY: 120,
        }));

        expect($dragState.get()).toMatchObject({
            x: 80,
            y: 120,
        });

        dragSyncMocks.stateHandlers[0](undefined);
        expect($dragState.get()).toBeUndefined();

        stop();

        expect(dragSyncMocks.stateHandlers).toHaveLength(0);
        expect($dragState.get()).toBeUndefined();
    });
});
