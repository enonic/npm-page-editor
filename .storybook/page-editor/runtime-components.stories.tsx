import type {Meta, StoryObj} from '@storybook/preact-vite';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {ComponentChildren, CSSProperties} from 'preact';
import {useEffect, useRef} from 'preact/hooks';
import {ComponentPlaceholder} from '../../src/main/resources/assets/js/new-ui/components/placeholders/ComponentPlaceholder';
import {DragPlaceholder} from '../../src/main/resources/assets/js/new-ui/components/placeholders/DragPlaceholder';
import {RegionPlaceholder} from '../../src/main/resources/assets/js/new-ui/components/placeholders/RegionPlaceholder';
import {OverlayApp} from '../../src/main/resources/assets/js/new-ui/components/OverlayApp';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/new-ui/rendering/placeholder-island';
import {createOverlayHost} from '../../src/main/resources/assets/js/new-ui/rendering/overlay-host';
import {markDirty} from '../../src/main/resources/assets/js/new-ui/geometry/scheduler';
import {setCurrentPageView} from '../../src/main/resources/assets/js/new-ui/bridge';
import {rebuildIndex} from '../../src/main/resources/assets/js/new-ui/stores/element-index';
import {
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

function resetRuntimeState(): void {
    closeContextMenu();
    setSelectedPath(undefined);
    setHoveredPath(undefined);
    setLocked(false);
    setModifyAllowed(true);
    setDragState(undefined);
    setRegistry({});
    setCurrentPageView(undefined);
}

function createRecord(
    path: string,
    type: ComponentRecordType,
    element: HTMLElement,
    parentPath: string | undefined,
    children: string[],
    descriptor?: string,
): ComponentRecord {
    return {
        path: path === '/' ? ComponentPath.root() : ComponentPath.fromString(path),
        type,
        element,
        parentPath,
        children,
        empty: false,
        error: false,
        descriptor,
        loading: false,
    };
}

function createComponentActions(): Action[] {
    const insert = new Action('Insert').setSortOrder(1).setChildActions([
        new Action('Text component').setSortOrder(1),
        new Action('Part component').setSortOrder(2),
    ]);

    const inspect = new Action('Inspect').setSortOrder(10);
    const duplicate = new Action('Duplicate').setSortOrder(20);
    const reset = new Action('Reset').setSortOrder(30).setEnabled(false);

    return [insert, inspect, duplicate, reset];
}

function createPageView() {
    return {
        getComponentViewByPath: () => ({
            getContextMenuActions: () => createComponentActions(),
        }),
        getLockedMenuActions: () => [new Action('Page settings').setSortOrder(10)],
    } as never;
}

//
// * Story wrappers
//

interface IslandMountProps {
    children: ComponentChildren;
    className?: string;
    style?: CSSProperties;
}

function IslandMount({children, className, style}: IslandMountProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return undefined;
        }

        const island = createPlaceholderIsland(containerRef.current, children);
        return () => island.unmount();
    }, [children]);

    return <div ref={containerRef} className={className} style={style} />;
}

interface StoryFrameProps {
    title: string;
    description: string;
    children: ComponentChildren;
}

function StoryFrame({title, description, children}: StoryFrameProps) {
    return (
        <section style={{display: 'grid', gap: '16px', maxWidth: '900px'}}>
            <header style={{display: 'grid', gap: '4px'}}>
                <p style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.6, margin: 0}}>
                    Runtime story
                </p>
                <h2 style={{margin: 0, fontSize: '22px'}}>{title}</h2>
                <p style={{margin: 0, maxWidth: '68ch', opacity: 0.7, fontSize: '14px'}}>{description}</p>
            </header>
            <div
                style={{
                    border: '1px solid rgba(33, 52, 75, 0.14)',
                    borderRadius: '20px',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,246,250,0.98))',
                    boxShadow: '0 20px 40px -24px rgba(15,23,42,0.25)',
                    padding: '24px',
                }}
            >
                {children}
            </div>
        </section>
    );
}

//
// * Placeholder stories
//

function PlaceholderGallery() {
    return (
        <StoryFrame
            title='Placeholder states'
            description='All placeholder variants rendered through shadow-root islands. Region placeholders appear in empty regions, component placeholders in empty component slots, and drag placeholders during active drag sessions.'
        >
            <div style={{display: 'grid', gap: '20px'}}>
                <div>
                    <p style={{margin: '0 0 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.5}}>
                        Region placeholder (empty region)
                    </p>
                    <IslandMount>
                        <RegionPlaceholder path='/main' regionName='main' />
                    </IslandMount>
                </div>
                <div>
                    <p style={{margin: '0 0 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.5}}>
                        Component placeholders by type
                    </p>
                    <div style={{display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))'}}>
                        <IslandMount>
                            <ComponentPlaceholder type='part' descriptor='com.app:hero-banner' error={false} />
                        </IslandMount>
                        <IslandMount>
                            <ComponentPlaceholder type='text' error={false} />
                        </IslandMount>
                        <IslandMount>
                            <ComponentPlaceholder type='layout' descriptor='com.app:two-column' error={false} />
                        </IslandMount>
                        <IslandMount>
                            <ComponentPlaceholder type='fragment' descriptor='com.app:shared-header' error={false} />
                        </IslandMount>
                    </div>
                </div>
                <div>
                    <p style={{margin: '0 0 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.5}}>
                        Error state
                    </p>
                    <IslandMount>
                        <ComponentPlaceholder type='part' descriptor='com.app:broken-widget' error={true} />
                    </IslandMount>
                </div>
                <div>
                    <p style={{margin: '0 0 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.5}}>
                        Drag placeholders (drop zone feedback)
                    </p>
                    <div style={{display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
                        <IslandMount>
                            <DragPlaceholder itemLabel='Hero banner' dropAllowed={true} />
                        </IslandMount>
                        <IslandMount>
                            <DragPlaceholder itemLabel='Layout' dropAllowed={false} message='Layouts cannot be nested inside other layouts.' />
                        </IslandMount>
                    </div>
                </div>
            </div>
        </StoryFrame>
    );
}

function PlaceholderIsolation() {
    return (
        <StoryFrame
            title='Placeholder style isolation'
            description='Aggressive customer CSS resets typography, borders, and spacing, but placeholders keep their own styling inside shadow roots.'
        >
            <style>{`
                .customer-reset * {
                    font-family: 'Courier New', monospace !important;
                    color: #9f1239 !important;
                    border-radius: 0 !important;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .customer-reset p, .customer-reset h3 { margin: 0; }
            `}</style>
            <div className='customer-reset' style={{display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
                <IslandMount>
                    <ComponentPlaceholder type='part' descriptor='com.acme.app:hero-banner' error={false} />
                </IslandMount>
                <IslandMount>
                    <ComponentPlaceholder type='part' descriptor='com.acme.app:hero-banner' error={true} />
                </IslandMount>
            </div>
        </StoryFrame>
    );
}

function PlaceholderInFlex() {
    return (
        <StoryFrame
            title='Placeholder inside a narrow flex layout'
            description='The real createPlaceholderIsland() runtime mounts inside customer DOM so the empty-region card participates in layout flow without leaking styles outward.'
        >
            <div style={{display: 'flex', gap: '16px', alignItems: 'stretch'}}>
                <div style={{flex: '1 1 0', minHeight: '190px', borderRadius: '20px', background: 'rgba(255,255,255,0.84)', border: '1px solid rgba(33,52,75,0.12)', padding: '18px'}}>
                    <h3 style={{margin: '0 0 10px', fontSize: '18px'}}>Content column</h3>
                    <p style={{margin: 0, opacity: 0.78}}>Customer content stays in the light DOM while the placeholder is isolated in its own shadow island.</p>
                </div>
                <IslandMount style={{flex: '0 0 280px'}}>
                    <RegionPlaceholder path='/sidebar' regionName='sidebar' />
                </IslandMount>
            </div>
        </StoryFrame>
    );
}

//
// * Overlay stories
//

function OverlayCanvas({title, description, mode}: {title: string; description: string; mode: 'scrolled-selection' | 'stacked-overlays'}) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const mainRef = useRef<HTMLElement | null>(null);
    const heroRef = useRef<HTMLElement | null>(null);
    const teaserRef = useRef<HTMLElement | null>(null);
    const railRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!frameRef.current || !mainRef.current || !heroRef.current || !teaserRef.current || !railRef.current) {
            return undefined;
        }

        const overlay = createOverlayHost(<OverlayApp />);
        setCurrentPageView(createPageView());

        const records = {
            '/': createRecord('/', 'page', frameRef.current, undefined, ['/main']),
            '/main': createRecord('/main', 'region', mainRef.current, '/', ['/main/0', '/main/1', '/main/2']),
            '/main/0': createRecord('/main/0', 'part', heroRef.current, '/main', [], 'site:hero'),
            '/main/1': createRecord('/main/1', 'part', teaserRef.current, '/main', [], 'site:teaser'),
            '/main/2': createRecord('/main/2', 'part', railRef.current, '/main', [], 'site:rail'),
        };

        setRegistry(records);
        rebuildIndex(records);
        setSelectedPath('/main/0');
        setHoveredPath('/main/1');
        setLocked(mode === 'stacked-overlays');
        setModifyAllowed(true);

        const frameRect = frameRef.current.getBoundingClientRect();
        const heroRect = heroRef.current.getBoundingClientRect();
        const frameX = frameRect.left + 20;
        const heroMenuX = heroRect.left + 18;
        const heroMenuY = heroRect.bottom + 12;

        const frame = window.requestAnimationFrame(() => {
            if (mode === 'scrolled-selection' && scrollerRef.current) {
                scrollerRef.current.scrollTop = 180;
                scrollerRef.current.dispatchEvent(new Event('scroll', {bubbles: true}));
            }

            openContextMenu(mode === 'stacked-overlays'
                ? {kind: 'locked-page', path: '/', x: frameX, y: frameRect.top + 28}
                : {kind: 'component', path: '/main/0', x: heroMenuX, y: heroMenuY});

            markDirty();
        });

        return () => {
            window.cancelAnimationFrame(frame);
            overlay.unmount();
            resetRuntimeState();
        };
    }, [mode]);

    const componentStyle = (bg: string, border: string): CSSProperties => ({
        minHeight: '140px',
        borderRadius: '20px',
        background: bg,
        border: `1px solid ${border}`,
        padding: '20px',
    });

    return (
        <StoryFrame title={title} description={description}>
            <div
                ref={scrollerRef}
                style={{
                    height: '400px',
                    overflow: 'auto',
                    border: '1px solid rgba(33, 52, 75, 0.1)',
                    borderRadius: '16px',
                    padding: '20px',
                }}
            >
                <div
                    ref={frameRef}
                    style={{minHeight: '800px', display: 'grid', gap: '18px', alignContent: 'start', padding: '12px', borderRadius: '14px'}}
                >
                    <section ref={mainRef} data-portal-region='main' style={{display: 'grid', gap: '16px'}}>
                        <article ref={heroRef} data-portal-component-type='part' style={componentStyle('linear-gradient(140deg, rgba(66,153,225,0.15), rgba(15,23,42,0.03))', 'rgba(66,153,225,0.2)')}>
                            <p style={{margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.6}}>Selected</p>
                            <h3 style={{margin: '10px 0 6px', fontSize: '24px'}}>Hero banner</h3>
                            <p style={{margin: 0, maxWidth: '44ch', opacity: 0.75}}>Selection crosshair and context menu render through the shared overlay root.</p>
                        </article>
                        <article ref={teaserRef} data-portal-component-type='part' style={componentStyle('rgba(255,255,255,0.85)', 'rgba(33,52,75,0.12)')}>
                            <p style={{margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.6}}>Hovered</p>
                            <h3 style={{margin: '10px 0 6px', fontSize: '20px'}}>Teaser rail</h3>
                            <p style={{margin: 0, opacity: 0.75}}>Scroll to verify the geometry scheduler keeps overlays aligned.</p>
                        </article>
                        <article ref={railRef} data-portal-component-type='part' style={componentStyle('rgba(15,23,42,0.03)', 'rgba(33,52,75,0.15)')}>
                            <h3 style={{margin: 0, fontSize: '18px'}}>Content rail</h3>
                            <p style={{margin: '8px 0 0', opacity: 0.7}}>Extra height to exercise scroll tracking.</p>
                        </article>
                    </section>
                </div>
            </div>
        </StoryFrame>
    );
}

//
// * Drag stories
//

function DragMoveCanvas() {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const sourceRegionRef = useRef<HTMLElement | null>(null);
    const sourceRef = useRef<HTMLElement | null>(null);
    const targetRegionRef = useRef<HTMLElement | null>(null);
    const placeholderRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!frameRef.current || !sourceRegionRef.current || !sourceRef.current || !targetRegionRef.current || !placeholderRef.current) {
            return undefined;
        }

        const overlay = createOverlayHost(<OverlayApp />);
        setCurrentPageView(createPageView());

        const records = {
            '/': createRecord('/', 'page', frameRef.current, undefined, ['/main', '/aside']),
            '/main': createRecord('/main', 'region', sourceRegionRef.current, '/', ['/main/0']),
            '/main/0': createRecord('/main/0', 'part', sourceRef.current, '/main', [], 'site:hero'),
            '/aside': createRecord('/aside', 'region', targetRegionRef.current, '/', []),
        };

        setRegistry(records);
        rebuildIndex(records);

        setDragState({
            itemType: 'part',
            itemLabel: 'Hero banner',
            sourcePath: '/main/0',
            targetPath: '/aside',
            dropAllowed: true,
            message: undefined,
            placeholderElement: placeholderRef.current,
            x: 280,
            y: 170,
        });

        const frame = window.requestAnimationFrame(() => markDirty());

        return () => {
            window.cancelAnimationFrame(frame);
            overlay.unmount();
            resetRuntimeState();
        };
    }, []);

    return (
        <StoryFrame
            title='Drag: move component between regions'
            description='An existing component is being dragged from the main region to the aside region. The drag preview shows "Move" mode, the target region gets a dashed highlight, and a drop placeholder appears at the insertion point.'
        >
            <div
                ref={frameRef}
                style={{display: 'grid', gap: '18px', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(240px, 0.8fr)', alignItems: 'start'}}
            >
                <section ref={sourceRegionRef} data-portal-region='main' style={{display: 'grid', gap: '14px'}}>
                    <article
                        ref={sourceRef}
                        data-portal-component-type='part'
                        style={{
                            minHeight: '160px',
                            borderRadius: '20px',
                            background: 'linear-gradient(140deg, rgba(66,153,225,0.15), rgba(15,23,42,0.03))',
                            border: '1px solid rgba(66,153,225,0.2)',
                            padding: '20px',
                        }}
                    >
                        <p style={{margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.6}}>Drag source</p>
                        <h3 style={{margin: '10px 0 6px', fontSize: '24px'}}>Hero banner</h3>
                        <p style={{margin: 0, maxWidth: '44ch', opacity: 0.75}}>
                            Source component keeps its DOM position while the drag preview follows the cursor.
                        </p>
                    </article>
                </section>
                <aside
                    ref={targetRegionRef}
                    data-portal-region='aside'
                    style={{
                        minHeight: '220px',
                        borderRadius: '20px',
                        border: '1px dashed rgba(33,52,75,0.18)',
                        background: 'rgba(15,23,42,0.02)',
                        padding: '18px',
                    }}
                >
                    <p style={{margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.6}}>
                        Drop target region
                    </p>
                    <div ref={placeholderRef} style={{marginTop: '14px'}} />
                </aside>
            </div>
        </StoryFrame>
    );
}

function DragInsertCanvas() {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const regionRef = useRef<HTMLElement | null>(null);
    const existingRef = useRef<HTMLElement | null>(null);
    const placeholderRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!frameRef.current || !regionRef.current || !existingRef.current || !placeholderRef.current) {
            return undefined;
        }

        const overlay = createOverlayHost(<OverlayApp />);
        setCurrentPageView(createPageView());

        const records = {
            '/': createRecord('/', 'page', frameRef.current, undefined, ['/main']),
            '/main': createRecord('/main', 'region', regionRef.current, '/', ['/main/0']),
            '/main/0': createRecord('/main/0', 'part', existingRef.current, '/main', [], 'site:teaser'),
        };

        setRegistry(records);
        rebuildIndex(records);

        setDragState({
            itemType: 'layout',
            itemLabel: 'Two-column layout',
            sourcePath: undefined,
            targetPath: '/main',
            dropAllowed: true,
            message: undefined,
            placeholderElement: placeholderRef.current,
            x: 180,
            y: 80,
        });

        const frame = window.requestAnimationFrame(() => markDirty());

        return () => {
            window.cancelAnimationFrame(frame);
            overlay.unmount();
            resetRuntimeState();
        };
    }, []);

    return (
        <StoryFrame
            title='Drag: insert new component from context window'
            description='A new layout component is being dragged from the context window into a region. The drag preview shows "Insert" mode (no sourcePath). The drop placeholder appears before the existing component.'
        >
            <div ref={frameRef} style={{padding: '4px'}}>
                <section ref={regionRef} data-portal-region='main' style={{display: 'grid', gap: '14px'}}>
                    <div ref={placeholderRef} />
                    <article
                        ref={existingRef}
                        data-portal-component-type='part'
                        style={{
                            minHeight: '120px',
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.85)',
                            border: '1px solid rgba(33,52,75,0.12)',
                            padding: '20px',
                        }}
                    >
                        <p style={{margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.6}}>Existing component</p>
                        <h3 style={{margin: '10px 0 6px', fontSize: '20px'}}>Teaser rail</h3>
                        <p style={{margin: 0, opacity: 0.75}}>The new component will be inserted above this one.</p>
                    </article>
                </section>
            </div>
        </StoryFrame>
    );
}

function DragForbiddenCanvas() {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const outerRegionRef = useRef<HTMLElement | null>(null);
    const layoutRef = useRef<HTMLElement | null>(null);
    const innerRegionRef = useRef<HTMLElement | null>(null);
    const placeholderRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!frameRef.current || !outerRegionRef.current || !layoutRef.current || !innerRegionRef.current || !placeholderRef.current) {
            return undefined;
        }

        const overlay = createOverlayHost(<OverlayApp />);
        setCurrentPageView(createPageView());

        const records = {
            '/': createRecord('/', 'page', frameRef.current, undefined, ['/main']),
            '/main': createRecord('/main', 'region', outerRegionRef.current, '/', ['/main/0']),
            '/main/0': createRecord('/main/0', 'layout', layoutRef.current, '/main', ['/main/0/left']),
            '/main/0/left': createRecord('/main/0/left', 'region', innerRegionRef.current, '/main/0', []),
        };

        setRegistry(records);
        rebuildIndex(records);

        setDragState({
            itemType: 'layout',
            itemLabel: 'Three-column layout',
            sourcePath: undefined,
            targetPath: '/main/0/left',
            dropAllowed: false,
            message: 'Layouts cannot be nested inside other layouts.',
            placeholderElement: placeholderRef.current,
            x: 200,
            y: 120,
        });

        const frame = window.requestAnimationFrame(() => markDirty());

        return () => {
            window.cancelAnimationFrame(frame);
            overlay.unmount();
            resetRuntimeState();
        };
    }, []);

    return (
        <StoryFrame
            title='Drag: forbidden drop (nested layout)'
            description='Attempting to drop a layout inside another layout&apos;s region. The drag preview shows the error message, the target highlighter turns red, and the drop placeholder shows "No" with the rejection reason.'
        >
            <div ref={frameRef} style={{padding: '4px'}}>
                <section ref={outerRegionRef} data-portal-region='main' style={{display: 'grid', gap: '14px'}}>
                    <div
                        ref={layoutRef}
                        data-portal-component-type='layout'
                        style={{
                            borderRadius: '20px',
                            border: '1px solid rgba(33,52,75,0.12)',
                            background: 'rgba(255,255,255,0.85)',
                            padding: '18px',
                        }}
                    >
                        <p style={{margin: '0 0 12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.6}}>
                            Existing layout
                        </p>
                        <section
                            ref={innerRegionRef}
                            data-portal-region='left'
                            style={{
                                minHeight: '160px',
                                borderRadius: '14px',
                                border: '1px dashed rgba(33,52,75,0.15)',
                                background: 'rgba(15,23,42,0.02)',
                                padding: '14px',
                            }}
                        >
                            <p style={{margin: '0 0 10px', fontSize: '11px', fontWeight: 600, opacity: 0.5}}>left region</p>
                            <div ref={placeholderRef} />
                        </section>
                    </div>
                </section>
            </div>
        </StoryFrame>
    );
}

//
// * Meta
//

const meta = {
    title: 'Page Editor/Runtime Components',
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Stories for the migrated placeholder islands, shared overlay runtime, and drag-and-drop feedback. Each story exercises the real runtime components and store-driven state.',
            },
        },
    },
    tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

//
// * Placeholder group
//

export const AllPlaceholderStates: Story = {
    name: 'Placeholders / All States',
    render: () => <PlaceholderGallery />,
};

export const StyleIsolation: Story = {
    name: 'Placeholders / Style Isolation',
    render: () => <PlaceholderIsolation />,
};

export const InFlowPlaceholderInFlex: Story = {
    name: 'Placeholders / Flex Layout',
    render: () => <PlaceholderInFlex />,
};

//
// * Overlay group
//

export const SelectionAndHover: Story = {
    name: 'Overlays / Selection And Hover',
    render: () => (
        <OverlayCanvas
            title='Selection crosshair and hover outline'
            description='The selected component gets SVG crosshair lines and a filled rect. The hovered component gets a border outline. Both track their elements through scroll via the geometry scheduler.'
            mode='scrolled-selection'
        />
    ),
};

export const StackedSurfaces: Story = {
    name: 'Overlays / Stacked Surfaces',
    render: () => (
        <OverlayCanvas
            title='Stacked overlay surfaces (locked page)'
            description='Combines selection crosshair, hover outline, locked-page shader, and context menu inside the same shared shadow root to validate layering and interaction.'
            mode='stacked-overlays'
        />
    ),
};

//
// * Drag group
//

export const DragMoveComponent: Story = {
    name: 'Drag / Move Between Regions',
    render: () => <DragMoveCanvas />,
};

export const DragInsertComponent: Story = {
    name: 'Drag / Insert From Context Window',
    render: () => <DragInsertCanvas />,
};

export const DragForbiddenDrop: Story = {
    name: 'Drag / Forbidden Drop',
    render: () => <DragForbiddenCanvas />,
};
