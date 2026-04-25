const componentDragMocks = vi.hoisted(() => ({
    startedPaths: [] as Array<{toString(): string}>,
    stoppedPaths: [] as Array<{toString(): string}>,
    droppedEvents: [] as Array<{from: {toString(): string}; to: {toString(): string}}>,
    canceledViews: [] as unknown[],
    moveEvents: [] as Array<{from: {toString(): string}; to: {toString(): string}}>,
    setNextClickDisabled: vi.fn(),
    getLegacyItemViewLabel: vi.fn() as ReturnType<typeof vi.fn<() => string | undefined>>,
    setLegacyItemViewMoving: vi.fn(),
    deselectLegacyItemView: vi.fn(),
    legacyFragmentContainsLayout: vi.fn() as ReturnType<typeof vi.fn<() => boolean>>,
    resolveItemView: vi.fn(),
}));

vi.mock('../../bridge', () => ({
    getLegacyItemViewLabel: componentDragMocks.getLegacyItemViewLabel,
    setLegacyItemViewMoving: componentDragMocks.setLegacyItemViewMoving,
    deselectLegacyItemView: componentDragMocks.deselectLegacyItemView,
    legacyFragmentContainsLayout: componentDragMocks.legacyFragmentContainsLayout,
    resolveItemView: componentDragMocks.resolveItemView,
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStartedEvent', () => ({
    ComponentViewDragStartedEvent: class {
        private readonly path: {toString(): string};

        constructor(path: {toString(): string}) {
            this.path = path;
        }

        fire(): void {
            componentDragMocks.startedPaths.push(this.path);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStoppedEvent', () => ({
    ComponentViewDragStoppedEvent: class {
        private readonly path: {toString(): string};

        constructor(path: {toString(): string}) {
            this.path = path;
        }

        fire(): void {
            componentDragMocks.stoppedPaths.push(this.path);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/ComponentViewDragDroppedEvent', () => ({
    ComponentViewDragDroppedEvent: class {
        private readonly from: {toString(): string};
        private readonly to: {toString(): string};

        constructor(from: {toString(): string}, to: {toString(): string}) {
            this.from = from;
            this.to = to;
        }

        fire(): void {
            componentDragMocks.droppedEvents.push({
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
            componentDragMocks.canceledViews.push(this.componentView);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/MoveComponentEvent', () => ({
    MoveComponentEvent: class {
        private readonly from: {toString(): string};
        private readonly to: {toString(): string};

        constructor(from: {toString(): string}, to: {toString(): string}) {
            this.from = from;
            this.to = to;
        }

        fire(): void {
            componentDragMocks.moveEvents.push({
                from: this.from,
                to: this.to,
            });
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/PageViewController', () => ({
    PageViewController: {
        get: () => ({
            setNextClickDisabled: componentDragMocks.setNextClickDisabled,
        }),
    },
}));

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {ComponentRecord} from '../../types';
import {rebuildIndex} from '../../stores/element-index';
import {
    $dragState,
    $hoveredPath,
    $selectedPath,
    setDragState,
    setHoveredPath,
    setRegistry,
    setSelectedPath,
} from '../../stores/registry';
import {initComponentDrag} from './component-drag';

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

function dispatchMouseDown(target: HTMLElement, x: number, y: number): void {
    target.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: x, clientY: y}));
}

function dispatchMouseMove(x: number, y: number): void {
    document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: x, clientY: y}));
}

function dispatchMouseUp(x: number, y: number): void {
    document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: x, clientY: y}));
}

describe('initComponentDrag', () => {
    beforeEach(() => {
        Object.defineProperty(document, 'elementsFromPoint', {
            configurable: true,
            writable: true,
            value: vi.fn(),
        });

        componentDragMocks.getLegacyItemViewLabel.mockReturnValue(undefined);
        componentDragMocks.legacyFragmentContainsLayout.mockReturnValue(false);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        setRegistry({});
        setDragState(undefined);
        setHoveredPath(undefined);
        setSelectedPath(undefined);

        componentDragMocks.startedPaths.length = 0;
        componentDragMocks.stoppedPaths.length = 0;
        componentDragMocks.droppedEvents.length = 0;
        componentDragMocks.canceledViews.length = 0;
        componentDragMocks.moveEvents.length = 0;
        componentDragMocks.setNextClickDisabled.mockReset();
        componentDragMocks.getLegacyItemViewLabel.mockReset();
        componentDragMocks.setLegacyItemViewMoving.mockReset();
        componentDragMocks.deselectLegacyItemView.mockReset();
        componentDragMocks.legacyFragmentContainsLayout.mockReset();
        componentDragMocks.resolveItemView.mockReset();
    });

    it('moves a component to a new position within the same region', () => {
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

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0', '/main/1']),
            '/main/0': createRecord('/main/0', first, 'part', '/main'),
            '/main/1': createRecord('/main/1', second, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        // Hover over second component during drag
        vi.mocked(document.elementsFromPoint).mockReturnValue([second]);

        setHoveredPath('/main/0');
        setSelectedPath('/main/0');

        const stop = initComponentDrag();

        // Mousedown on first component
        dispatchMouseDown(first, 50, 50);
        // Move past threshold (8px)
        dispatchMouseMove(50, 70);

        // Drag started
        expect(componentDragMocks.startedPaths).toHaveLength(1);
        expect(componentDragMocks.startedPaths[0].toString()).toBe('/main/0');

        // Source element hidden
        expect(first.style.display).toBe('none');
        expect(componentDragMocks.setLegacyItemViewMoving).toHaveBeenCalledWith('/main/0', true);
        expect(componentDragMocks.deselectLegacyItemView).toHaveBeenCalledWith('/main/0');

        // Hover and selection cleared
        expect($hoveredPath.get()).toBeUndefined();
        expect($selectedPath.get()).toBeUndefined();

        // Drag state published with target
        expect($dragState.get()).toMatchObject({
            itemType: 'part',
            sourcePath: '/main/0',
            targetPath: '/main',
            dropAllowed: true,
        });

        const placeholderAnchor = $dragState.get()?.placeholderElement;
        expect(placeholderAnchor).toBeInstanceOf(HTMLElement);

        // Drop
        dispatchMouseUp(50, 160);

        expect(componentDragMocks.moveEvents).toHaveLength(1);
        expect(componentDragMocks.moveEvents[0].from.toString()).toBe('/main/0');
        expect(componentDragMocks.droppedEvents).toHaveLength(1);
        expect(componentDragMocks.droppedEvents[0].from.toString()).toBe('/main/0');
        expect(componentDragMocks.stoppedPaths).toHaveLength(1);
        expect(componentDragMocks.canceledViews).toHaveLength(0);
        expect(componentDragMocks.setNextClickDisabled).toHaveBeenCalledWith(true);

        // Source restored
        expect(first.style.display).not.toBe('none');
        expect(componentDragMocks.setLegacyItemViewMoving).toHaveBeenCalledWith('/main/0', false);

        // Drag state cleared
        expect($dragState.get()).toBeUndefined();
        expect(placeholderAnchor?.isConnected).toBe(false);

        stop();
    });

    it('cancels drag when dropped outside any region', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const part = document.createElement('article');
        part.dataset.portalComponentType = 'part';
        region.appendChild(part);
        document.body.appendChild(region);

        setRect(part, {top: 20, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', part, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        // No region under cursor during drop
        vi.mocked(document.elementsFromPoint).mockReturnValue([]);

        const stop = initComponentDrag();

        dispatchMouseDown(part, 50, 50);
        dispatchMouseMove(50, 70);

        expect(componentDragMocks.startedPaths).toHaveLength(1);
        expect($dragState.get()).toMatchObject({sourcePath: '/main/0', dropAllowed: false});

        dispatchMouseUp(50, 70);

        expect(componentDragMocks.canceledViews).toHaveLength(1);
        expect(componentDragMocks.stoppedPaths).toHaveLength(1);
        expect(componentDragMocks.moveEvents).toHaveLength(0);
        expect(componentDragMocks.droppedEvents).toHaveLength(0);
        expect(componentDragMocks.setNextClickDisabled).not.toHaveBeenCalled();

        // Source restored
        expect(part.style.display).not.toBe('none');
        expect($dragState.get()).toBeUndefined();

        stop();
    });

    it('rejects nested layout moves', () => {
        const outerLayout = document.createElement('div');
        outerLayout.dataset.portalComponentType = 'layout';
        const innerRegion = document.createElement('section');
        innerRegion.dataset.portalRegion = 'left';
        outerLayout.appendChild(innerRegion);

        const topRegion = document.createElement('section');
        topRegion.dataset.portalRegion = 'main';
        const layoutComponent = document.createElement('div');
        layoutComponent.dataset.portalComponentType = 'layout';
        topRegion.append(outerLayout, layoutComponent);
        document.body.appendChild(topRegion);

        setRect(layoutComponent, {top: 200, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', topRegion, 'region', ComponentPath.root().toString(), ['/main/0', '/main/1']),
            '/main/0': createRecord('/main/0', outerLayout, 'layout', '/main', ['/main/0/left']),
            '/main/0/left': createRecord('/main/0/left', innerRegion, 'region', '/main/0'),
            '/main/1': createRecord('/main/1', layoutComponent, 'layout', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        // Dragging layout over region inside another layout
        vi.mocked(document.elementsFromPoint).mockReturnValue([innerRegion]);

        const stop = initComponentDrag();

        dispatchMouseDown(layoutComponent, 150, 240);
        dispatchMouseMove(150, 100);

        expect($dragState.get()).toMatchObject({
            itemType: 'layout',
            sourcePath: '/main/1',
            targetPath: '/main/0/left',
            dropAllowed: false,
        });
        expect($dragState.get()?.message).toBeDefined();

        // Dropping on forbidden target → cancel
        dispatchMouseUp(150, 100);

        expect(componentDragMocks.moveEvents).toHaveLength(0);
        expect(componentDragMocks.canceledViews).toHaveLength(1);
        expect(componentDragMocks.stoppedPaths).toHaveLength(1);

        stop();
    });

    it('rejects fragment containing layout into layout region', () => {
        const outerLayout = document.createElement('div');
        outerLayout.dataset.portalComponentType = 'layout';
        const innerRegion = document.createElement('section');
        innerRegion.dataset.portalRegion = 'left';
        outerLayout.appendChild(innerRegion);

        const topRegion = document.createElement('section');
        topRegion.dataset.portalRegion = 'main';
        const fragment = document.createElement('div');
        fragment.dataset.portalComponentType = 'fragment';
        topRegion.append(outerLayout, fragment);
        document.body.appendChild(topRegion);

        setRect(fragment, {top: 200, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', topRegion, 'region', ComponentPath.root().toString(), ['/main/0', '/main/1']),
            '/main/0': createRecord('/main/0', outerLayout, 'layout', '/main', ['/main/0/left']),
            '/main/0/left': createRecord('/main/0/left', innerRegion, 'region', '/main/0'),
            '/main/1': createRecord('/main/1', fragment, 'fragment', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        componentDragMocks.legacyFragmentContainsLayout.mockReturnValue(true);
        vi.mocked(document.elementsFromPoint).mockReturnValue([innerRegion]);

        const stop = initComponentDrag();

        dispatchMouseDown(fragment, 150, 240);
        dispatchMouseMove(150, 100);

        expect($dragState.get()).toMatchObject({
            itemType: 'fragment',
            sourcePath: '/main/1',
            targetPath: '/main/0/left',
            dropAllowed: false,
        });

        dispatchMouseUp(150, 100);

        expect(componentDragMocks.moveEvents).toHaveLength(0);
        expect(componentDragMocks.canceledViews).toHaveLength(1);

        stop();
    });

    it('cancels drag on window blur', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const part = document.createElement('article');
        part.dataset.portalComponentType = 'part';
        region.appendChild(part);
        document.body.appendChild(region);

        setRect(part, {top: 20, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', part, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([]);

        const stop = initComponentDrag();

        dispatchMouseDown(part, 50, 50);
        dispatchMouseMove(50, 70);

        expect($dragState.get()).toBeDefined();

        window.dispatchEvent(new Event('blur'));

        expect($dragState.get()).toBeUndefined();
        expect(componentDragMocks.canceledViews).toHaveLength(1);
        expect(componentDragMocks.stoppedPaths).toHaveLength(1);
        expect(part.style.display).not.toBe('none');

        stop();
    });

    it('does not start drag below threshold distance', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const part = document.createElement('article');
        part.dataset.portalComponentType = 'part';
        region.appendChild(part);
        document.body.appendChild(region);

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', part, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initComponentDrag();

        dispatchMouseDown(part, 50, 50);
        // Move only 5px (below 8px threshold)
        dispatchMouseMove(53, 53);

        expect($dragState.get()).toBeUndefined();
        expect(componentDragMocks.startedPaths).toHaveLength(0);

        stop();
    });

    it('ignores right click and non-primary button', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const part = document.createElement('article');
        part.dataset.portalComponentType = 'part';
        region.appendChild(part);
        document.body.appendChild(region);

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', part, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initComponentDrag();

        part.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 2, clientX: 50, clientY: 50}));
        dispatchMouseMove(50, 70);

        expect($dragState.get()).toBeUndefined();
        expect(componentDragMocks.startedPaths).toHaveLength(0);

        stop();
    });

    it('does not drag page or region records', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        document.body.appendChild(region);

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString()),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initComponentDrag();

        dispatchMouseDown(region, 50, 50);
        dispatchMouseMove(50, 70);

        expect($dragState.get()).toBeUndefined();
        expect(componentDragMocks.startedPaths).toHaveLength(0);

        stop();
    });

    it('uses legacy item view label when available', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const part = document.createElement('article');
        part.dataset.portalComponentType = 'part';
        region.appendChild(part);
        document.body.appendChild(region);

        setRect(part, {top: 20, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', part, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([]);
        componentDragMocks.getLegacyItemViewLabel.mockReturnValue('Hero Banner');

        const stop = initComponentDrag();

        dispatchMouseDown(part, 50, 50);
        dispatchMouseMove(50, 70);

        expect($dragState.get()?.itemLabel).toBe('Hero Banner');

        // Cancel for cleanup
        window.dispatchEvent(new Event('blur'));
        stop();
    });

    it('falls back to capitalized type when legacy label is unavailable', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const part = document.createElement('article');
        part.dataset.portalComponentType = 'part';
        region.appendChild(part);
        document.body.appendChild(region);

        setRect(part, {top: 20, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', part, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([]);
        componentDragMocks.getLegacyItemViewLabel.mockReturnValue(undefined);

        const stop = initComponentDrag();

        dispatchMouseDown(part, 50, 50);
        dispatchMouseMove(50, 70);

        expect($dragState.get()?.itemLabel).toBe('Part');

        window.dispatchEvent(new Event('blur'));
        stop();
    });

    it('cleans up active drag on teardown', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const part = document.createElement('article');
        part.dataset.portalComponentType = 'part';
        region.appendChild(part);
        document.body.appendChild(region);

        setRect(part, {top: 20, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', part, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([]);

        const stop = initComponentDrag();

        dispatchMouseDown(part, 50, 50);
        dispatchMouseMove(50, 70);

        expect($dragState.get()).toBeDefined();

        stop();

        expect($dragState.get()).toBeUndefined();
        expect(componentDragMocks.canceledViews).toHaveLength(1);
        expect(componentDragMocks.stoppedPaths).toHaveLength(1);
        expect(part.style.display).not.toBe('none');
    });

    it('excludes source from insertion index when dragging within the same region', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const first = document.createElement('article');
        first.dataset.portalComponentType = 'part';
        const second = document.createElement('article');
        second.dataset.portalComponentType = 'part';
        const third = document.createElement('article');
        third.dataset.portalComponentType = 'part';
        region.append(first, second, third);
        document.body.appendChild(region);

        setRect(first, {top: 0, left: 0, width: 300, height: 80});
        setRect(second, {top: 100, left: 0, width: 300, height: 80});
        setRect(third, {top: 200, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0', '/main/1', '/main/2']),
            '/main/0': createRecord('/main/0', first, 'part', '/main'),
            '/main/1': createRecord('/main/1', second, 'part', '/main'),
            '/main/2': createRecord('/main/2', third, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        // Cursor at bottom half of third component (after third when source excluded)
        vi.mocked(document.elementsFromPoint).mockReturnValue([third]);

        const stop = initComponentDrag();

        // Drag first component
        dispatchMouseDown(first, 150, 40);
        dispatchMouseMove(150, 250);

        // With source (/main/0) excluded, children are [second, third]
        // Hovering bottom half of third → index 2
        // Target is /main/<index> where index accounts for skipped source
        const state = $dragState.get();
        expect(state).toMatchObject({
            sourcePath: '/main/0',
            targetPath: '/main',
            dropAllowed: true,
        });

        dispatchMouseUp(150, 250);

        expect(componentDragMocks.moveEvents).toHaveLength(1);

        stop();
    });

    it('skips not-draggable elements', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const part = document.createElement('article');
        part.dataset.portalComponentType = 'part';
        part.classList.add('not-draggable');
        region.appendChild(part);
        document.body.appendChild(region);

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', part, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initComponentDrag();

        dispatchMouseDown(part, 50, 50);
        dispatchMouseMove(50, 70);

        expect($dragState.get()).toBeUndefined();
        expect(componentDragMocks.startedPaths).toHaveLength(0);

        stop();
    });

    it('ignores mousedown when drag is already active', () => {
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

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0', '/main/1']),
            '/main/0': createRecord('/main/0', first, 'part', '/main'),
            '/main/1': createRecord('/main/1', second, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([]);

        const stop = initComponentDrag();

        // Start first drag
        dispatchMouseDown(first, 50, 50);
        dispatchMouseMove(50, 70);
        expect(componentDragMocks.startedPaths).toHaveLength(1);

        // Set drag state so second mousedown is blocked
        // (drag state is already set by beginDrag)
        expect($dragState.get()).toBeDefined();

        // Try second mousedown — should be ignored because $dragState is set
        dispatchMouseDown(second, 150, 140);
        dispatchMouseMove(150, 160);

        // Still only one drag started
        expect(componentDragMocks.startedPaths).toHaveLength(1);
        expect($dragState.get()?.sourcePath).toBe('/main/0');

        window.dispatchEvent(new Event('blur'));
        stop();
    });
});
