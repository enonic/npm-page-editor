import {useEffect, useRef, useState} from 'preact/hooks';

import type {
  ComponentPath,
  ComponentType,
  PageConfig,
  PageController,
} from '../../src/main/resources/assets/js/v2/protocol';
import type {ComponentRecord} from '../../src/main/resources/assets/js/v2/state';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {ComponentChildren, CSSProperties, JSX} from 'preact';

import {ComponentErrorPlaceholder} from '../../src/main/resources/assets/js/v2/components/ComponentErrorPlaceholder';
import {ComponentPlaceholder} from '../../src/main/resources/assets/js/v2/components/ComponentPlaceholder';
import {ContextMenu} from '../../src/main/resources/assets/js/v2/components/ContextMenu';
import {DragPreview} from '../../src/main/resources/assets/js/v2/components/DragPreview';
import {PagePlaceholderOverlay} from '../../src/main/resources/assets/js/v2/components/PagePlaceholderOverlay';
import {Shader} from '../../src/main/resources/assets/js/v2/components/Shader';
import {fromString} from '../../src/main/resources/assets/js/v2/protocol';
import {createOverlayHost, createPlaceholderIsland} from '../../src/main/resources/assets/js/v2/rendering';
import {
  closeContextMenu,
  openContextMenu,
  rebuildIndex,
  setDragState,
  setLocked,
  setModifyAllowed,
  setPageConfig,
  setPageControllers,
  setRegistry,
  setSelectedPath,
} from '../../src/main/resources/assets/js/v2/state';

//
// * Helpers
//

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeRecord(raw: string, type: ComponentType, empty = false): ComponentRecord {
  return {
    path: path(raw),
    type,
    element: undefined,
    parentPath: undefined,
    children: [],
    empty,
    error: false,
    descriptor: undefined,
    fragmentContentId: undefined,
    loading: false,
  };
}

const DEFAULT_CONFIG: PageConfig = {
  contentId: 'storybook',
  pageName: 'My Page',
  pageIconClass: 'icon-page',
  locked: false,
  modifyPermissions: true,
  pageEmpty: false,
  pageTemplate: false,
  fragment: false,
  fragmentAllowed: true,
  resetEnabled: true,
  phrases: {},
};

const SAMPLE_CONTROLLERS: PageController[] = [
  {descriptorKey: 'com.example:default', displayName: 'Default Page', iconClass: 'icon-page'},
  {descriptorKey: 'com.example:landing', displayName: 'Landing Page', iconClass: 'icon-page'},
  {descriptorKey: 'com.example:blog', displayName: 'Blog Post', iconClass: 'icon-page'},
];

function resetState(): void {
  closeContextMenu();
  setSelectedPath(undefined);
  setDragState(undefined);
  setLocked(false);
  setModifyAllowed(true);
  setRegistry({});
  setPageControllers([]);
}

type IslandMountProps = {
  children: ComponentChildren;
  style?: CSSProperties;
};

function IslandMount({children, style}: IslandMountProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const island = createPlaceholderIsland(containerRef.current, children);
    return () => island.unmount();
  }, [children]);

  return <div ref={containerRef} style={style} />;
}

function OverlayHostMount({children}: {children: ComponentChildren}): JSX.Element {
  useEffect(() => {
    const overlay = createOverlayHost(children);
    return () => overlay.unmount();
  }, [children]);

  return (
    <div className='text-sm text-subtle'>
      Content is rendered in a fixed overlay shadow root. Inspect the DOM to verify.
    </div>
  );
}

//
// * Meta
//

const meta = {
  title: 'Page Editor/Components',
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Context Menu
//

function ContextMenuDemo(): JSX.Element {
  const [componentType, setComponentType] = useState<ComponentType>('part');

  useEffect(() => {
    const records: Record<string, ComponentRecord> = {
      '/': {...makeRecord('/', 'page'), children: [path('/main')]},
      '/main': {...makeRecord('/main', 'region'), parentPath: path('/'), children: [path('/main/0')]},
      '/main/0': {...makeRecord('/main/0', componentType), parentPath: path('/main')},
    };

    setRegistry(records);
    rebuildIndex(records);
    setPageConfig(DEFAULT_CONFIG);
    openContextMenu({kind: 'component', path: path('/main/0'), x: 20, y: 20});

    return resetState;
  }, [componentType]);

  return (
    <div>
      <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
        {(['part', 'layout', 'text', 'fragment'] as ComponentType[]).map(t => (
          <button
            key={t}
            style={{
              padding: '4px 12px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: t === componentType ? '#3b82f6' : '#e5e7eb',
              background: t === componentType ? '#eff6ff' : '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onClick={() => setComponentType(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <OverlayHostMount>
        <ContextMenu />
      </OverlayHostMount>
    </div>
  );
}

export const ContextMenuActions: Story = {
  name: 'Examples / Context Menu',
  render: () => <ContextMenuDemo />,
};

export const ContextMenuLocked: Story = {
  name: 'States / Context Menu Locked',
  render: () => {
    openContextMenu({kind: 'locked-page', path: path('/'), x: 20, y: 20});
    return (
      <OverlayHostMount>
        <ContextMenu />
      </OverlayHostMount>
    );
  },
};

//
// * Shader
//

function ShaderDemo(): JSX.Element {
  const [locked, setLockedLocal] = useState(true);
  const [modify, setModifyLocal] = useState(true);

  useEffect(() => {
    setLocked(locked);
    setModifyAllowed(modify);
    return resetState;
  }, [locked, modify]);

  return (
    <div>
      <div style={{display: 'flex', gap: '12px', marginBottom: '16px'}}>
        <label style={{fontSize: '13px', display: 'flex', gap: '4px', alignItems: 'center'}}>
          <input
            type='checkbox'
            checked={locked}
            onChange={e => setLockedLocal((e.target as HTMLInputElement).checked)}
          />
          Locked
        </label>
        <label style={{fontSize: '13px', display: 'flex', gap: '4px', alignItems: 'center'}}>
          <input
            type='checkbox'
            checked={modify}
            onChange={e => setModifyLocal((e.target as HTMLInputElement).checked)}
          />
          Modify Allowed
        </label>
      </div>
      <OverlayHostMount>
        <Shader />
      </OverlayHostMount>
    </div>
  );
}

export const ShaderStates: Story = {
  name: 'Examples / Shader',
  render: () => <ShaderDemo />,
};

//
// * Drag Preview
//

function DragPreviewDemo(): JSX.Element {
  useEffect(() => {
    setDragState({
      itemType: 'part',
      itemLabel: 'Hero Banner',
      sourcePath: path('/main/0'),
      targetRegion: path('/main'),
      targetIndex: undefined,
      dropAllowed: true,
      placeholderElement: undefined,
      x: 0,
      y: 0,
    });
    return resetState;
  }, []);

  return (
    <div className='h-32 w-120' style={{transform: 'translate(0, 0)'}}>
      <DragPreview />
    </div>
  );
}

export const DragPreviewAllowed: Story = {
  name: 'States / Drag Preview Allowed',
  render: () => <DragPreviewDemo />,
};

function DragPreviewForbiddenDemo(): JSX.Element {
  useEffect(() => {
    setDragState({
      itemType: 'layout',
      itemLabel: 'Two Column Layout',
      sourcePath: path('/main/0'),
      targetRegion: path('/main/1/left'),
      targetIndex: 0,
      dropAllowed: false,
      placeholderElement: undefined,
      x: 0,
      y: 0,
    });
    return resetState;
  }, []);

  return (
    <div className='h-32 w-120' style={{transform: 'translate(0, 0)'}}>
      <DragPreview />
    </div>
  );
}

export const DragPreviewForbidden: Story = {
  name: 'States / Drag Preview Forbidden',
  render: () => <DragPreviewForbiddenDemo />,
};

function DragPreviewInsertDemo(): JSX.Element {
  useEffect(() => {
    setDragState({
      itemType: 'part',
      itemLabel: 'Content Block',
      sourcePath: undefined,
      targetRegion: path('/main'),
      targetIndex: 0,
      dropAllowed: true,
      placeholderElement: undefined,
      x: 0,
      y: 0,
    });
    return resetState;
  }, []);

  return (
    <div className='h-32 w-120' style={{transform: 'translate(0, 0)'}}>
      <DragPreview />
    </div>
  );
}

export const DragPreviewInsert: Story = {
  name: 'States / Drag Preview Insert',
  render: () => <DragPreviewInsertDemo />,
};

//
// * Page Placeholder Overlay
//

function PagePlaceholderDemo(): JSX.Element {
  useEffect(() => {
    const records: Record<string, ComponentRecord> = {
      '/': {...makeRecord('/', 'page', true)},
    };

    setRegistry(records);
    rebuildIndex(records);
    setPageControllers(SAMPLE_CONTROLLERS);
    setModifyAllowed(true);

    return resetState;
  }, []);

  return (
    <OverlayHostMount>
      <PagePlaceholderOverlay />
    </OverlayHostMount>
  );
}

export const PagePlaceholder: Story = {
  name: 'Examples / Page Placeholder',
  render: () => <PagePlaceholderDemo />,
};

function PagePlaceholderEmptyDemo(): JSX.Element {
  useEffect(() => {
    const records: Record<string, ComponentRecord> = {
      '/': {...makeRecord('/', 'page', true)},
    };

    setRegistry(records);
    rebuildIndex(records);
    setPageControllers([]);
    setModifyAllowed(true);

    return resetState;
  }, []);

  return (
    <OverlayHostMount>
      <PagePlaceholderOverlay />
    </OverlayHostMount>
  );
}

export const PagePlaceholderEmpty: Story = {
  name: 'States / Page Placeholder No Controllers',
  render: () => <PagePlaceholderEmptyDemo />,
};

//
// * Component Placeholder
//

export const PlaceholderTypes: Story = {
  name: 'Examples / Component Placeholder Types',
  render: () => (
    <div style={{display: 'grid', gap: '16px', width: '400px'}}>
      <IslandMount>
        <ComponentPlaceholder type='text' />
      </IslandMount>
      <IslandMount>
        <ComponentPlaceholder type='part' />
      </IslandMount>
      <IslandMount>
        <ComponentPlaceholder type='layout' />
      </IslandMount>
      <IslandMount>
        <ComponentPlaceholder type='fragment' />
      </IslandMount>
    </div>
  ),
};

export const PlaceholderError: Story = {
  name: 'States / Component Placeholder Error',
  render: () => (
    <IslandMount style={{width: '400px'}}>
      <ComponentErrorPlaceholder descriptor='com.example:broken-widget failed to render' />
    </IslandMount>
  ),
};
