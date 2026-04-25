type Handler<TEvent> = (event: TEvent) => void;

interface PathEvent {
    getPath: () => string | undefined;
}

const busMocks = vi.hoisted(() => ({
    incomingSelectHandlers: [] as Handler<PathEvent>[],
    incomingDeselectHandlers: [] as Handler<PathEvent>[],
    outgoingSelectHandlers: [] as Handler<PathEvent>[],
    outgoingDeselectHandlers: [] as Handler<PathEvent>[],
    noopEvent: {on: () => undefined, un: () => undefined},
}));

function makeEventMock(bucket: Handler<PathEvent>[]) {
    return {
        on: (handler: Handler<PathEvent>) => bucket.push(handler),
        un: (handler: Handler<PathEvent>) => {
            const index = bucket.indexOf(handler);
            if (index >= 0) bucket.splice(index, 1);
        },
    };
}

vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/navigation/SelectComponentViewEvent', () => ({
    SelectComponentViewEvent: makeEventMock(busMocks.incomingSelectHandlers),
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/navigation/DeselectComponentViewEvent', () => ({
    DeselectComponentViewEvent: makeEventMock(busMocks.incomingDeselectHandlers),
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent', () => ({
    SelectComponentEvent: makeEventMock(busMocks.outgoingSelectHandlers),
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/DeselectComponentEvent', () => ({
    DeselectComponentEvent: makeEventMock(busMocks.outgoingDeselectHandlers),
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/AddComponentViewEvent', () => ({
    AddComponentViewEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/ComponentLoadedEvent', () => ({
    ComponentLoadedEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/DuplicateComponentViewEvent', () => ({
    DuplicateComponentViewEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/LoadComponentViewEvent', () => ({
    LoadComponentViewEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/MoveComponentViewEvent', () => ({
    MoveComponentViewEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/common/PageStateEvent', () => ({
    PageStateEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/RemoveComponentViewEvent', () => ({
    RemoveComponentViewEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/ResetComponentViewEvent', () => ({
    ResetComponentViewEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetComponentStateEvent', () => ({
    SetComponentStateEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetModifyAllowedEvent', () => ({
    SetModifyAllowedEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetPageLockStateEvent', () => ({
    SetPageLockStateEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/UpdateTextComponentViewEvent', () => ({
    UpdateTextComponentViewEvent: busMocks.noopEvent,
}));
vi.mock('@enonic/lib-contentstudio/app/page/Page', () => ({
    PageBuilder: class {
        fromJson() { return this; }
        build() { return null; }
    },
}));
vi.mock('@enonic/lib-contentstudio/app/wizard/page/PageState', () => ({
    PageState: {setState: vi.fn()},
}));

vi.mock('./reconcile', () => ({
    markLoading: vi.fn(),
    reconcilePage: vi.fn(),
    reconcileSubtree: vi.fn(),
    remapInteractionPath: vi.fn(),
}));

import {registerBusHandlers} from './bus-adapter';
import {
    $contextMenuState,
    $selectedPath,
    closeContextMenu,
    openContextMenu,
    setSelectedPath,
} from '../stores/registry';

function fireIncomingSelect(path: string | undefined): void {
    busMocks.incomingSelectHandlers.forEach((handler) => handler({getPath: () => path}));
}

function fireIncomingDeselect(path?: string): void {
    busMocks.incomingDeselectHandlers.forEach((handler) => handler({getPath: () => path}));
}

function fireOutgoingSelect(path: string | undefined): void {
    busMocks.outgoingSelectHandlers.forEach((handler) => handler({getPath: () => path}));
}

function fireOutgoingDeselect(path?: string): void {
    busMocks.outgoingDeselectHandlers.forEach((handler) => handler({getPath: () => path}));
}

describe('registerBusHandlers', () => {
    let stop: () => void;

    beforeEach(() => {
        vi.useFakeTimers();
        busMocks.incomingSelectHandlers.length = 0;
        busMocks.incomingDeselectHandlers.length = 0;
        busMocks.outgoingSelectHandlers.length = 0;
        busMocks.outgoingDeselectHandlers.length = 0;
        setSelectedPath(undefined);
        closeContextMenu();
        stop = registerBusHandlers({} as never);
    });

    afterEach(() => {
        stop();
        vi.useRealTimers();
    });

    it('mirrors outgoing SelectComponentEvent into the selection store', () => {
        fireOutgoingSelect('/main/parent');

        expect($selectedPath.get()).toBe('/main/parent');
    });

    it('mirrors outgoing DeselectComponentEvent, closing any open context menu', () => {
        setSelectedPath('/main/0');
        openContextMenu({kind: 'component', path: '/main/0', x: 0, y: 0});

        fireOutgoingDeselect('/main/0');

        expect($selectedPath.get()).toBeUndefined();
        expect($contextMenuState.get()).toBeUndefined();
    });

    it('swallows the deselect echo that follows an outgoing select', () => {
        openContextMenu({kind: 'component', path: '/main/0', x: 0, y: 0});

        fireOutgoingSelect('/main/0');
        fireIncomingDeselect();

        expect($selectedPath.get()).toBe('/main/0');
        expect($contextMenuState.get()).toMatchObject({path: '/main/0'});
    });

    it('processes a later deselect after the echo window closes', () => {
        openContextMenu({kind: 'component', path: '/main/0', x: 0, y: 0});

        fireOutgoingSelect('/main/0');
        vi.runAllTimers();
        fireIncomingDeselect();

        expect($selectedPath.get()).toBeUndefined();
        expect($contextMenuState.get()).toBeUndefined();
    });

    it('accepts incoming SelectComponentViewEvent from tree-originated selections', () => {
        fireIncomingSelect('/main/1');

        expect($selectedPath.get()).toBe('/main/1');
    });

    it('does not arm the swallow for tree-originated incoming selects', () => {
        fireIncomingSelect('/main/1');
        fireIncomingDeselect();

        expect($selectedPath.get()).toBeUndefined();
    });
});
