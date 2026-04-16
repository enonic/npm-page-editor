import {useEffect, useRef} from 'preact/hooks';

import type {
  ComponentPath,
  ComponentType,
  IncomingMessage,
  OutgoingMessage,
  PageConfig,
  PageController,
} from '../../src/main/resources/assets/js/v2/protocol';
import type {ComponentRecord} from '../../src/main/resources/assets/js/v2/state';
import type {Channel} from '../../src/main/resources/assets/js/v2/transport';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {CSSProperties, JSX} from 'preact';

import {ComponentEmptyPlaceholder} from '../../src/main/resources/assets/js/v2/components/ComponentEmptyPlaceholder';
import {ComponentErrorPlaceholder} from '../../src/main/resources/assets/js/v2/components/ComponentErrorPlaceholder';
import {ComponentLoadingPlaceholder} from '../../src/main/resources/assets/js/v2/components/ComponentLoadingPlaceholder';
import {OverlayApp} from '../../src/main/resources/assets/js/v2/components/OverlayApp';
import {RegionPlaceholder} from '../../src/main/resources/assets/js/v2/components/RegionPlaceholder';
import {initGeometryScheduler, markDirty} from '../../src/main/resources/assets/js/v2/geometry';
import {DEFAULT_PHRASES} from '../../src/main/resources/assets/js/v2/i18n';
import {
  initComponentDrag,
  initHoverDetection,
  initSelectionDetection,
} from '../../src/main/resources/assets/js/v2/interaction';
import {fromString} from '../../src/main/resources/assets/js/v2/protocol';
import {createOverlayHost, createPlaceholderIsland} from '../../src/main/resources/assets/js/v2/rendering';
import {
  closeContextMenu,
  getRecord,
  rebuildIndex,
  setDragState,
  setHoveredPath,
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

type RecordOverrides = Partial<Omit<ComponentRecord, 'path' | 'type' | 'element'>>;

function makeRecord(
  raw: string,
  type: ComponentType,
  element: HTMLElement,
  parentPath: string | undefined,
  children: string[],
  overrides: RecordOverrides = {},
): ComponentRecord {
  return {
    path: path(raw),
    type,
    element,
    parentPath: parentPath != null ? path(parentPath) : undefined,
    children: children.map(path),
    empty: overrides.empty ?? false,
    error: overrides.error ?? false,
    loading: overrides.loading ?? false,
    descriptor: overrides.descriptor,
    fragmentContentId: overrides.fragmentContentId,
  };
}

const DEFAULT_CONFIG: PageConfig = {
  contentId: 'storybook-integration',
  pageName: 'Integration Demo',
  pageIconClass: 'icon-page',
  locked: false,
  modifyPermissions: true,
  pageEmpty: false,
  pageTemplate: false,
  fragment: false,
  fragmentAllowed: true,
  resetEnabled: true,
  phrases: {...DEFAULT_PHRASES},
};

const SAMPLE_CONTROLLERS: PageController[] = [
  {descriptorKey: 'com.example:default', displayName: 'Default Page', iconClass: 'icon-page'},
  {descriptorKey: 'com.example:landing', displayName: 'Landing Page', iconClass: 'icon-page'},
  {descriptorKey: 'com.example:blog', displayName: 'Blog Post', iconClass: 'icon-page'},
];

function resetState(): void {
  closeContextMenu();
  setSelectedPath(undefined);
  setHoveredPath(undefined);
  setDragState(undefined);
  setLocked(false);
  setModifyAllowed(true);
  setPageControllers([]);
  setRegistry({});
}

function createStoryChannel(): Channel {
  const handlers = new Set<(msg: IncomingMessage) => void>();
  return {
    send(message: OutgoingMessage): void {
      // eslint-disable-next-line no-console
      console.log('[PageEditor]', message.type, message);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    destroy() {
      handlers.clear();
    },
  };
}

//
// * Story styles — demo canvas only, not production UI
//

const canvasStyle: CSSProperties = {
  width: '760px',
  border: '1px solid rgba(33, 52, 75, 0.12)',
  borderRadius: '12px',
  background: '#fff',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const regionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '10px',
  borderRadius: '8px',
  background: 'rgba(15, 23, 42, 0.02)',
  minHeight: '60px',
};

const blockStyle = (bg: string, border: string): CSSProperties => ({
  minHeight: '72px',
  borderRadius: '8px',
  background: bg,
  border: `1px solid ${border}`,
  padding: '14px',
  cursor: 'grab',
  userSelect: 'none',
});

const emptyRegionStyle: CSSProperties = {
  minHeight: '60px',
  cursor: 'default',
  display: 'flex',
  flexDirection: 'column',
};

const placeholderHostStyle: CSSProperties = {
  minHeight: '96px',
  cursor: 'grab',
  userSelect: 'none',
};

const subRegionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '10px',
  borderRadius: '6px',
  border: '1px dashed rgba(33, 52, 75, 0.12)',
  minHeight: '60px',
};

//
// * Demo canvas
//

type StoryVariant = 'default' | 'locked' | 'empty';

type DemoProps = {
  variant: StoryVariant;
};

function IntegrationDemo({variant}: DemoProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const rightRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const fragmentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    const header = headerRef.current;
    const hero = heroRef.current;
    const main = mainRef.current;
    const text = textRef.current;
    const layout = layoutRef.current;
    const left = leftRef.current;
    const card = cardRef.current;
    const right = rightRef.current;
    const errorBlock = errorRef.current;
    const loadingBlock = loadingRef.current;
    const fragment = fragmentRef.current;
    const footer = footerRef.current;

    if (
      !page ||
      !header ||
      !hero ||
      !main ||
      !text ||
      !layout ||
      !left ||
      !card ||
      !right ||
      !errorBlock ||
      !loadingBlock ||
      !fragment ||
      !footer
    ) {
      return undefined;
    }

    const pageEmpty = variant === 'empty';

    const records: Record<string, ComponentRecord> = {
      '/': makeRecord('/', 'page', page, undefined, ['/header', '/main', '/footer'], {empty: pageEmpty}),
      '/header': makeRecord('/header', 'region', header, '/', ['/header/0']),
      '/header/0': makeRecord('/header/0', 'part', hero, '/header', [], {descriptor: 'Hero Banner'}),
      '/main': makeRecord('/main', 'region', main, '/', ['/main/0', '/main/1', '/main/2', '/main/3', '/main/4']),
      '/main/0': makeRecord('/main/0', 'text', text, '/main', []),
      '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/left', '/main/1/right'], {
        descriptor: 'Two Column Layout',
      }),
      '/main/1/left': makeRecord('/main/1/left', 'region', left, '/main/1', ['/main/1/left/0']),
      '/main/1/left/0': makeRecord('/main/1/left/0', 'part', card, '/main/1/left', [], {descriptor: 'Card'}),
      '/main/1/right': makeRecord('/main/1/right', 'region', right, '/main/1', [], {empty: true}),
      '/main/2': makeRecord('/main/2', 'part', errorBlock, '/main', [], {
        descriptor: 'Failed Part',
        error: true,
      }),
      '/main/3': makeRecord('/main/3', 'part', loadingBlock, '/main', [], {
        descriptor: 'Async Part',
        loading: true,
      }),
      '/main/4': makeRecord('/main/4', 'fragment', fragment, '/main', [], {empty: true}),
      '/footer': makeRecord('/footer', 'region', footer, '/', [], {empty: true}),
    };

    setRegistry(records);
    rebuildIndex(records);
    setPageConfig({...DEFAULT_CONFIG, locked: variant === 'locked', pageEmpty});
    setModifyAllowed(true);
    setLocked(variant === 'locked');
    setPageControllers(variant === 'empty' ? SAMPLE_CONTROLLERS : []);

    const overlay = createOverlayHost(<OverlayApp />);

    const islands = [
      createPlaceholderIsland(right, <RegionPlaceholder path={path('/main/1/right')} regionName='right' />),
      createPlaceholderIsland(footer, <RegionPlaceholder path={path('/footer')} regionName='footer' />),
      createPlaceholderIsland(errorBlock, <ComponentErrorPlaceholder />),
      createPlaceholderIsland(loadingBlock, <ComponentLoadingPlaceholder />),
      createPlaceholderIsland(fragment, <ComponentEmptyPlaceholder descriptor='Empty fragment' />),
    ];

    const channel = createStoryChannel();
    const stopGeometry = initGeometryScheduler(p => getRecord(p)?.element);
    const stopHover = initHoverDetection();
    const stopSelection = initSelectionDetection(channel);
    const stopDrag = initComponentDrag(channel);

    markDirty();

    return () => {
      stopDrag();
      stopSelection();
      stopHover();
      stopGeometry();
      for (const island of islands) island.unmount();
      overlay.unmount();
      channel.destroy();
      resetState();
    };
  }, [variant]);

  return (
    <div ref={pageRef} data-testid='integration-canvas' style={canvasStyle}>
      <section ref={headerRef} data-portal-region='header' style={regionStyle}>
        <article
          ref={heroRef}
          data-portal-component-type='part'
          data-testid='header-hero'
          style={blockStyle('rgba(236, 72, 153, 0.06)', 'rgba(236, 72, 153, 0.2)')}
        >
          <p style={{margin: 0, fontSize: '12px', fontWeight: 600, opacity: 0.6}}>HEADER / PART</p>
          <h3 style={{margin: '4px 0 0', fontSize: '18px'}}>Hero Banner</h3>
        </article>
      </section>

      <section ref={mainRef} data-portal-region='main' style={regionStyle}>
        <div
          ref={textRef}
          data-portal-component-type='text'
          data-testid='main-text'
          style={blockStyle('rgba(34, 197, 94, 0.05)', 'rgba(34, 197, 94, 0.25)')}
        >
          <p style={{margin: 0, fontSize: '12px', fontWeight: 600, opacity: 0.6}}>TEXT</p>
          <p style={{margin: '4px 0 0', fontSize: '14px'}}>
            Drag this block to reorder inside main, or drop it into another region.
          </p>
        </div>

        <div
          ref={layoutRef}
          data-portal-component-type='layout'
          data-testid='main-layout'
          style={blockStyle('rgba(15, 23, 42, 0.02)', 'rgba(33, 52, 75, 0.14)')}
        >
          <p style={{margin: '0 0 10px', fontSize: '12px', fontWeight: 600, opacity: 0.6}}>LAYOUT · 2 columns</p>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
            <section ref={leftRef} data-portal-region='left' style={subRegionStyle}>
              <article
                ref={cardRef}
                data-portal-component-type='part'
                data-testid='layout-card'
                style={blockStyle('rgba(66, 153, 225, 0.06)', 'rgba(66, 153, 225, 0.25)')}
              >
                <p style={{margin: 0, fontSize: '12px', fontWeight: 600, opacity: 0.6}}>PART</p>
                <p style={{margin: '4px 0 0', fontSize: '14px'}}>Card in left column</p>
              </article>
            </section>
            <section ref={rightRef} data-portal-region='right' style={emptyRegionStyle} />
          </div>
        </div>

        <div ref={errorRef} data-portal-component-type='part' data-testid='main-error' style={placeholderHostStyle} />

        <div
          ref={loadingRef}
          data-portal-component-type='part'
          data-testid='main-loading'
          style={placeholderHostStyle}
        />

        <div
          ref={fragmentRef}
          data-portal-component-type='fragment'
          data-testid='main-fragment'
          style={placeholderHostStyle}
        />
      </section>

      <section ref={footerRef} data-portal-region='footer' style={emptyRegionStyle} />
    </div>
  );
}

//
// * Meta
//

const meta = {
  title: 'v2/Integration',
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const DESCRIPTION =
  'Hover to highlight. Click to select. Right-click for the context menu. Drag any block to reorder within a region or move it across regions. Drop messages are logged to the browser console.';

export const Default: Story = {
  name: 'Examples / Full page (editable)',
  render: () => (
    <div className='flex flex-col items-center gap-y-3 p-4'>
      <div className='max-w-180 text-sm text-subtle'>{DESCRIPTION}</div>
      <IntegrationDemo variant='default' />
    </div>
  ),
};

export const Locked: Story = {
  name: 'States / Page locked',
  render: () => (
    <div className='flex flex-col items-center gap-y-3 p-4'>
      <div className='max-w-180 text-sm text-subtle'>
        Page is locked — the Shader dims the canvas and interactions are disabled.
      </div>
      <IntegrationDemo variant='locked' />
    </div>
  ),
};

export const EmptyPage: Story = {
  name: 'States / Empty page (template picker)',
  render: () => (
    <div className='flex flex-col items-center gap-y-3 p-4'>
      <div className='max-w-180 text-sm text-subtle'>
        Page has no controller — the PagePlaceholderOverlay covers the canvas with the descriptor selector.
      </div>
      <IntegrationDemo variant='empty' />
    </div>
  ),
};
