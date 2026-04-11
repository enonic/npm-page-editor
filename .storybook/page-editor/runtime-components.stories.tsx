import type {Meta, StoryObj} from '@storybook/preact-vite';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {ComponentChildren, CSSProperties} from 'preact';
import {useEffect, useRef} from 'preact/hooks';
import {ComponentPlaceholder} from '../../src/main/resources/assets/js/new-ui/components/placeholders/ComponentPlaceholder';
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

interface IslandMountProps {
    children: ComponentChildren;
    className?: string;
    style?: CSSProperties;
}

interface PlaceholderCanvasProps {
    title: string;
    description: string;
    customerCss?: string;
    children: ComponentChildren;
}

interface OverlayCanvasProps {
    title: string;
    description: string;
    mode: 'scrolled-selection' | 'stacked-overlays';
}

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

function PlaceholderCanvas({title, description, customerCss, children}: PlaceholderCanvasProps) {
    return (
        <section style={{display: 'grid', gap: '16px'}}>
            <header style={{display: 'grid', gap: '6px'}}>
                <p style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7}}>
                    Runtime placeholder story
                </p>
                <div>
                    <h2 style={{margin: 0, fontSize: '24px'}}>{title}</h2>
                    <p style={{margin: '6px 0 0', maxWidth: '72ch', opacity: 0.78}}>{description}</p>
                </div>
            </header>
            <div
                style={{
                    border: '1px solid rgba(33, 52, 75, 0.14)',
                    borderRadius: '24px',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,246,250,0.98))',
                    boxShadow: '0 24px 48px -28px rgba(15,23,42,0.28)',
                    padding: '24px',
                }}
            >
                {customerCss ? <style>{customerCss}</style> : null}
                {children}
            </div>
        </section>
    );
}

function OverlayCanvas({title, description, mode}: OverlayCanvasProps) {
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

        setCurrentPageView({
            getComponentViewByPath: () => ({
                getContextMenuActions: () => createComponentActions(),
            }),
            getLockedMenuActions: () => [new Action('Page settings').setSortOrder(10)],
        } as never);

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

    return (
        <section style={{display: 'grid', gap: '16px'}}>
            <header style={{display: 'grid', gap: '6px'}}>
                <p style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7}}>
                    Runtime overlay story
                </p>
                <div>
                    <h2 style={{margin: 0, fontSize: '24px'}}>{title}</h2>
                    <p style={{margin: '6px 0 0', maxWidth: '72ch', opacity: 0.78}}>{description}</p>
                </div>
            </header>
            <div
                ref={scrollerRef}
                style={{
                    height: '430px',
                    overflow: 'auto',
                    border: '1px solid rgba(33, 52, 75, 0.14)',
                    borderRadius: '24px',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,246,250,0.98))',
                    boxShadow: '0 24px 48px -28px rgba(15,23,42,0.28)',
                    padding: '24px',
                }}
            >
                <div
                    ref={frameRef}
                    style={{
                        minHeight: '860px',
                        display: 'grid',
                        gap: '22px',
                        alignContent: 'start',
                        backgroundImage: 'linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                        padding: '16px',
                        borderRadius: '18px',
                    }}
                >
                    <section
                        ref={mainRef}
                        data-portal-region='main'
                        style={{display: 'grid', gap: '18px'}}
                    >
                        <article
                            ref={heroRef}
                            data-portal-component-type='part'
                            style={{
                                minHeight: '160px',
                                borderRadius: '24px',
                                background: 'linear-gradient(140deg, rgba(66, 153, 225, 0.18), rgba(15, 23, 42, 0.04))',
                                border: '1px solid rgba(66, 153, 225, 0.22)',
                                padding: '24px',
                            }}
                        >
                            <p style={{margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7}}>
                                Selected component
                            </p>
                            <h3 style={{margin: '12px 0 8px', fontSize: '28px'}}>Hero banner</h3>
                            <p style={{margin: 0, maxWidth: '48ch', opacity: 0.8}}>
                                The selection crosshair and context menu are mounted through the shared overlay root.
                            </p>
                        </article>
                        <article
                            ref={teaserRef}
                            data-portal-component-type='part'
                            style={{
                                minHeight: '120px',
                                borderRadius: '22px',
                                background: 'rgba(255,255,255,0.88)',
                                border: '1px solid rgba(33, 52, 75, 0.14)',
                                padding: '20px',
                            }}
                        >
                            <p style={{margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7}}>
                                Hovered component
                            </p>
                            <h3 style={{margin: '10px 0 8px', fontSize: '22px'}}>Teaser rail</h3>
                            <p style={{margin: 0, maxWidth: '46ch', opacity: 0.8}}>
                                Scroll the canvas to verify that the migrated geometry scheduler keeps overlay chrome aligned.
                            </p>
                        </article>
                        <article
                            ref={railRef}
                            data-portal-component-type='part'
                            style={{
                                minHeight: '220px',
                                borderRadius: '22px',
                                background: 'rgba(15,23,42,0.04)',
                                border: '1px dashed rgba(33, 52, 75, 0.18)',
                                padding: '20px',
                            }}
                        >
                            <h3 style={{margin: 0, fontSize: '18px'}}>Content rail</h3>
                            <p style={{margin: '8px 0 0', maxWidth: '56ch', opacity: 0.75}}>
                                This extra card keeps the story tall enough to exercise scrolling and overlay recomputation.
                            </p>
                        </article>
                    </section>
                </div>
            </div>
        </section>
    );
}

function DragCanvas() {
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

        setCurrentPageView({
            getComponentViewByPath: () => ({
                getContextMenuActions: () => createComponentActions(),
            }),
            getLockedMenuActions: () => [new Action('Page settings').setSortOrder(10)],
        } as never);

        const records = {
            '/': createRecord('/', 'page', frameRef.current, undefined, ['/main', '/aside']),
            '/main': createRecord('/main', 'region', sourceRegionRef.current, '/', ['/main/0']),
            '/main/0': createRecord('/main/0', 'part', sourceRef.current, '/main', [], 'site:hero'),
            '/aside': createRecord('/aside', 'region', targetRegionRef.current, '/', []),
        };

        setRegistry(records);
        rebuildIndex(records);
        setSelectedPath('/main/0');
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

        const frame = window.requestAnimationFrame(() => {
            markDirty();
        });

        return () => {
            window.cancelAnimationFrame(frame);
            overlay.unmount();
            resetRuntimeState();
        };
    }, []);

    return (
        <section style={{display: 'grid', gap: '16px'}}>
            <header style={{display: 'grid', gap: '6px'}}>
                <p style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7}}>
                    Runtime drag story
                </p>
                <div>
                    <h2 style={{margin: 0, fontSize: '24px'}}>Drag session feedback</h2>
                    <p style={{margin: '6px 0 0', maxWidth: '72ch', opacity: 0.78}}>
                        The migrated runtime renders a fixed drag preview, a region target highlighter, and a shadow-root drop placeholder while the legacy sortable engine still owns the physical move.
                    </p>
                </div>
            </header>
            <div
                style={{
                    border: '1px solid rgba(33, 52, 75, 0.14)',
                    borderRadius: '24px',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,246,250,0.98))',
                    boxShadow: '0 24px 48px -28px rgba(15,23,42,0.28)',
                    padding: '24px',
                }}
            >
                <div
                    ref={frameRef}
                    style={{
                        display: 'grid',
                        gap: '20px',
                        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(260px, 0.8fr)',
                        alignItems: 'start',
                    }}
                >
                    <section
                        ref={sourceRegionRef}
                        data-portal-region='main'
                        style={{display: 'grid', gap: '16px'}}
                    >
                        <article
                            ref={sourceRef}
                            data-portal-component-type='part'
                            style={{
                                minHeight: '180px',
                                borderRadius: '24px',
                                background: 'linear-gradient(140deg, rgba(66, 153, 225, 0.18), rgba(15, 23, 42, 0.04))',
                                border: '1px solid rgba(66, 153, 225, 0.22)',
                                padding: '24px',
                            }}
                        >
                            <p style={{margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7}}>
                                Drag source
                            </p>
                            <h3 style={{margin: '12px 0 8px', fontSize: '28px'}}>Hero banner</h3>
                            <p style={{margin: 0, maxWidth: '48ch', opacity: 0.8}}>
                                The source component keeps its DOM in light mode while the drag preview and target feedback render through the migrated runtime.
                            </p>
                        </article>
                    </section>
                    <aside
                        ref={targetRegionRef}
                        data-portal-region='aside'
                        style={{
                            minHeight: '260px',
                            borderRadius: '24px',
                            border: '1px dashed rgba(33, 52, 75, 0.2)',
                            background: 'rgba(15,23,42,0.03)',
                            padding: '20px',
                        }}
                    >
                        <p style={{margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7}}>
                            Drop target region
                        </p>
                        <div ref={placeholderRef} style={{marginTop: '18px'}} />
                    </aside>
                </div>
            </div>
        </section>
    );
}

const meta = {
    title: 'Page Editor/Runtime Components',
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Stories for the actual migrated placeholder islands and shared overlay runtime, rather than design-only mockups.',
            },
        },
    },
    tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const InFlowPlaceholderInFlex: Story = {
    render: () => (
        <PlaceholderCanvas
            title='Placeholder inside a narrow flex layout'
            description='The real `createPlaceholderIsland()` runtime is mounted inside customer DOM so the empty-region card participates in layout flow without leaking styles outward.'
        >
            <div style={{display: 'grid', gap: '16px', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(240px, 0.6fr)'}}>
                <div style={{display: 'flex', gap: '16px', alignItems: 'stretch'}}>
                    <div style={{flex: '1 1 0', minHeight: '190px', borderRadius: '20px', background: 'rgba(255,255,255,0.84)', border: '1px solid rgba(33,52,75,0.12)', padding: '18px'}}>
                        <h3 style={{margin: '0 0 10px', fontSize: '18px'}}>Content column</h3>
                        <p style={{margin: 0, opacity: 0.78}}>Customer content stays in the light DOM while the placeholder is isolated in its own shadow island.</p>
                    </div>
                    <IslandMount style={{flex: '0 0 280px'}}>
                        <RegionPlaceholder regionName='main' />
                    </IslandMount>
                </div>
                <aside style={{borderRadius: '20px', background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(33,52,75,0.12)', padding: '18px'}}>
                    <p style={{margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7}}>
                        Why this story exists
                    </p>
                    <p style={{margin: '10px 0 0', opacity: 0.8}}>
                        This validates the risk called out in the architecture doc: placeholder hosts must behave inside tight flex layouts without collapsing or inheriting customer CSS.
                    </p>
                </aside>
            </div>
        </PlaceholderCanvas>
    ),
};

export const PlaceholderStyleIsolation: Story = {
    render: () => (
        <PlaceholderCanvas
            title='Placeholder style isolation under hostile customer CSS'
            description='The surrounding page aggressively resets typography, borders, and spacing, but the migrated component placeholders keep their own styling because the runtime mounts them into shadow roots.'
            customerCss={`
                .customer-reset * {
                    font-family: 'Courier New', monospace !important;
                    color: #9f1239 !important;
                    border-radius: 0 !important;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }

                .customer-reset p,
                .customer-reset h3 {
                    margin: 0;
                }
            `}
        >
            <div className='customer-reset' style={{display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
                <IslandMount>
                    <ComponentPlaceholder type='part' descriptor='com.acme.app:hero-banner' error={false} />
                </IslandMount>
                <IslandMount>
                    <ComponentPlaceholder type='part' descriptor='com.acme.app:hero-banner' error={true} />
                </IslandMount>
            </div>
        </PlaceholderCanvas>
    ),
};

export const OverlayOnScrolledPage: Story = {
    render: () => (
        <OverlayCanvas
            title='Overlay tracking on a scrolled page'
            description='The shared overlay root follows the selected and hovered components after the canvas scrolls, using the migrated geometry scheduler and tracked DOM rect hooks.'
            mode='scrolled-selection'
        />
    ),
};

export const MultipleOverlays: Story = {
    render: () => (
        <OverlayCanvas
            title='Stacked overlay surfaces'
            description='This combines the selection crosshair, hover outline, locked-page shader, and migrated context menu inside the same shared shadow root to validate layering and interaction ownership.'
            mode='stacked-overlays'
        />
    ),
};

export const DragSessionFeedback: Story = {
    render: () => <DragCanvas />,
};
