const contextDragMocks = vi.hoisted(() => ({
    createHandlers: [] as Array<(event: {getType(): string; isCreate(): boolean}) => void>,
    visibleHandlers: [] as Array<(event: {getType(): string; isVisible(): boolean}) => void>,
    addEvents: [] as Array<{path: {toString(): string}; componentType: {getShortName(): string}}>,
    startedPaths: [] as Array<{toString(): string} | undefined>,
    stoppedPaths: [] as Array<{toString(): string} | undefined>,
    droppedEvents: [] as Array<{from: {toString(): string} | undefined; to: {toString(): string}}>,
    canceledViews: [] as unknown[],
    setNextClickDisabled: vi.fn(),
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/CreateOrDestroyDraggableEvent', () => ({
    CreateOrDestroyDraggableEvent: {
        on: (handler: (event: {getType(): string; isCreate(): boolean}) => void) => {
            contextDragMocks.createHandlers.push(handler);
        },
        un: (handler: (event: {getType(): string; isCreate(): boolean}) => void) => {
            contextDragMocks.createHandlers = contextDragMocks.createHandlers.filter((current) => current !== handler);
        },
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetDraggableVisibleEvent', () => ({
    SetDraggableVisibleEvent: {
        on: (handler: (event: {getType(): string; isVisible(): boolean}) => void) => {
            contextDragMocks.visibleHandlers.push(handler);
        },
        un: (handler: (event: {getType(): string; isVisible(): boolean}) => void) => {
            contextDragMocks.visibleHandlers = contextDragMocks.visibleHandlers.filter((current) => current !== handler);
        },
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/AddComponentEvent', () => ({
    AddComponentEvent: class {
        private readonly path: {toString(): string};
        private readonly componentType: {getShortName(): string};

        constructor(path: {toString(): string}, componentType: {getShortName(): string}) {
            this.path = path;
            this.componentType = componentType;
        }

        fire(): void {
            contextDragMocks.addEvents.push({
                path: this.path,
                componentType: this.componentType,
            });
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStartedEvent', () => ({
    ComponentViewDragStartedEvent: class {
        private readonly path: {toString(): string} | undefined;

        constructor(path: {toString(): string} | undefined) {
            this.path = path;
        }

        fire(): void {
            contextDragMocks.startedPaths.push(this.path);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStoppedEvent', () => ({
    ComponentViewDragStoppedEvent: class {
        private readonly path: {toString(): string} | undefined;

        constructor(path: {toString(): string} | undefined) {
            this.path = path;
        }

        fire(): void {
            contextDragMocks.stoppedPaths.push(this.path);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/ComponentViewDragDroppedEvent', () => ({
    ComponentViewDragDroppedEvent: class {
        private readonly from: {toString(): string} | undefined;
        private readonly to: {toString(): string};

        constructor(from: {toString(): string} | undefined, to: {toString(): string}) {
            this.from = from;
            this.to = to;
        }

        fire(): void {
            contextDragMocks.droppedEvents.push({
                from: this.from,
                to: this.to,
            });
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/ComponentViewDragCanceledEvent', () => ({
    ComponentViewDragCanceledEvent: class {
        private readonly componentView: unknown;

        constructor(componentView: unknown) {
            this.componentView = componentView;
        }

        fire(): void {
            contextDragMocks.canceledViews.push(this.componentView);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/PageViewController', () => ({
    PageViewController: {
        get: () => ({
            setNextClickDisabled: contextDragMocks.setNextClickDisabled,
        }),
    },
}));

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {ComponentRecord} from '../../types';
import {rebuildIndex} from '../../stores/element-index';
import {$dragState, setDragState, setRegistry} from '../../stores/registry';
import {initContextWindowDrag} from './context-window-drag';

function createRecord(
    path: string,
    element: HTMLElement,
    type: ComponentRecord['type'],
    parentPath: string | undefined,
    children: string[] = [],
): ComponentRecord {
    return {
        path: ComponentPath.fromString(path),
        type,
        element,
        parentPath,
        children,
        empty: children.length === 0,
        error: false,
        descriptor: 'app:test',
        loading: false,
    };
}

function setRect(
    element: HTMLElement,
    {top, left, width, height}: {top: number; left: number; width: number; height: number},
): void {
    Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            top,
            left,
            width,
            height,
            right: left + width,
            bottom: top + height,
            x: left,
            y: top,
            toJSON: () => undefined,
        }),
    });
}

describe('initContextWindowDrag', () => {
    beforeEach(() => {
        Object.defineProperty(document, 'elementsFromPoint', {
            configurable: true,
            writable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        setRegistry({});
        setDragState(undefined);

        contextDragMocks.createHandlers = [];
        contextDragMocks.visibleHandlers = [];
        contextDragMocks.addEvents.length = 0;
        contextDragMocks.startedPaths.length = 0;
        contextDragMocks.stoppedPaths.length = 0;
        contextDragMocks.droppedEvents.length = 0;
        contextDragMocks.canceledViews.length = 0;
        contextDragMocks.setNextClickDisabled.mockReset();
    });

    it('adds a component into the hovered region through the new runtime drag session', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const first = document.createElement('article');
        first.dataset.portalComponentType = 'part';
        const second = document.createElement('article');
        second.dataset.portalComponentType = 'part';
        region.append(first, second);
        document.body.appendChild(region);

        setRect(first, {top: 20, left: 0, width: 300, height: 80});
        setRect(second, {top: 120, left: 0, width: 300, height: 80});

        const records = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0', '/main/1']),
            '/main/0': createRecord('/main/0', first, 'part', '/main'),
            '/main/1': createRecord('/main/1', second, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([first]);

        const stop = initContextWindowDrag();
        contextDragMocks.createHandlers[0]({
            getType: () => 'part',
            isCreate: () => true,
        });
        contextDragMocks.visibleHandlers[0]({
            getType: () => 'part',
            isVisible: () => true,
        });

        document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: 24, clientY: 32}));

        expect(contextDragMocks.startedPaths).toHaveLength(1);
        expect($dragState.get()).toMatchObject({
            itemType: 'part',
            targetPath: '/main',
            dropAllowed: true,
        });

        const placeholderAnchor = $dragState.get()?.placeholderElement;
        expect(placeholderAnchor).toBeInstanceOf(HTMLElement);

        document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: 24, clientY: 32}));

        expect(contextDragMocks.addEvents).toHaveLength(1);
        expect(contextDragMocks.addEvents[0].path.toString()).toBe('/main/0');
        expect(contextDragMocks.addEvents[0].componentType.getShortName()).toBe('part');
        expect(contextDragMocks.droppedEvents).toHaveLength(1);
        expect(contextDragMocks.droppedEvents[0].to.toString()).toBe('/main/0');
        expect(contextDragMocks.canceledViews).toHaveLength(0);
        expect(contextDragMocks.stoppedPaths).toHaveLength(1);
        expect(contextDragMocks.setNextClickDisabled).not.toHaveBeenCalled();
        expect($dragState.get()).toBeUndefined();
        expect(placeholderAnchor?.isConnected).toBe(false);

        stop();
    });

    it('rejects nested layout inserts and preserves the cancel/stopped contract', () => {
        const layout = document.createElement('div');
        layout.dataset.portalComponentType = 'layout';
        const region = document.createElement('section');
        region.dataset.portalRegion = 'left';
        layout.appendChild(region);
        document.body.appendChild(layout);

        const records = {
            '/main/0': createRecord('/main/0', layout, 'layout', '/main'),
            '/main/0/left': createRecord('/main/0/left', region, 'region', '/main/0'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([region]);

        const stop = initContextWindowDrag();
        contextDragMocks.createHandlers[0]({
            getType: () => 'layout',
            isCreate: () => true,
        });
        contextDragMocks.visibleHandlers[0]({
            getType: () => 'layout',
            isVisible: () => true,
        });

        document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: 14, clientY: 18}));

        expect($dragState.get()).toMatchObject({
            itemType: 'layout',
            targetPath: '/main/0/left',
            dropAllowed: false,
        });

        document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: 14, clientY: 18}));

        expect(contextDragMocks.addEvents).toHaveLength(0);
        expect(contextDragMocks.droppedEvents).toHaveLength(0);
        expect(contextDragMocks.canceledViews).toHaveLength(1);
        expect(contextDragMocks.stoppedPaths).toHaveLength(1);
        expect(contextDragMocks.setNextClickDisabled).not.toHaveBeenCalled();
        expect($dragState.get()).toBeUndefined();

        stop();
    });

    it('hides the drag chrome when the pointer leaves the iframe and cancels on destroy', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        document.body.appendChild(region);

        const records = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString()),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([region]);

        const stop = initContextWindowDrag();
        contextDragMocks.createHandlers[0]({
            getType: () => 'part',
            isCreate: () => true,
        });
        contextDragMocks.visibleHandlers[0]({
            getType: () => 'part',
            isVisible: () => true,
        });

        document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: 40, clientY: 40}));
        expect($dragState.get()).toBeDefined();

        contextDragMocks.visibleHandlers[0]({
            getType: () => 'part',
            isVisible: () => false,
        });

        expect($dragState.get()).toBeUndefined();
        expect(contextDragMocks.canceledViews).toHaveLength(0);
        expect(contextDragMocks.stoppedPaths).toHaveLength(0);

        contextDragMocks.createHandlers[0]({
            getType: () => 'part',
            isCreate: () => false,
        });

        expect(contextDragMocks.canceledViews).toHaveLength(1);
        expect(contextDragMocks.stoppedPaths).toHaveLength(1);

        stop();
    });
});
