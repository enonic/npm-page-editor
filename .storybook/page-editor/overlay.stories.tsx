import {Lock} from 'lucide-preact';
import {useEffect, useLayoutEffect, useRef, useState} from 'preact/hooks';

import type {ComponentRecord, ComponentRecordType} from '../../src/page-editor/editor/types';
import type {PageJson} from '../../src/page-editor/protocol';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {ComponentChildren, CSSProperties, JSX} from 'preact';

import {ContextMenu} from '../../src/page-editor/editor/components/overlay/context-menu';
import {DragPreview} from '../../src/page-editor/editor/components/overlay/DragPreview';
import {ComponentPlaceholder} from '../../src/page-editor/editor/components/placeholders/ComponentPlaceholder';
import {createPlaceholderIsland} from '../../src/page-editor/editor/rendering/placeholder-island';
import {$page} from '../../src/page-editor/editor/stores/page';
import {$params} from '../../src/page-editor/editor/stores/params';
import {$registry, closeContextMenu, openContextMenu, setDragState} from '../../src/page-editor/editor/stores/registry';
import {ComponentPath} from '../../src/page-editor/protocol/component-path';

//
// * Helpers
//

interface IslandMountProps {
    children: ComponentChildren;
    className?: string;
    style?: CSSProperties;
}

function IslandMount({children, className, style}: IslandMountProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return undefined;
        const island = createPlaceholderIsland(containerRef.current, children);
        return () => island.unmount();
    }, [children]);

    return <div ref={containerRef} className={className} style={style} />;
}

function makeRecord(
    path: string,
    type: ComponentRecordType,
    parentPath: string | undefined,
    children: string[],
    empty = false,
): ComponentRecord {
    return {
        path: ComponentPath.fromString(path),
        type,
        element: undefined,
        parentPath,
        children,
        empty,
        error: false,
        descriptor: undefined,
        loading: false,
    };
}

/**
 * Seeds the stores the context menu reads. The component scene mirrors a part
 * inside a top-level region, so `buildMenuItems` produces select-parent,
 * insert (part/layout/text/fragment), inspect, reset, remove, duplicate and
 * create-fragment.
 */
function seedComponentScene(path: string, type: ComponentRecordType): () => void {
    $params.set({contentId: 'storybook', isFragmentAllowed: true, enableTextComponent: true});
    $registry.set({
        '/': makeRecord('/', 'page', undefined, ['/main']),
        '/main': makeRecord('/main', 'region', '/', [path]),
        [path]: makeRecord(path, type, '/main', []),
    });

    return () => {
        $registry.set({});
        $params.set(undefined);
        $page.set(undefined);
    };
}

//
// * Meta
//

const meta = {
    title: 'Page Editor/Overlay',
    parameters: {layout: 'centered'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * DragPreview
//

const DragPreviewExample = ({dropAllowed, label}: {dropAllowed: boolean; label: string}): JSX.Element => {
    const frameRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        if (!frameRef.current) return undefined;
        const rect = frameRef.current.getBoundingClientRect();
        setDragState({
            itemType: 'part',
            itemLabel: label,
            sourcePath: '/main/0',
            targetPath: dropAllowed ? '/main' : undefined,
            dropAllowed,
            message: undefined,
            placeholderElement: undefined,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        });
        return () => setDragState(undefined);
    }, [dropAllowed, label]);

    return (
        <div ref={frameRef} style={{width: '480px', height: '240px', position: 'relative'}}>
            <IslandMount style={{width: '100%', height: '100%'}}>
                <DragPreview />
            </IslandMount>
        </div>
    );
};

export const DragPreviewAllowed: Story = {
    name: 'DragPreview / Allowed',
    render: () => <DragPreviewExample dropAllowed={true} label='Hero Banner' />,
};

export const DragPreviewForbidden: Story = {
    name: 'DragPreview / Forbidden',
    render: () => <DragPreviewExample dropAllowed={false} label='Layout' />,
};

//
// * ContextMenu
//

type SceneKind = 'component' | 'locked-page';

const COMPONENT_SCENE_PATH = '/main/0';
const COMPONENT_SCENE_TYPE: ComponentRecordType = 'part';

const LockedPageCard = (): JSX.Element => (
    <div className='pe-shell flex w-80 flex-col items-center gap-y-2 rounded-sm border border-bdr-subtle bg-surface-neutral p-6 shadow-md'>
        <Lock className='size-5 text-subtle' strokeWidth={1.75} />
        <p className='text-xs text-subtle'>This page is locked. Right-click to see the available actions.</p>
    </div>
);

const ContextMenuScene = ({kind}: {kind: SceneKind}): JSX.Element => {
    const portalRef = useRef<HTMLDivElement>(null);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined);

    useLayoutEffect(() => {
        if (portalRef.current != null) setPortalContainer(portalRef.current);
    }, []);

    useEffect(() => {
        const cleanup =
            kind === 'component' ? seedComponentScene(COMPONENT_SCENE_PATH, COMPONENT_SCENE_TYPE) : undefined;

        return () => {
            closeContextMenu();
            cleanup?.();
        };
    }, [kind]);

    const handleContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        openContextMenu({kind, path: COMPONENT_SCENE_PATH, x: event.clientX, y: event.clientY});
    };

    return (
        <div className='pe-shell relative flex h-full w-full flex-col items-center justify-center gap-y-4'>
            <p className='text-xs text-subtle'>Right-click the component below to open the context menu</p>
            <div onContextMenu={handleContextMenu} className='cursor-context-menu' style={{width: '280px'}}>
                {kind === 'locked-page' ? (
                    <LockedPageCard />
                ) : (
                    <ComponentPlaceholder type={COMPONENT_SCENE_TYPE} error={false} />
                )}
            </div>
            <div ref={portalRef} />
            <ContextMenu portalContainer={portalContainer} />
        </div>
    );
};

const ContextMenuExample = ({kind}: {kind: SceneKind}): JSX.Element => (
    <IslandMount style={{width: '520px', height: '360px', position: 'relative'}}>
        <ContextMenuScene kind={kind} />
    </IslandMount>
);

export const ContextMenuComponent: Story = {
    name: 'ContextMenu / Component',
    render: () => <ContextMenuExample kind='component' />,
};

export const ContextMenuLocked: Story = {
    name: 'ContextMenu / Locked Page',
    render: () => <ContextMenuExample kind='locked-page' />,
};

//
// * ContextMenu / Text snippet
//

const TEXT_SCENE_PATH = '/main/0';
const TEXT_SCENE_TYPE: ComponentRecordType = 'text';
const LONG_TEXT_HTML =
    '<p>This is a <strong>text component</strong> body that is intentionally long enough to overflow the menu header so the snippet truncates with an ellipsis.</p>';

const ContextMenuTextScene = (): JSX.Element => {
    const portalRef = useRef<HTMLDivElement>(null);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined);

    useLayoutEffect(() => {
        if (portalRef.current != null) setPortalContainer(portalRef.current);
    }, []);

    useEffect(() => {
        const cleanup = seedComponentScene(TEXT_SCENE_PATH, TEXT_SCENE_TYPE);

        // The menu header reads the text snippet from the page store (WS4).
        const page: PageJson = {
            regions: [{name: 'main', components: [{TextComponent: {text: LONG_TEXT_HTML}}]}],
        };
        $page.set(page);

        return () => {
            closeContextMenu();
            cleanup();
        };
    }, []);

    const handleContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        openContextMenu({kind: 'component', path: TEXT_SCENE_PATH, x: event.clientX, y: event.clientY});
    };

    return (
        <div className='pe-shell relative flex h-full w-full flex-col items-center justify-center gap-y-4'>
            <p className='text-xs text-subtle'>Right-click the text component below to open the context menu</p>
            <div onContextMenu={handleContextMenu} className='cursor-context-menu' style={{width: '280px'}}>
                <ComponentPlaceholder type={TEXT_SCENE_TYPE} error={false} />
            </div>
            <div ref={portalRef} />
            <ContextMenu portalContainer={portalContainer} />
        </div>
    );
};

export const ContextMenuText: Story = {
    name: 'ContextMenu / Text Snippet',
    render: () => (
        <IslandMount style={{width: '520px', height: '360px', position: 'relative'}}>
            <ContextMenuTextScene />
        </IslandMount>
    ),
};
