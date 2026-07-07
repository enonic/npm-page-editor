import {cn} from '@enonic/ui';
import {useEffect, useRef} from 'preact/hooks';

import type {ComponentRecord, ComponentRecordType} from '../../src/page-editor/editor/types';
import type {Meta, StoryObj} from '@storybook/preact-vite';

import {initPlaceholderDragSync, syncPlaceholders} from '../../src/page-editor/editor/adapter/placeholder-lifecycle';
import {setPageRoot} from '../../src/page-editor/editor/adapter/reconcile';
import {DragPlaceholderPortal} from '../../src/page-editor/editor/components/overlay/DragPlaceholderPortal';
import {initGeometryTriggers, markDirty} from '../../src/page-editor/editor/geometry/scheduler';
import {ensurePlaceholderAnchor} from '../../src/page-editor/editor/interaction/drag/drop-positioning';
import {createOverlayHost} from '../../src/page-editor/editor/rendering/overlay-host';
import {rebuildIndex} from '../../src/page-editor/editor/stores/element-index';
import {getRecord, setDragState, setModifyAllowed, setRegistry} from '../../src/page-editor/editor/stores/registry';
import {ComponentPath} from '../../src/page-editor/protocol';

//
// * Helpers
//

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

//
// * Styles
//

// Mimic the embedding site: a grid region that stretches its cell, plus a hostile
// child-margin rule (verticalSpace-style) that would shift our injected boxes.
// `.site-flex` is a shrink-to-fit context — a flex row that sizes its child to
// content, which is where an empty drop placeholder would collapse to its padding.
const SITE_CSS = `
.site-grid {
    display: grid;
    gap: 12px;
    min-height: 120px;
}
.site-grid > * {
    margin-top: 4!important;
}
.site-flex {
    display: flex;
    gap: 12px;
    min-height: 120px;
}
`;

//
// * Story component
//

type EmptyRegionDropTargetProps = {
    layout?: 'grid' | 'flex';
    widthClassName?: string;
};

function EmptyRegionDropTarget({layout = 'grid', widthClassName = 'w-2xl'}: EmptyRegionDropTargetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mainRegionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const mainRegion = mainRegionRef.current;
        if (!container || !mainRegion) return undefined;

        const records: Record<string, ComponentRecord> = {
            '/': makeRecord('/', 'page', container, undefined, ['/main']),
            '/main': makeRecord('/main', 'region', mainRegion, '/', [], true),
        };

        setPageRoot(container);

        // Only the drag placeholder portal is needed for this demo — the rest of
        // the overlay chrome (DragPreview, highlighters) would render a stray
        // cursor preview at the static x/y below.
        const overlay = createOverlayHost(<DragPlaceholderPortal />);
        setRegistry(records);
        rebuildIndex(records);
        setModifyAllowed(true);

        const stopSync = initPlaceholderDragSync();
        const stopGeometry = initGeometryTriggers();

        // 1. Region is empty → RegionPlaceholder island is created in it.
        syncPlaceholders(records);

        // 2. Simulate a drag landing on the empty region: insert the drag anchor
        //    and publish drag state targeting this region. DragPlaceholderPortal
        //    mounts the DragPlaceholder into the anchor; the targetPath listener
        //    re-syncs and (with the fix) destroys the now-redundant region host.
        const regionRecord = getRecord('/main');
        if (regionRecord) {
            const anchor = ensurePlaceholderAnchor(undefined, regionRecord, 0);
            setDragState({
                itemType: 'part',
                itemLabel: 'Part',
                sourcePath: '/external-source',
                targetPath: '/main',
                dropAllowed: true,
                message: undefined,
                placeholderElement: anchor,
                x: 0,
                y: 0,
            });
        }

        markDirty();

        return () => {
            stopGeometry();
            stopSync();
            setDragState(undefined);
            overlay.unmount();
            setRegistry({});
            setPageRoot(undefined);
        };
    }, []);

    return (
        <div className='flex flex-col items-center max-w-120'>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: story-only site CSS simulation */}
            <style dangerouslySetInnerHTML={{__html: SITE_CSS}} />
            <div
                ref={containerRef}
                data-testid='empty-region-canvas'
                className={cn(widthClassName, 'rounded-xl border border-decorative bg-white p-5')}
            >
                <section
                    ref={mainRegionRef}
                    className={layout === 'flex' ? 'site-flex' : 'site-grid'}
                    data-portal-region='main'
                    data-testid='main-region'
                />
            </div>
            <p className='mt-3 text-xs text-subtle'>
                {layout === 'flex' ? (
                    <>
                        Static snapshot — the region is a shrink-to-fit flex container. The drag placeholder keeps the
                        same intrinsic width as the idle “Drop components here...” placeholder instead of collapsing to
                        its padding.
                    </>
                ) : (
                    <>
                        Static snapshot — not interactive. Shows the drag placeholder filling an empty region while that
                        region is the active drop target.
                    </>
                )}
            </p>
        </div>
    );
}

//
// * Meta
//

const meta = {
    title: 'Page Editor/Drag',
    parameters: {layout: 'centered'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyRegionTarget: Story = {
    name: 'Drag / Empty Region Drop Target',
    render: () => <EmptyRegionDropTarget />,
};

export const EmptyRegionTargetShrinkToFit: Story = {
    name: 'Drag / Empty Region (Shrink-to-fit)',
    render: () => <EmptyRegionDropTarget layout='flex' widthClassName='w-80' />,
};
