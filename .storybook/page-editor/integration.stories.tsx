import {useEffect, useRef} from 'preact/hooks';

import type {ComponentPath, ComponentType, OutgoingMessage} from '../../src/main/resources/assets/js/v2/protocol';
import type {ComponentRecord} from '../../src/main/resources/assets/js/v2/state';
import type {Channel} from '../../src/main/resources/assets/js/v2/transport';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {CSSProperties, JSX} from 'preact';

import {OverlayApp} from '../../src/main/resources/assets/js/v2/components/OverlayApp';
import {RegionPlaceholder} from '../../src/main/resources/assets/js/v2/components/RegionPlaceholder';
import {initGeometryScheduler, markDirty} from '../../src/main/resources/assets/js/v2/geometry';
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

function makeRecord(
  raw: string,
  type: ComponentType,
  element: HTMLElement,
  parentPath: string | undefined,
  children: string[],
  empty = false,
): ComponentRecord {
  return {
    path: path(raw),
    type,
    element,
    parentPath: parentPath != null ? path(parentPath) : undefined,
    children: children.map(path),
    empty,
    error: false,
    descriptor: undefined,
    fragmentContentId: undefined,
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
}

function createStoryChannel(): Channel {
  const handlers = new Set<(msg: never) => void>();
  return {
    send(message: OutgoingMessage): void {
      // eslint-disable-next-line no-console
      console.log('[PageEditor]', message.type, message);
    },
    subscribe(handler) {
      handlers.add(handler as (msg: never) => void);
      return () => {
        handlers.delete(handler as (msg: never) => void);
      };
    },
    destroy() {
      handlers.clear();
    },
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

const emptyRegionStyle: CSSProperties = {
  minHeight: '60px',
  cursor: 'default',
  display: 'flex',
  flexDirection: 'column',
};

//
// * Story component
//

function OverlayTest(): JSX.Element {
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

    if (
      !container ||
      !mainRegion ||
      !partA ||
      !layoutB ||
      !leftRegion ||
      !textC ||
      !rightRegion ||
      !layoutD ||
      !centerRegion
    ) {
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

    const overlay = createOverlayHost(<OverlayApp />);
    setRegistry(records);
    rebuildIndex(records);
    setModifyAllowed(true);

    const rightIsland = createPlaceholderIsland(
      rightRegion,
      <RegionPlaceholder path={path('/main/1/right')} regionName='right' />,
    );
    const centerIsland = createPlaceholderIsland(
      centerRegion,
      <RegionPlaceholder path={path('/main/2/center')} regionName='center' />,
    );

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
      rightIsland.unmount();
      centerIsland.unmount();
      overlay.unmount();
      channel.destroy();
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
          <p style={{margin: 0, opacity: 0.6, fontSize: '13px'}}>
            Hover, click to select, right-click for context menu. Drag to reorder.
          </p>
        </article>

        <div
          ref={layoutBRef}
          data-portal-component-type='layout'
          data-testid='layout-b'
          style={blockStyle('rgba(15, 23, 42, 0.02)', 'rgba(33, 52, 75, 0.12)')}
        >
          <p style={{margin: '0 0 10px', fontSize: '13px', fontWeight: 600}}>Layout B — Two Column</p>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
            <section
              ref={leftRegionRef}
              data-portal-region='left'
              style={{
                borderRadius: '6px',
                border: '1px dashed rgba(33, 52, 75, 0.12)',
                padding: '12px',
                minHeight: '60px',
                cursor: 'default',
              }}
            >
              <div
                ref={textCRef}
                data-portal-component-type='text'
                data-testid='text-c'
                style={blockStyle('rgba(34, 197, 94, 0.05)', 'rgba(34, 197, 94, 0.2)')}
              >
                <p style={{margin: 0, fontSize: '13px', fontWeight: 600}}>Text C</p>
                <p style={{margin: '4px 0 0', opacity: 0.6, fontSize: '13px'}}>Right-click for context menu.</p>
              </div>
            </section>
            <section ref={rightRegionRef} data-portal-region='right' style={emptyRegionStyle} />
          </div>
        </div>

        <div
          ref={layoutDRef}
          data-portal-component-type='layout'
          data-testid='layout-d'
          style={blockStyle('rgba(15, 23, 42, 0.02)', 'rgba(33, 52, 75, 0.12)')}
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
