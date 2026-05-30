import type {Meta, StoryObj} from '@storybook/preact-vite';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {useEffect, useRef} from 'preact/hooks';
import {DragPlaceholderPortal} from '../../src/main/resources/assets/js/page-editor/editor/components/overlay/DragPlaceholderPortal';
import {
    initPlaceholderDragSync,
    syncPlaceholders,
} from '../../src/main/resources/assets/js/page-editor/editor/adapter/placeholder-lifecycle';
import {setCurrentPageView} from '../../src/main/resources/assets/js/page-editor/editor/bridge';
import {
    initGeometryTriggers,
    markDirty,
} from '../../src/main/resources/assets/js/page-editor/editor/geometry/scheduler';
import {ensurePlaceholderAnchor} from '../../src/main/resources/assets/js/page-editor/editor/interaction/drag/drop-positioning';
import {createOverlayHost} from '../../src/main/resources/assets/js/page-editor/editor/rendering/overlay-host';
import {rebuildIndex} from '../../src/main/resources/assets/js/page-editor/editor/stores/element-index';
import {
    getRecord,
    setDragState,
    setModifyAllowed,
    setRegistry,
} from '../../src/main/resources/assets/js/page-editor/editor/stores/registry';
import type {ComponentRecord, ComponentRecordType} from '../../src/main/resources/assets/js/page-editor/editor/types';

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

function createMockPageView(element: HTMLElement) {
    return {
        getHTMLElement: () => element,
        isLocked: () => false,
        getSelectedView: () => undefined,
        getLiveEditParams: () => ({contentId: 'storybook', isFragment: false, modifyPermissions: true}),
        getComponentViewByPath: () => ({getContextMenuActions: () => []}),
        getLockedMenuActions: () => [],
    } as never;
}

//
// * Styles
//

// Mimic the embedding site: a grid region that stretches its cell, plus a hostile
// child-margin rule (verticalSpace-style) that would shift our injected boxes.
const SITE_CSS = `
.site-grid {
    display: grid;
    gap: 12px;
    min-height: 120px;
}
.site-grid > * {
    margin-top: 4!important;
}
`;

//
// * Story component
//

function EmptyRegionDropTarget() {
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

        setCurrentPageView(createMockPageView(container));

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
            setCurrentPageView(undefined);
        };
    }, []);

    return (
        <div>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: story-only site CSS simulation */}
            <style dangerouslySetInnerHTML={{__html: SITE_CSS}} />
            <div
                ref={containerRef}
                data-testid="empty-region-canvas"
                className="w-2xl rounded-xl border border-decorative bg-white p-5"
            >
                <section
                    ref={mainRegionRef}
                    className="site-grid"
                    data-portal-region="main"
                    data-testid="main-region"
                />
            </div>
            <p className="mt-3 text-xs text-subtle">
                Static snapshot — not interactive. Shows the drag placeholder filling an empty
                region while that region is the active drop target.
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
