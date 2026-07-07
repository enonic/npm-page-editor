const componentDragMocks = vi.hoisted(() => ({
    setNextClickDisabled: vi.fn(),
    elementContainsLayout: vi.fn(),
}));

vi.mock('../../dom/mutate', () => ({
    elementContainsLayout: componentDragMocks.elementContainsLayout,
}));

vi.mock('../common/next-click', () => ({
    setNextClickDisabled: componentDragMocks.setNextClickDisabled,
}));

import type {EditorToHostType} from '../../../protocol';
import type {ComponentRecord} from '../../types';

import {ComponentPath} from '../../../protocol';
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
import {destroyTransport, getBus, initTransport} from '../../transport/bus';
import {initComponentDrag} from './component-drag';

type PostCall = {type: EditorToHostType; payload: {path?: string; from?: string; to?: string}};

let posted: PostCall[];

const calls = (type: EditorToHostType): PostCall[] => posted.filter(call => call.type === type);

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
        posted = [];
        initTransport();
        vi.spyOn(getBus()!, 'post').mockImplementation((type, payload) => {
            posted.push({type, payload} as PostCall);
        });

        Object.defineProperty(document, 'elementsFromPoint', {
            configurable: true,
            writable: true,
            value: vi.fn(),
        });

        componentDragMocks.elementContainsLayout.mockReturnValue(false);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        setRegistry({});
        setDragState(undefined);
        setHoveredPath(undefined);
        setSelectedPath(undefined);
        destroyTransport();

        componentDragMocks.setNextClickDisabled.mockReset();
        componentDragMocks.elementContainsLayout.mockReset();
        vi.restoreAllMocks();
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
        expect(calls('drag-started')).toHaveLength(1);
        expect(calls('drag-started')[0].payload.path).toBe('/main/0');

        // Source element hidden
        expect(first.style.display).toBe('none');

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

        expect(calls('move-component-requested')).toHaveLength(1);
        expect(calls('move-component-requested')[0].payload.from).toBe('/main/0');
        expect(calls('drag-dropped')).toHaveLength(1);
        expect(calls('drag-dropped')[0].payload.from).toBe('/main/0');
        expect(calls('drag-stopped')).toHaveLength(1);
        expect(calls('drag-canceled')).toHaveLength(0);
        expect(componentDragMocks.setNextClickDisabled).toHaveBeenCalledWith(true);

        // Source restored
        expect(first.style.display).not.toBe('none');

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

        expect(calls('drag-started')).toHaveLength(1);
        expect($dragState.get()).toMatchObject({sourcePath: '/main/0', dropAllowed: false});

        dispatchMouseUp(50, 70);

        expect(calls('drag-canceled')).toHaveLength(1);
        expect(calls('drag-stopped')).toHaveLength(1);
        expect(calls('move-component-requested')).toHaveLength(0);
        expect(calls('drag-dropped')).toHaveLength(0);
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
            '/main': createRecord('/main', topRegion, 'region', ComponentPath.root().toString(), [
                '/main/0',
                '/main/1',
            ]),
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

        expect(calls('move-component-requested')).toHaveLength(0);
        expect(calls('drag-canceled')).toHaveLength(1);
        expect(calls('drag-stopped')).toHaveLength(1);

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
            '/main': createRecord('/main', topRegion, 'region', ComponentPath.root().toString(), [
                '/main/0',
                '/main/1',
            ]),
            '/main/0': createRecord('/main/0', outerLayout, 'layout', '/main', ['/main/0/left']),
            '/main/0/left': createRecord('/main/0/left', innerRegion, 'region', '/main/0'),
            '/main/1': createRecord('/main/1', fragment, 'fragment', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);

        componentDragMocks.elementContainsLayout.mockReturnValue(true);
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

        expect(calls('move-component-requested')).toHaveLength(0);
        expect(calls('drag-canceled')).toHaveLength(1);

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
        expect(calls('drag-canceled')).toHaveLength(1);
        expect(calls('drag-stopped')).toHaveLength(1);
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
        expect(calls('drag-started')).toHaveLength(0);

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
        expect(calls('drag-started')).toHaveLength(0);

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
        expect(calls('drag-started')).toHaveLength(0);

        stop();
    });

    it('uses the capitalized component type as the drag label', () => {
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
        expect(calls('drag-canceled')).toHaveLength(1);
        expect(calls('drag-stopped')).toHaveLength(1);
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
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), [
                '/main/0',
                '/main/1',
                '/main/2',
            ]),
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

        expect(calls('move-component-requested')).toHaveLength(1);

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
        expect(calls('drag-started')).toHaveLength(0);

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
        expect(calls('drag-started')).toHaveLength(1);

        // drag state is already set by beginDrag
        expect($dragState.get()).toBeDefined();

        // Try second mousedown — should be ignored because $dragState is set
        dispatchMouseDown(second, 150, 140);
        dispatchMouseMove(150, 160);

        // Still only one drag started
        expect(calls('drag-started')).toHaveLength(1);
        expect($dragState.get()?.sourcePath).toBe('/main/0');

        window.dispatchEvent(new Event('blur'));
        stop();
    });

    it('auto-scrolls the page when a dragged component nears the viewport bottom edge', async () => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 400});

        const scrollingElement = document.scrollingElement ?? document.documentElement;
        Object.defineProperty(scrollingElement, 'scrollHeight', {configurable: true, value: 2000});
        Object.defineProperty(scrollingElement, 'clientHeight', {configurable: true, value: 400});
        let scrollTop = 0;
        const observedDeltas: number[] = [];
        Object.defineProperty(scrollingElement, 'scrollTop', {
            configurable: true,
            get: () => scrollTop,
            set: (value: number) => {
                const next = Math.max(0, Math.min(1600, value));
                observedDeltas.push(next - scrollTop);
                scrollTop = next;
            },
        });

        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const item = document.createElement('article');
        item.dataset.portalComponentType = 'part';
        region.append(item);
        document.body.appendChild(region);

        setRect(item, {top: 20, left: 0, width: 300, height: 80});

        const records: Record<string, ComponentRecord> = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0']),
            '/main/0': createRecord('/main/0', item, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([]);

        const frames: Array<(now: number) => void> = [];
        const originalRAF = window.requestAnimationFrame;
        const originalCAF = window.cancelAnimationFrame;
        window.requestAnimationFrame = ((cb: (now: number) => void): number => {
            frames.push(cb);
            return frames.length;
        }) as typeof requestAnimationFrame;
        window.cancelAnimationFrame = ((id: number): void => {
            frames[id - 1] = () => {};
        }) as typeof cancelAnimationFrame;

        const stop = initComponentDrag();

        dispatchMouseDown(item, 50, 50);
        dispatchMouseMove(50, 70);

        // Drag is active — now move pointer near the bottom of the viewport
        dispatchMouseMove(50, 395);

        // Drive two frames: first primes the timestamp, second performs the scroll
        frames.shift()?.(1000);
        frames.shift()?.(1016);

        expect(observedDeltas.length).toBeGreaterThan(0);
        expect(observedDeltas[0]).toBeGreaterThan(0);

        window.requestAnimationFrame = originalRAF;
        window.cancelAnimationFrame = originalCAF;
        window.dispatchEvent(new Event('blur'));
        stop();
    });
});
