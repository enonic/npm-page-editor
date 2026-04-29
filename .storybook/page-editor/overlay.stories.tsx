import type {Meta, StoryObj} from '@storybook/preact-vite';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {PageState} from '@enonic/lib-contentstudio/app/wizard/page/PageState';
import {TextComponentBuilder} from '@enonic/lib-contentstudio/app/page/region/TextComponent';
import type {ComponentChildren, CSSProperties, JSX} from 'preact';
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'preact/hooks';
import {Lock} from 'lucide-preact';
import {ComponentPlaceholder} from '../../src/main/resources/assets/js/page-editor/editor/components/placeholders/ComponentPlaceholder';
import {ContextMenu} from '../../src/main/resources/assets/js/page-editor/editor/components/overlay/context-menu';
import {DragPreview} from '../../src/main/resources/assets/js/page-editor/editor/components/overlay/DragPreview';
import {PagePlaceholderCard} from '../../src/main/resources/assets/js/page-editor/editor/components/overlay/PagePlaceholderOverlay';
import {setCurrentPageView} from '../../src/main/resources/assets/js/page-editor/editor/bridge';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/page-editor/editor/rendering/placeholder-island';
import type {ComponentRecord, ComponentRecordType} from '../../src/main/resources/assets/js/page-editor/editor/types';
import {
    $registry,
    closeContextMenu,
    openContextMenu,
    setDragState,
} from '../../src/main/resources/assets/js/page-editor/editor/stores/registry';

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

function makeAction(label: string, sortOrder: number, enabled = true): Action {
    const action = new Action(label);
    action.setSortOrder(sortOrder);
    if (!enabled) action.setEnabled(false);
    return action;
}

function makeInsertAction(label: string, iconKey: string, sortOrder: number): Action {
    const action = makeAction(label, sortOrder);
    action.setIconClass(`xp-admin-common-icon-${iconKey}`);
    return action;
}

function createComponentActions(): Action[] {
    const insertGroup = makeAction('Insert', 20);
    insertGroup.setChildActions([
        makeInsertAction('Part', 'part', 10),
        makeInsertAction('Layout', 'layout', 20),
        makeInsertAction('Text', 'text', 30),
        makeInsertAction('Fragment', 'fragment', 40),
    ]);

    return [
        makeAction('Select parent', 0),
        insertGroup,
        makeAction('Inspect', 30),
        makeAction('Duplicate', 40),
        makeAction('Reset', 50, false),
        makeAction('Delete', 60),
    ];
}

function createLockedActions(): Action[] {
    return [
        makeAction('Unlock', 10),
        makeAction('Open settings', 20),
    ];
}

function mockPageViewWithActions(actions: Action[]): void {
    setCurrentPageView({
        getComponentViewByPath: () => ({getContextMenuActions: () => actions}),
        getLockedMenuActions: () => actions,
    } as never);
}

function seedRegistryRecord(path: string, type: ComponentRecordType): () => void {
    const record: ComponentRecord = {
        path: ComponentPath.fromString(path),
        type,
        element: undefined,
        parentPath: undefined,
        children: [],
        empty: false,
        error: false,
        descriptor: undefined,
        loading: false,
    };
    $registry.setKey(path, record);
    return () => {
        const next = {...$registry.get()};
        delete next[path];
        $registry.set(next);
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
    useEffect(() => {
        setDragState({
            itemType: 'part',
            itemLabel: label,
            sourcePath: '/main/0',
            targetPath: dropAllowed ? '/main' : undefined,
            dropAllowed,
            message: undefined,
            placeholderElement: undefined,
            x: 200,
            y: 160,
        });
        return () => setDragState(undefined);
    }, [dropAllowed, label]);

    return (
        <IslandMount style={{width: '480px', height: '240px', position: 'relative'}}>
            <DragPreview />
        </IslandMount>
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
    const targetRef = useRef<HTMLDivElement>(null);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined);
    const [lastAction, setLastAction] = useState<string | undefined>(undefined);

    const actions = useMemo(() => {
        const list = kind === 'locked-page' ? createLockedActions() : createComponentActions();

        const wire = (action: Action): void => {
            action.onExecuted(a => {
                const label = a.getLabel();
                // eslint-disable-next-line no-console
                console.log(`[ContextMenu story] action executed: ${label}`);
                setLastAction(label);
            });
            if (action.hasChildActions()) {
                action.getChildActions().forEach(wire);
            }
        };

        list.forEach(wire);
        return list;
    }, [kind]);

    useLayoutEffect(() => {
        if (portalRef.current != null) setPortalContainer(portalRef.current);
    }, []);

    useEffect(() => {
        mockPageViewWithActions(actions);
        const cleanupRecord = kind === 'component' ? seedRegistryRecord(COMPONENT_SCENE_PATH, COMPONENT_SCENE_TYPE) : undefined;

        return () => {
            closeContextMenu();
            setCurrentPageView(undefined);
            cleanupRecord?.();
        };
    }, [actions, kind]);

    const handleContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        openContextMenu({kind, path: COMPONENT_SCENE_PATH, x: event.clientX, y: event.clientY});
    };

    return (
        <div className='pe-shell relative flex h-full w-full flex-col items-center justify-center gap-y-4'>
            <p className='text-xs text-subtle'>Right-click the component below to open the context menu</p>
            <div
                ref={targetRef}
                onContextMenu={handleContextMenu}
                className='cursor-context-menu'
                style={{width: '280px'}}
            >
                {kind === 'locked-page' ? <LockedPageCard /> : <ComponentPlaceholder type={COMPONENT_SCENE_TYPE} error={false} />}
            </div>
            {lastAction != null && (
                <div className='absolute top-3 rounded-sm border border-bdr-subtle bg-surface-neutral px-3 py-1.5 text-xs shadow-md'>
                    Executed: <strong>{lastAction}</strong>
                </div>
            )}
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

    const actions = useMemo(() => createComponentActions(), []);

    useLayoutEffect(() => {
        if (portalRef.current != null) setPortalContainer(portalRef.current);
    }, []);

    useEffect(() => {
        const textComponent = new TextComponentBuilder().setText(LONG_TEXT_HTML).build();
        const original = PageState.getComponentByPath;
        (PageState as unknown as {getComponentByPath: () => unknown}).getComponentByPath = () => textComponent;

        mockPageViewWithActions(actions);
        const cleanupRecord = seedRegistryRecord(TEXT_SCENE_PATH, TEXT_SCENE_TYPE);

        return () => {
            (PageState as unknown as {getComponentByPath: typeof original}).getComponentByPath = original;
            closeContextMenu();
            setCurrentPageView(undefined);
            cleanupRecord();
        };
    }, [actions]);

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

//
// * PagePlaceholder
//

export const PagePlaceholderStates: Story = {
    name: 'PagePlaceholder / States',
    parameters: {layout: 'fullscreen'},
    render: () => (
        <div className='pe-shell flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-primary p-6'>
            <PagePlaceholderCard hasControllers={false} />
            <PagePlaceholderCard hasControllers={true} />
            <PagePlaceholderCard hasControllers={true} contentTypeDisplayName='Article' />
        </div>
    ),
};
