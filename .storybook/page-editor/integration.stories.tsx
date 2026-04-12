import type {Meta, StoryObj} from '@storybook/preact-vite';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {CSSProperties} from 'preact';
import {useEffect, useRef} from 'preact/hooks';
import {OverlayApp} from '../../src/main/resources/assets/js/new-ui/components/OverlayApp';
import {DragPlaceholder} from '../../src/main/resources/assets/js/new-ui/components/placeholders/DragPlaceholder';
import {setCurrentPageView} from '../../src/main/resources/assets/js/new-ui/bridge';
import {transferOwnership, resetOwnership} from '../../src/main/resources/assets/js/new-ui/coexistence/ownership';
import {initGeometryTriggers, markDirty} from '../../src/main/resources/assets/js/new-ui/geometry/scheduler';
import {getTrackedTarget, isOverlayChromeEvent} from '../../src/main/resources/assets/js/new-ui/interaction/click-guard';
import {initHoverDetection} from '../../src/main/resources/assets/js/new-ui/interaction/hover-handler';
import {createOverlayHost} from '../../src/main/resources/assets/js/new-ui/rendering/overlay-host';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/new-ui/rendering/placeholder-island';
import {elementIndex, rebuildIndex} from '../../src/main/resources/assets/js/new-ui/stores/element-index';
import {
    $selectedPath,
    closeContextMenu,
    openContextMenu,
    setDragState,
    setHoveredPath,
    setLocked,
    setModifyAllowed,
    setRegistry,
    setSelectedPath,
} from '../../src/main/resources/assets/js/new-ui/stores/registry';
import type {ComponentRecord, ComponentRecordType} from '../../src/main/resources/assets/js/new-ui/types';

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

function record(
    path: string,
    type: ComponentRecordType,
    element: HTMLElement,
    parentPath: string | undefined,
    children: string[],
): ComponentRecord {
    return {
        path: path === '/' ? ComponentPath.root() : ComponentPath.fromString(path),
        type,
        element,
        parentPath,
        children,
        empty: false,
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
}

function initSimpleSelection(): () => void {
    const handleClick = (event: MouseEvent) => {
        if (isOverlayChromeEvent(event)) return;
        const target = getTrackedTarget(event.target);
        const path = target ? elementIndex.get(target) : undefined;
        if (path) {
            event.preventDefault();
            event.stopPropagation();
            closeContextMenu();
            setSelectedPath($selectedPath.get() === path ? undefined : path);
        } else {
            setSelectedPath(undefined);
            closeContextMenu();
        }
    };

    const handleContextMenu = (event: MouseEvent) => {
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

    document.addEventListener('click', handleClick, {capture: true});
    document.addEventListener('contextmenu', handleContextMenu, {capture: true});
    return () => {
        document.removeEventListener('click', handleClick, {capture: true});
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
    cursor: 'default',
});

//
// * Overlay Test
//

function OverlayTest() {
    const containerRef = useRef<HTMLDivElement>(null);
    const regionRef = useRef<HTMLElement>(null);
    const partARef = useRef<HTMLElement>(null);
    const layoutBRef = useRef<HTMLElement>(null);
    const innerRegionRef = useRef<HTMLElement>(null);
    const textCRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const region = regionRef.current;
        const partA = partARef.current;
        const layoutB = layoutBRef.current;
        const innerRegion = innerRegionRef.current;
        const textC = textCRef.current;

        if (!container || !region || !partA || !layoutB || !innerRegion || !textC) return undefined;

        // Manual registry — no reconcilePage, no PageState dependency
        const records: Record<string, ComponentRecord> = {
            '/': record('/', 'page', container, undefined, ['/main']),
            '/main': record('/main', 'region', region, '/', ['/main/0', '/main/1']),
            '/main/0': record('/main/0', 'part', partA, '/main', []),
            '/main/1': record('/main/1', 'layout', layoutB, '/main', ['/main/1/left']),
            '/main/1/left': record('/main/1/left', 'region', innerRegion, '/main/1', ['/main/1/left/0']),
            '/main/1/left/0': record('/main/1/left/0', 'text', textC, '/main/1/left', []),
        };

        setCurrentPageView(createMockPageView(container));
        setupOwnership();

        const overlay = createOverlayHost(<OverlayApp />);
        setRegistry(records);
        rebuildIndex(records);
        setModifyAllowed(true);

        const stopGeometry = initGeometryTriggers();
        const stopHover = initHoverDetection();
        const stopSelection = initSimpleSelection();

        // Initial geometry pass
        markDirty();

        return () => {
            stopSelection();
            stopHover();
            stopGeometry();
            overlay.unmount();
            resetOwnership();
            resetState();
        };
    }, []);

    return (
        <div ref={containerRef} data-testid='overlay-canvas' style={canvasStyle}>
            <section ref={regionRef} data-portal-region='main' style={{display: 'grid', gap: '12px'}}>
                <article
                    ref={partARef}
                    data-portal-component-type='part'
                    data-testid='part-a'
                    style={blockStyle('rgba(66, 153, 225, 0.06)', 'rgba(66, 153, 225, 0.2)')}
                >
                    <h3 style={{margin: '0 0 4px', fontSize: '16px'}}>Part A — Hero Banner</h3>
                    <p style={{margin: 0, opacity: 0.6, fontSize: '13px'}}>Hover to highlight, click to select, right-click for menu.</p>
                </article>

                <div
                    ref={layoutBRef}
                    data-portal-component-type='layout'
                    data-testid='layout-b'
                    style={{
                        ...blockStyle('rgba(15, 23, 42, 0.02)', 'rgba(33, 52, 75, 0.12)'),
                        display: 'grid',
                        gap: '10px',
                    }}
                >
                    <p style={{margin: 0, fontSize: '13px', fontWeight: 600}}>Layout B — Two Column</p>
                    <section
                        ref={innerRegionRef}
                        data-portal-region='left'
                        style={{borderRadius: '6px', border: '1px dashed rgba(33, 52, 75, 0.12)', padding: '12px'}}
                    >
                        <div
                            ref={textCRef}
                            data-portal-component-type='text'
                            data-testid='text-c'
                            style={blockStyle('rgba(34, 197, 94, 0.05)', 'rgba(34, 197, 94, 0.2)')}
                        >
                            <p style={{margin: 0, fontSize: '13px', fontWeight: 600}}>Text C — Inside Layout</p>
                            <p style={{margin: '4px 0 0', opacity: 0.6, fontSize: '13px'}}>Nested component. Hover/click targets this, not the parent layout.</p>
                        </div>
                    </section>
                </div>
            </section>
        </div>
    );
}

//
// * Drag Test
//

function DragTest() {
    const containerRef = useRef<HTMLDivElement>(null);
    const sourceRegionRef = useRef<HTMLElement>(null);
    const sourceRef = useRef<HTMLElement>(null);
    const targetRegionRef = useRef<HTMLElement>(null);
    const placeholderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const sourceRegion = sourceRegionRef.current;
        const source = sourceRef.current;
        const targetRegion = targetRegionRef.current;
        const placeholder = placeholderRef.current;

        if (!container || !sourceRegion || !source || !targetRegion || !placeholder) return undefined;

        const records: Record<string, ComponentRecord> = {
            '/': record('/', 'page', container, undefined, ['/main', '/aside']),
            '/main': record('/main', 'region', sourceRegion, '/', ['/main/0']),
            '/main/0': record('/main/0', 'part', source, '/main', []),
            '/aside': record('/aside', 'region', targetRegion, '/', []),
        };

        setCurrentPageView(createMockPageView(container));
        setupOwnership();

        const overlay = createOverlayHost(<OverlayApp />);
        setRegistry(records);
        rebuildIndex(records);
        setModifyAllowed(true);

        // Manual drag placeholder — bypass DragPlaceholderPortal
        const dragIsland = createPlaceholderIsland(
            placeholder,
            <DragPlaceholder itemLabel='Hero banner' dropAllowed={true} />,
        );

        // placeholderElement: undefined prevents DragPlaceholderPortal from duplicating
        setDragState({
            itemType: 'part',
            itemLabel: 'Hero banner',
            sourcePath: '/main/0',
            targetPath: '/aside',
            dropAllowed: true,
            message: undefined,
            placeholderElement: undefined,
            x: 480,
            y: 180,
        });

        const stopGeometry = initGeometryTriggers();
        markDirty();

        return () => {
            stopGeometry();
            dragIsland.unmount();
            overlay.unmount();
            resetOwnership();
            resetState();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{...canvasStyle, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', alignItems: 'start'}}
        >
            <section ref={sourceRegionRef} data-portal-region='main' style={{display: 'grid', gap: '12px'}}>
                <article
                    ref={sourceRef}
                    data-portal-component-type='part'
                    style={{...blockStyle('rgba(66, 153, 225, 0.06)', 'rgba(66, 153, 225, 0.2)'), opacity: 0.5, cursor: 'grabbing'}}
                >
                    <p style={{margin: '0 0 4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.5}}>Drag source</p>
                    <h3 style={{margin: '0 0 4px', fontSize: '16px'}}>Hero Banner</h3>
                    <p style={{margin: 0, opacity: 0.6, fontSize: '13px'}}>Being dragged to the aside region.</p>
                </article>
            </section>

            <aside
                ref={targetRegionRef}
                data-portal-region='aside'
                style={{minHeight: '160px', borderRadius: '8px', border: '1px dashed rgba(33, 52, 75, 0.15)', background: 'rgba(15, 23, 42, 0.02)', padding: '14px'}}
            >
                <p style={{margin: '0 0 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.5}}>Drop target</p>
                <div ref={placeholderRef} />
            </aside>
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

export const Drag: Story = {
    name: 'Integration / Drag',
    render: () => <DragTest />,
};
