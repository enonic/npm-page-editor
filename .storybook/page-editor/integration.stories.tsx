import type {Meta, StoryObj} from '@storybook/preact-vite';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {Event} from '@enonic/lib-admin-ui/event/Event';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {CSSProperties} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';
import {OverlayApp} from '../../src/main/resources/assets/js/page-editor/editor/components/OverlayApp';
import {RegionPlaceholder} from '../../src/main/resources/assets/js/page-editor/editor/components/placeholders/RegionPlaceholder';
import {markError, markLoading} from '../../src/main/resources/assets/js/page-editor/editor/adapter/reconcile';
import {syncPlaceholders} from '../../src/main/resources/assets/js/page-editor/editor/adapter/placeholder-lifecycle';
import {setCurrentPageView} from '../../src/main/resources/assets/js/page-editor/editor/bridge';
import {transferOwnership, resetOwnership} from '../../src/main/resources/assets/js/page-editor/editor/coexistence/ownership';
import {initGeometryTriggers, markDirty} from '../../src/main/resources/assets/js/page-editor/editor/geometry/scheduler';
import {getTrackedTarget, isOverlayChromeEvent} from '../../src/main/resources/assets/js/page-editor/editor/interaction/common/click-guard';
import {initHoverDetection} from '../../src/main/resources/assets/js/page-editor/editor/interaction/hover';
import {createOverlayHost} from '../../src/main/resources/assets/js/page-editor/editor/rendering/overlay-host';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/page-editor/editor/rendering/placeholder-island';
import {elementIndex, rebuildIndex} from '../../src/main/resources/assets/js/page-editor/editor/stores/element-index';
import {
    $selectedPath,
    closeContextMenu,
    getRecord,
    getRegistry,
    openContextMenu,
    setDragState,
    setHoveredPath,
    setLocked,
    setModifyAllowed,
    setRegistry,
    setSelectedPath,
} from '../../src/main/resources/assets/js/page-editor/editor/stores/registry';
import type {ComponentRecord, ComponentRecordType} from '../../src/main/resources/assets/js/page-editor/editor/types';
import {EditorEvent, EditorEvents} from '../../src/main/resources/assets/js/page-editor/event/EditorEvent';

//
// * Helpers
//

function createActions(): Action[] {
    return [
        new Action('Inspect').setSortOrder(10),
        new Action('Duplicate').setSortOrder(20),
        new Action('Reset').setSortOrder(30).setEnabled(false),
    ];
}

function createMockPageView(element: HTMLElement) {
    return {
        getHTMLElement: () => element,
        isLocked: () => false,
        getSelectedView: () => undefined,
        getLiveEditParams: () => ({contentId: 'storybook', isFragment: false, modifyPermissions: true}),
        getComponentViewByPath: () => ({getContextMenuActions: () => createActions()}),
        getLockedMenuActions: () => [],
    } as never;
}

function makeRecord(
    path: string,
    type: ComponentRecordType,
    element: HTMLElement,
    parentPath: string | undefined,
    children: string[],
    empty = false,
): ComponentRecord {
    return {
        path: path === '/' ? ComponentPath.root() : ComponentPath.fromString(path),
        type,
        element,
        parentPath,
        children,
        empty,
        error: false,
        descriptor: undefined,
        loading: false,
    };
}

function resetState(): void {
    closeContextMenu();
    setSelectedPath(undefined);
    setHoveredPath(undefined);
    setLocked(false);
    setModifyAllowed(true);
    setDragState(undefined);
    setRegistry({});
    setCurrentPageView(undefined);
}

function setupOwnership(): void {
    transferOwnership('placeholder');
    transferOwnership('highlighter');
    transferOwnership('selection');
    transferOwnership('shader');
    transferOwnership('hover-detection');
    transferOwnership('click-selection');
    transferOwnership('drag-drop');
}

//
// * Interaction handler
//

function initInteraction(): () => void {
    const DRAG_THRESHOLD = 5;

    let dragPending = false;
    let dragActive = false;
    let startX = 0;
    let startY = 0;
    let sourcePath: string | undefined;
    let sourceParentPath: string | undefined;
    let sourceElement: HTMLElement | undefined;
    let sourceHeight = 0;
    let originalDisplay = '';
    let placeholderEl: HTMLDivElement | undefined;
    let activeEmptyRegion: HTMLElement | undefined;

    // Hide/restore RegionPlaceholder island hosts in empty regions
    // so the drag placeholder is the sole flex child and fills the space
    const showRegionHosts = () => {
        if (activeEmptyRegion) {
            activeEmptyRegion.querySelectorAll('[data-pe-placeholder-host]').forEach(
                (h) => { (h as HTMLElement).style.display = ''; },
            );
            activeEmptyRegion = undefined;
        }
    };

    const hideRegionHosts = (regionEl: HTMLElement) => {
        showRegionHosts();
        regionEl.querySelectorAll('[data-pe-placeholder-host]').forEach(
            (h) => { (h as HTMLElement).style.display = 'none'; },
        );
        activeEmptyRegion = regionEl;
    };

    const getPlaceholder = (): HTMLDivElement => {
        if (!placeholderEl) {
            placeholderEl = document.createElement('div');
            placeholderEl.style.pointerEvents = 'none';
            placeholderEl.style.flex = '1';
            placeholderEl.style.display = 'flex';
            placeholderEl.style.flexDirection = 'column';
        }
        return placeholderEl;
    };

    const endDrag = () => {
        showRegionHosts();
        if (sourceElement) {
            sourceElement.style.display = originalDisplay;
            sourceElement = undefined;
        }
        if (placeholderEl) {
            placeholderEl.style.minHeight = '';
            placeholderEl.remove();
            placeholderEl = undefined;
        }
        document.body.style.cursor = '';
        setDragState(undefined);
        dragActive = false;
        dragPending = false;
        sourcePath = undefined;
        sourceParentPath = undefined;
        sourceHeight = 0;
    };

    // Check if a region is nested inside a layout
    const isInsideLayout = (regionPath: string): boolean => {
        const rec = getRecord(regionPath);
        if (!rec?.parentPath) return false;
        const parent = getRecord(rec.parentPath);
        return parent?.type === 'layout';
    };

    // Find the child element to insert placeholder before, or null to append
    const findInsertionRef = (regionPath: string, mouseY: number): Element | null => {
        const rec = getRecord(regionPath);
        if (!rec) return null;

        for (const childPath of rec.children) {
            if (childPath === sourcePath) continue;
            const child = getRecord(childPath);
            if (!child?.element) continue;

            const rect = child.element.getBoundingClientRect();
            if (mouseY < rect.top + rect.height / 2) return child.element;
        }
        return null;
    };

    const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0 || isOverlayChromeEvent(event)) return;

        const target = getTrackedTarget(event.target);
        const path = target ? elementIndex.get(target) : undefined;
        const rec = path ? getRecord(path) : undefined;

        if (rec && rec.type !== 'region' && rec.type !== 'page') {
            event.preventDefault();
            dragPending = true;
            startX = event.clientX;
            startY = event.clientY;
            sourcePath = path;
            sourceElement = target ?? undefined;
        }
    };

    const handleMouseMove = (event: MouseEvent) => {
        if (!dragPending && !dragActive) return;

        if (dragPending) {
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;

            dragPending = false;
            dragActive = true;

            document.body.style.cursor = 'grabbing';
            closeContextMenu();
            setSelectedPath(undefined);
            setHoveredPath(undefined);

            // Hide source and show placeholder at its position to avoid layout shift
            if (sourcePath && sourceElement) {
                const sourceRec = getRecord(sourcePath);
                const parentPath = sourceRec?.parentPath;
                const parentRec = parentPath ? getRecord(parentPath) : undefined;

                if (parentRec?.element) {
                    sourceHeight = sourceElement.offsetHeight;
                    sourceParentPath = parentPath;
                    originalDisplay = sourceElement.style.display;

                    const ph = getPlaceholder();
                    ph.style.minHeight = `${sourceHeight}px`;
                    parentRec.element.insertBefore(ph, sourceElement);
                    sourceElement.style.display = 'none';

                    const typeLabel = sourceRec?.type
                        ? `${sourceRec.type.charAt(0).toUpperCase()}${sourceRec.type.slice(1)}`
                        : 'Component';

                    setDragState({
                        itemType: sourceRec?.type || 'part',
                        itemLabel: typeLabel,
                        sourcePath,
                        targetPath: parentPath,
                        dropAllowed: true,
                        message: undefined,
                        placeholderElement: ph,
                        x: event.clientX,
                        y: event.clientY,
                    });
                }
            }

            return;
        }

        if (!dragActive || !sourcePath) return;

        const el = document.elementFromPoint(event.clientX, event.clientY);
        const regionEl = el?.closest('[data-portal-region]') as HTMLElement | null;
        const targetPath = regionEl ? elementIndex.get(regionEl) : undefined;

        const sourceRec = getRecord(sourcePath);
        const typeLabel = sourceRec?.type
            ? `${sourceRec.type.charAt(0).toUpperCase()}${sourceRec.type.slice(1)}`
            : 'Component';

        if (targetPath && regionEl) {
            const targetRec = getRecord(targetPath);
            const dropAllowed = !(sourceRec?.type === 'layout' && isInsideLayout(targetPath));
            const message = dropAllowed ? undefined : 'Layouts cannot be nested';

            const ph = getPlaceholder();

            const isEmpty = !targetRec?.children.length ||
                (targetRec.children.length === 1 && targetRec.children[0] === sourcePath);

            if (isEmpty) {
                // Empty region — hide island hosts so placeholder fills the space
                if (ph.parentElement !== regionEl) {
                    hideRegionHosts(regionEl);
                    ph.style.minHeight = `${Math.max(sourceHeight, regionEl.offsetHeight)}px`;
                    regionEl.appendChild(ph);
                }
            } else {
                // Region has children — position at insertion point
                showRegionHosts();
                ph.style.minHeight = targetPath === sourceParentPath ? `${sourceHeight}px` : '';
                const ref = findInsertionRef(targetPath, event.clientY);
                if (ref) {
                    regionEl.insertBefore(ph, ref);
                } else {
                    regionEl.appendChild(ph);
                }
            }

            setDragState({
                itemType: sourceRec?.type || 'part',
                itemLabel: typeLabel,
                sourcePath,
                targetPath,
                dropAllowed,
                message,
                placeholderElement: ph,
                x: event.clientX,
                y: event.clientY,
            });
        } else {
            showRegionHosts();
            if (placeholderEl?.parentElement) {
                placeholderEl.remove();
            }
            setDragState({
                itemType: sourceRec?.type || 'part',
                itemLabel: typeLabel,
                sourcePath,
                targetPath: undefined,
                dropAllowed: false,
                message: undefined,
                placeholderElement: undefined,
                x: event.clientX,
                y: event.clientY,
            });
        }
    };

    const handleMouseUp = (event: MouseEvent) => {
        if (dragActive) {
            endDrag();
            return;
        }

        dragPending = false;

        if (isOverlayChromeEvent(event)) return;

        const target = getTrackedTarget(event.target);
        const path = target ? elementIndex.get(target) : undefined;

        if (path) {
            closeContextMenu();
            setSelectedPath($selectedPath.get() === path ? undefined : path);
        } else {
            setSelectedPath(undefined);
            closeContextMenu();
        }
    };

    const handleContextMenu = (event: MouseEvent) => {
        if (dragActive) return;
        if (isOverlayChromeEvent(event)) return;

        const target = getTrackedTarget(event.target);
        const path = target ? elementIndex.get(target) : undefined;

        if (path) {
            event.preventDefault();
            event.stopPropagation();
            setSelectedPath(path);
            openContextMenu({kind: 'component', path, x: event.pageX, y: event.pageY});
        }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('contextmenu', handleContextMenu, {capture: true});

    return () => {
        endDrag();
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('contextmenu', handleContextMenu, {capture: true});
    };
}

//
// * Styles
//

const canvasStyle: CSSProperties = {
    width: '700px',
    border: '1px solid rgba(33, 52, 75, 0.12)',
    borderRadius: '12px',
    background: '#fff',
    padding: '20px',
};

const blockStyle = (bg: string, border: string): CSSProperties => ({
    minHeight: '80px',
    borderRadius: '8px',
    background: bg,
    border: `1px solid ${border}`,
    padding: '16px',
    cursor: 'grab',
    userSelect: 'none',
});

const regionStyle: CSSProperties = {
    borderRadius: '6px',
    border: '1px dashed rgba(33, 52, 75, 0.12)',
    padding: '12px',
    minHeight: '60px',
    cursor: 'default',
};

const emptyRegionStyle: CSSProperties = {
    minHeight: '60px',
    cursor: 'default',
    display: 'flex',
    flexDirection: 'column',
};

//
// * Story component
//

function OverlayTest() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mainRegionRef = useRef<HTMLElement>(null);
    const partARef = useRef<HTMLElement>(null);
    const layoutBRef = useRef<HTMLDivElement>(null);
    const leftRegionRef = useRef<HTMLElement>(null);
    const textCRef = useRef<HTMLDivElement>(null);
    const rightRegionRef = useRef<HTMLElement>(null);
    const layoutDRef = useRef<HTMLDivElement>(null);
    const centerRegionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const mainRegion = mainRegionRef.current;
        const partA = partARef.current;
        const layoutB = layoutBRef.current;
        const leftRegion = leftRegionRef.current;
        const textC = textCRef.current;
        const rightRegion = rightRegionRef.current;
        const layoutD = layoutDRef.current;
        const centerRegion = centerRegionRef.current;

        if (!container || !mainRegion || !partA || !layoutB || !leftRegion || !textC || !rightRegion || !layoutD || !centerRegion) {
            return undefined;
        }

        const records: Record<string, ComponentRecord> = {
            '/': makeRecord('/', 'page', container, undefined, ['/main']),
            '/main': makeRecord('/main', 'region', mainRegion, '/', ['/main/0', '/main/1', '/main/2']),
            '/main/0': makeRecord('/main/0', 'part', partA, '/main', []),
            '/main/1': makeRecord('/main/1', 'layout', layoutB, '/main', ['/main/1/left', '/main/1/right']),
            '/main/1/left': makeRecord('/main/1/left', 'region', leftRegion, '/main/1', ['/main/1/left/0']),
            '/main/1/left/0': makeRecord('/main/1/left/0', 'text', textC, '/main/1/left', []),
            '/main/1/right': makeRecord('/main/1/right', 'region', rightRegion, '/main/1', [], true),
            '/main/2': makeRecord('/main/2', 'layout', layoutD, '/main', ['/main/2/center']),
            '/main/2/center': makeRecord('/main/2/center', 'region', centerRegion, '/main/2', [], true),
        };

        setCurrentPageView(createMockPageView(container));
        setupOwnership();

        const overlay = createOverlayHost(<OverlayApp />);
        setRegistry(records);
        rebuildIndex(records);
        setModifyAllowed(true);

        const rightIsland = createPlaceholderIsland(
            rightRegion,
            <RegionPlaceholder path='/main/1/right' regionName='right' />,
        );
        const centerIsland = createPlaceholderIsland(
            centerRegion,
            <RegionPlaceholder path='/main/2/center' regionName='center' />,
        );

        const stopGeometry = initGeometryTriggers();
        const stopHover = initHoverDetection();
        const stopInteraction = initInteraction();

        markDirty();

        return () => {
            stopInteraction();
            stopHover();
            stopGeometry();
            rightIsland.unmount();
            centerIsland.unmount();
            overlay.unmount();
            resetOwnership();
            resetState();
        };
    }, []);

    return (
        <div ref={containerRef} data-testid='overlay-canvas' style={canvasStyle}>
            <section ref={mainRegionRef} data-portal-region='main' style={{display: 'grid', gap: '12px'}}>
                <article
                    ref={partARef}
                    data-portal-component-type='part'
                    data-testid='part-a'
                    style={blockStyle('rgba(66, 153, 225, 0.06)', 'rgba(66, 153, 225, 0.2)')}
                >
                    <h3 style={{margin: '0 0 4px', fontSize: '16px'}}>Part A — Hero Banner</h3>
                    <p style={{margin: 0, opacity: 0.6, fontSize: '13px'}}>Hover, click to select, drag to move.</p>
                </article>

                <div
                    ref={layoutBRef}
                    data-portal-component-type='layout'
                    data-testid='layout-b'
                    style={{
                        ...blockStyle('rgba(15, 23, 42, 0.02)', 'rgba(33, 52, 75, 0.12)'),
                    }}
                >
                    <p style={{margin: '0 0 10px', fontSize: '13px', fontWeight: 600}}>Layout B — Two Column</p>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                        <section ref={leftRegionRef} data-portal-region='left' style={regionStyle}>
                            <div
                                ref={textCRef}
                                data-portal-component-type='text'
                                data-testid='text-c'
                                style={blockStyle('rgba(34, 197, 94, 0.05)', 'rgba(34, 197, 94, 0.2)')}
                            >
                                <p style={{margin: 0, fontSize: '13px', fontWeight: 600}}>Text C</p>
                                <p style={{margin: '4px 0 0', opacity: 0.6, fontSize: '13px'}}>
                                    Drag into other regions.
                                </p>
                            </div>
                        </section>
                        <section ref={rightRegionRef} data-portal-region='right' style={emptyRegionStyle} />
                    </div>
                </div>

                <div
                    ref={layoutDRef}
                    data-portal-component-type='layout'
                    data-testid='layout-d'
                    style={{
                        ...blockStyle('rgba(15, 23, 42, 0.02)', 'rgba(33, 52, 75, 0.12)'),
                    }}
                >
                    <p style={{margin: '0 0 10px', fontSize: '13px', fontWeight: 600}}>Layout D — Single Column</p>
                    <section ref={centerRegionRef} data-portal-region='center' style={emptyRegionStyle} />
                </div>
            </section>
        </div>
    );
}

//
// * Meta
//

const meta = {
    title: 'Page Editor/Integration',
    parameters: {layout: 'centered'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overlay: Story = {
    name: 'Integration / Overlay',
    render: () => <OverlayTest />,
};

//
// * Load and Replace
//

const loadCanvasStyle: CSSProperties = {
    width: '640px',
    border: '1px solid rgba(33, 52, 75, 0.12)',
    borderRadius: '12px',
    background: '#fff',
    padding: '20px',
};

const toolbarStyle: CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
};

const buttonStyle: CSSProperties = {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(33, 52, 75, 0.2)',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
};

const logStyle: CSSProperties = {
    marginTop: '16px',
    padding: '12px',
    borderRadius: '6px',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '12px',
    minHeight: '80px',
    maxHeight: '160px',
    overflowY: 'auto',
};

function LoadReplaceDemo() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mainRegionRef = useRef<HTMLElement>(null);
    const counterRef = useRef(0);
    const [events, setEvents] = useState<string[]>([]);

    const log = (line: string): void => {
        setEvents((prev) => [...prev, `${new Date().toLocaleTimeString()} · ${line}`].slice(-12));
    };

    const addComponent = (variant: 'regular' | 'error'): void => {
        const main = mainRegionRef.current;
        if (!main) return;

        const index = counterRef.current++;
        const path = `/main/${index}`;

        const el = document.createElement('article');
        el.dataset.portalComponentType = 'fragment';
        el.dataset.testid = `part-${index}`;
        main.appendChild(el);

        const current = getRegistry();
        const parent = current['/main'];
        if (!parent) return;

        const next = {
            ...current,
            '/main': {...parent, empty: false, children: [...parent.children, path]},
            [path]: makeRecord(path, 'fragment', el, '/main', [], false),
        };
        setRegistry(next);
        rebuildIndex(next);
        markLoading(path, true);
        markDirty();

        const cpath = ComponentPath.fromString(path);
        new EditorEvent(EditorEvents.ComponentLoadRequest, {path: cpath, isExisting: false}).fire();
        new EditorEvent(EditorEvents.ComponentLoadStarted, {path: cpath}).fire();

        window.setTimeout(() => {
            const rec = getRecord(path);
            if (!rec || rec.element !== el) return;

            if (variant === 'regular') {
                const recs = getRegistry();
                const updated = {...recs, [path]: {...rec, loading: false, empty: true}};
                setRegistry(updated);
                syncPlaceholders(updated);
                new EditorEvent(EditorEvents.ComponentLoaded, {path: cpath}).fire();
            } else {
                markLoading(path, false);
                markError(path, true);
                new EditorEvent(EditorEvents.ComponentLoadFailed, {path: cpath, reason: new Error('Simulated 500 from server')}).fire();
            }
            markDirty();
        }, 1000);
    };

    const handleClear = (): void => {
        const main = mainRegionRef.current;
        const container = containerRef.current;
        if (!main || !container) return;

        while (main.firstChild) main.removeChild(main.firstChild);

        const next: Record<string, ComponentRecord> = {
            '/': makeRecord('/', 'page', container, undefined, ['/main']),
            '/main': makeRecord('/main', 'region', main, '/', [], true),
        };
        setRegistry(next);
        rebuildIndex(next);
        syncPlaceholders(next);
        setEvents([]);
        counterRef.current = 0;
        markDirty();
    };

    useEffect(() => {
        const container = containerRef.current;
        const mainRegion = mainRegionRef.current;
        if (!container || !mainRegion) return undefined;

        const records: Record<string, ComponentRecord> = {
            '/': makeRecord('/', 'page', container, undefined, ['/main']),
            '/main': makeRecord('/main', 'region', mainRegion, '/', [], true),
        };

        setCurrentPageView(createMockPageView(container));
        setupOwnership();

        const overlay = createOverlayHost(<OverlayApp />);
        setRegistry(records);
        rebuildIndex(records);
        setModifyAllowed(true);
        syncPlaceholders(records);

        const stopGeometry = initGeometryTriggers();
        markDirty();

        const onRequest = (event: EditorEvent<{path: ComponentPath; isExisting: boolean}>): void => {
            const data = event.getData();
            log(`ComponentLoadRequest  path=${data?.path.toString()} isExisting=${String(data?.isExisting)}`);
        };
        const onStarted = (event: EditorEvent<{path: ComponentPath}>): void => {
            log(`ComponentLoadStarted  path=${event.getData()?.path.toString()}`);
        };
        const onLoaded = (event: EditorEvent<{path: ComponentPath}>): void => {
            log(`ComponentLoaded       path=${event.getData()?.path.toString()}`);
        };
        const onFailed = (event: EditorEvent<{path: ComponentPath; reason: Error}>): void => {
            const data = event.getData();
            log(`ComponentLoadFailed   path=${data?.path.toString()} reason=${data?.reason.message}`);
        };

        Event.bind(EditorEvents.ComponentLoadRequest, onRequest);
        Event.bind(EditorEvents.ComponentLoadStarted, onStarted);
        Event.bind(EditorEvents.ComponentLoaded, onLoaded);
        Event.bind(EditorEvents.ComponentLoadFailed, onFailed);

        return () => {
            Event.unbind(EditorEvents.ComponentLoadRequest, onRequest);
            Event.unbind(EditorEvents.ComponentLoadStarted, onStarted);
            Event.unbind(EditorEvents.ComponentLoaded, onLoaded);
            Event.unbind(EditorEvents.ComponentLoadFailed, onFailed);
            stopGeometry();
            overlay.unmount();
            resetOwnership();
            resetState();
        };
    }, []);

    return (
        <div>
            <div style={toolbarStyle}>
                <button type='button' style={buttonStyle} onClick={() => addComponent('regular')}>
                    Add component
                </button>
                <button type='button' style={buttonStyle} onClick={() => addComponent('error')}>
                    Add component (error)
                </button>
                <button type='button' style={buttonStyle} onClick={handleClear}>
                    Clear
                </button>
            </div>

            <div ref={containerRef} data-testid='load-replace-canvas' style={loadCanvasStyle}>
                <section
                    ref={mainRegionRef}
                    data-portal-region='main'
                    style={{display: 'grid', gap: '12px', minHeight: '60px'}}
                />
            </div>

            <pre style={logStyle}>{events.length === 0 ? 'Waiting for events…' : events.join('\n')}</pre>
        </div>
    );
}

export const LoadAndReplace: Story = {
    name: 'Integration / Load and Replace',
    render: () => <LoadReplaceDemo />,
};
