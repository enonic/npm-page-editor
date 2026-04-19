import {useEffect, useMemo, useRef, useState} from 'preact/hooks';

import type {ComponentPath, ComponentType, IncomingMessage, OutgoingMessage, PageConfig} from '../../src/protocol';
import type {ComponentRecord} from '../../src/state';
import type {Channel} from '../../src/transport';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {ComponentEmptyPlaceholder} from '../../src/components/ComponentEmptyPlaceholder';
import {OverlayApp} from '../../src/components/OverlayApp';
import {RegionPlaceholder} from '../../src/components/RegionPlaceholder';
import {initGeometryScheduler, markDirty} from '../../src/geometry';
import {DEFAULT_PHRASES} from '../../src/i18n';
import {
  initComponentDrag,
  initContextWindowDrag,
  initHoverDetection,
  initSelectionDetection,
} from '../../src/interaction';
import {fromString} from '../../src/protocol';
import {createOverlayHost, createPlaceholderIsland} from '../../src/rendering';
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
} from '../../src/state';
import {resetChannel, setChannel} from '../../src/transport';

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

const PAGE_CONFIG: PageConfig = {
  contentId: 'storybook-horizon',
  pageName: 'Horizon',
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

type StoryChannel = Channel & {
  dispatch(message: IncomingMessage): void;
};

function createStoryChannel(onSend?: (message: OutgoingMessage) => void): StoryChannel {
  const handlers = new Set<(msg: IncomingMessage) => void>();
  return {
    send(message: OutgoingMessage): void {
      // oxlint-disable-next-line no-console
      console.log('[PageEditor]', message.type, message);
      onSend?.(message);
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
    dispatch(message: IncomingMessage): void {
      for (const handler of handlers) handler(message);
    },
  };
}

//
// * Theme tokens — Horizon-like chrome, not pixel accurate
//

const pageClass = 'relative flex w-[960px] flex-col bg-surface-primary text-main shadow-sm';
const headerClass = 'flex flex-col gap-1 border-b border-bdr-soft bg-surface-neutral px-8 py-6';
const siteTitleClass = 'text-2xl font-semibold tracking-tight text-main';
const siteDescriptionClass = 'text-sm text-subtle';
const mainRegionClass = 'flex flex-col gap-4 px-8 py-8';
const footerClass = 'border-t border-bdr-soft bg-surface-neutral px-8 py-4 text-xs text-subtle';

//
// * Component blocks — rendered content
//

const heroBlockClass = 'cursor-grab rounded-md border border-bdr-soft bg-surface-info px-4 py-5 text-main select-none';
const cardBlockClass =
  'cursor-grab rounded-md border border-bdr-soft bg-surface-primary px-4 py-4 text-main select-none';
const layoutFrameClass = 'cursor-grab rounded-md border border-bdr-soft bg-surface-neutral p-3 select-none';
const subRegionClass = 'flex min-h-24 flex-col gap-2 rounded border border-dashed border-bdr-soft p-2.5';
const subRegionEmptyClass = 'flex min-h-24 flex-col';
const textBlockClass =
  'cursor-grab rounded-md border border-bdr-soft bg-surface-neutral px-4 py-4 text-main select-none';
const placeholderHostClass = 'min-h-24 cursor-grab select-none';
const labelClass = 'mb-1 block text-xs font-semibold tracking-wide text-subtle uppercase';

//
// * Demo canvas
//

type HorizonPageProps = {
  locked?: boolean;
  channel?: StoryChannel;
};

function HorizonPage({locked = false, channel: externalChannel}: HorizonPageProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const twoColRef = useRef<HTMLDivElement>(null);
  const twoColLeftRef = useRef<HTMLElement>(null);
  const twoColLeftPartRef = useRef<HTMLElement>(null);
  const twoColRightRef = useRef<HTMLElement>(null);
  const oneColRef = useRef<HTMLDivElement>(null);
  const oneColRegionRef = useRef<HTMLElement>(null);
  const fragmentRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    const main = mainRef.current;
    const hero = heroRef.current;
    const twoCol = twoColRef.current;
    const twoColLeft = twoColLeftRef.current;
    const twoColLeftPart = twoColLeftPartRef.current;
    const twoColRight = twoColRightRef.current;
    const oneCol = oneColRef.current;
    const oneColRegion = oneColRegionRef.current;
    const fragment = fragmentRef.current;
    const text = textRef.current;

    if (
      !page ||
      !main ||
      !hero ||
      !twoCol ||
      !twoColLeft ||
      !twoColLeftPart ||
      !twoColRight ||
      !oneCol ||
      !oneColRegion ||
      !fragment ||
      !text
    ) {
      return undefined;
    }

    const records: Record<string, ComponentRecord> = {
      '/': makeRecord('/', 'page', page, undefined, ['/main']),
      '/main': makeRecord('/main', 'region', main, '/', ['/main/0', '/main/1', '/main/2', '/main/3', '/main/4']),
      '/main/0': makeRecord('/main/0', 'part', hero, '/main', [], {descriptor: 'Hero Banner'}),
      '/main/1': makeRecord('/main/1', 'layout', twoCol, '/main', ['/main/1/left', '/main/1/right'], {
        descriptor: 'Two Column Layout',
      }),
      '/main/1/left': makeRecord('/main/1/left', 'region', twoColLeft, '/main/1', ['/main/1/left/0']),
      '/main/1/left/0': makeRecord('/main/1/left/0', 'part', twoColLeftPart, '/main/1/left', [], {
        descriptor: 'Card',
      }),
      '/main/1/right': makeRecord('/main/1/right', 'region', twoColRight, '/main/1', [], {empty: true}),
      '/main/2': makeRecord('/main/2', 'layout', oneCol, '/main', ['/main/2/main'], {
        descriptor: 'Full-width Layout',
      }),
      '/main/2/main': makeRecord('/main/2/main', 'region', oneColRegion, '/main/2', [], {empty: true}),
      '/main/3': makeRecord('/main/3', 'fragment', fragment, '/main', [], {empty: true}),
      '/main/4': makeRecord('/main/4', 'text', text, '/main', []),
    };

    setRegistry(records);
    rebuildIndex(records);
    setPageConfig(PAGE_CONFIG);
    setModifyAllowed(true);
    setLocked(locked);

    const overlay = createOverlayHost(<OverlayApp />);

    const islands = [
      createPlaceholderIsland(twoColRight, <RegionPlaceholder path={path('/main/1/right')} regionName='right' />),
      createPlaceholderIsland(oneColRegion, <RegionPlaceholder path={path('/main/2/main')} regionName='main' />),
      createPlaceholderIsland(fragment, <ComponentEmptyPlaceholder descriptor='Empty fragment' />),
    ];

    const channel = externalChannel ?? createStoryChannel();
    setChannel(channel);
    const stopGeometry = initGeometryScheduler(p => getRecord(p)?.element);
    const stopHover = initHoverDetection();
    const stopSelection = initSelectionDetection(channel);
    const stopDrag = initComponentDrag(channel);
    const stopContextDrag = initContextWindowDrag(channel);

    markDirty();

    return () => {
      stopContextDrag();
      stopDrag();
      stopSelection();
      stopHover();
      stopGeometry();
      for (const island of islands) island.unmount();
      overlay.unmount();
      resetChannel();
      resetState();
    };
  }, [locked, externalChannel]);

  return (
    <div ref={pageRef} data-testid='horizon-page' className={pageClass}>
      <header className={headerClass}>
        <h1 className={siteTitleClass}>Horizon</h1>
        <p className={siteDescriptionClass}>A modern theme for Enonic XP</p>
      </header>

      <section ref={mainRef} data-portal-region='main' className={mainRegionClass}>
        <article ref={heroRef} data-portal-component-type='part' data-testid='hero-part' className={heroBlockClass}>
          <span className={labelClass}>Part · Hero</span>
          <h2 className='text-lg font-semibold'>Welcome to Horizon</h2>
          <p className='mt-1 text-sm text-subtle'>A rendered part sitting at the top of the main region.</p>
        </article>

        <div
          ref={twoColRef}
          data-portal-component-type='layout'
          data-testid='two-col-layout'
          className={layoutFrameClass}
        >
          <span className={labelClass}>Layout · Two columns</span>
          <div className='grid grid-cols-2 gap-3'>
            <section ref={twoColLeftRef} data-portal-region='left' className={subRegionClass}>
              <article
                ref={twoColLeftPartRef}
                data-portal-component-type='part'
                data-testid='two-col-left-part'
                className={cardBlockClass}
              >
                <span className={labelClass}>Part · Card</span>
                <p className='text-sm'>Left column content.</p>
              </article>
            </section>
            <section ref={twoColRightRef} data-portal-region='right' className={subRegionEmptyClass} />
          </div>
        </div>

        <div
          ref={oneColRef}
          data-portal-component-type='layout'
          data-testid='one-col-layout'
          className={layoutFrameClass}
        >
          <span className={labelClass}>Layout · Full width</span>
          <section ref={oneColRegionRef} data-portal-region='main' className={subRegionEmptyClass} />
        </div>

        <div
          ref={fragmentRef}
          data-portal-component-type='fragment'
          data-testid='main-fragment'
          className={placeholderHostClass}
        />

        <div ref={textRef} data-portal-component-type='text' data-testid='main-text' className={textBlockClass}>
          <span className={labelClass}>Text</span>
          <p className='text-sm'>A short excerpt rendered as a text component near the bottom of the page.</p>
        </div>
      </section>

      <footer className={footerClass}>Created by Enonic</footer>
    </div>
  );
}

//
// * Palette demo
//

const paletteWrapperClass =
  'flex w-56 flex-col gap-2 rounded-md border border-bdr-soft bg-surface-neutral p-4 select-none';
const paletteTitleClass = 'text-xs font-semibold tracking-wide text-subtle uppercase';
const paletteTileClass =
  'flex items-center gap-2 rounded-md border border-bdr-soft bg-surface-primary px-3 py-2 text-sm text-main cursor-grab active:cursor-grabbing';
const logWrapperClass = 'flex w-72 flex-col gap-1 rounded-md border border-bdr-soft bg-surface-neutral p-4';
const logLineClass = 'font-mono text-xs text-subtle';
const demoWrapperClass = 'flex min-h-screen w-full items-start justify-center gap-4 p-4';
const LOG_LIMIT = 20;

type PaletteTile = {type: ComponentType; label: string};

const PALETTE_TILES: PaletteTile[] = [
  {type: 'part', label: 'Part'},
  {type: 'layout', label: 'Layout'},
  {type: 'text', label: 'Text'},
  {type: 'fragment', label: 'Fragment'},
];

type PalettePanelProps = {channel: StoryChannel};

function PalettePanel({channel}: PalettePanelProps): JSX.Element {
  const dragRef = useRef<{type: ComponentType; visible: boolean} | undefined>(undefined);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent): void {
      const drag = dragRef.current;
      if (drag == null) return;
      const pageElement = document.querySelector<HTMLElement>('[data-testid="horizon-page"]');
      if (pageElement == null) return;
      const rect = pageElement.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (inside !== drag.visible) {
        drag.visible = inside;
        channel.dispatch({type: 'set-draggable-visible', visible: inside});
      }
    }

    function handleMouseUp(): void {
      if (dragRef.current == null) return;
      dragRef.current = undefined;
      // ? context-window-drag may have already destroyed its session on a successful drop;
      // ? destroy-draggable is idempotent there and ensures CS-side state stays consistent.
      channel.dispatch({type: 'destroy-draggable'});
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [channel]);

  const startDrag = (event: MouseEvent, type: ComponentType): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {type, visible: false};
    channel.dispatch({type: 'create-draggable', componentType: type});
  };

  return (
    <aside data-testid='palette-panel' className={paletteWrapperClass}>
      <span className={paletteTitleClass}>Palette</span>
      {PALETTE_TILES.map(tile => (
        <button
          key={tile.type}
          type='button'
          data-testid={`palette-tile-${tile.type}`}
          className={paletteTileClass}
          onMouseDown={event => startDrag(event, tile.type)}
        >
          {tile.label}
        </button>
      ))}
    </aside>
  );
}
PalettePanel.displayName = 'PalettePanel';

type MessageLogProps = {messages: string[]};

function MessageLog({messages}: MessageLogProps): JSX.Element {
  return (
    <aside data-testid='message-log' className={logWrapperClass}>
      <span className={paletteTitleClass}>Outgoing messages</span>
      {messages.length === 0 ? (
        <span className={logLineClass}>(none yet)</span>
      ) : (
        messages.map((line, idx) => (
          <span key={`${idx}-${line}`} className={logLineClass}>
            {line}
          </span>
        ))
      )}
    </aside>
  );
}
MessageLog.displayName = 'MessageLog';

function PaletteDragDemo(): JSX.Element {
  const [messages, setMessages] = useState<string[]>([]);
  const channel = useMemo(
    () =>
      createStoryChannel(message => {
        setMessages(prev => [...prev.slice(-(LOG_LIMIT - 1)), message.type]);
      }),
    [],
  );

  return (
    <div className={demoWrapperClass}>
      <PalettePanel channel={channel} />
      <HorizonPage channel={channel} />
      <MessageLog messages={messages} />
    </div>
  );
}
PaletteDragDemo.displayName = 'PaletteDragDemo';

//
// * Meta
//

const meta = {
  title: 'Integration',
  parameters: {layout: 'fullscreen'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PageLayout: Story = {
  name: 'Examples / Page layout',
  render: () => (
    <div className='flex justify-center p-4'>
      <HorizonPage />
    </div>
  ),
};

export const Locked: Story = {
  name: 'States / Locked',
  render: () => (
    <div className='flex justify-center p-4'>
      <HorizonPage locked />
    </div>
  ),
};

export const PaletteDrag: Story = {
  name: 'Features / Palette drag',
  render: () => (
    <div className='flex flex-col gap-3'>
      <div className='max-w-160 px-4 pt-4 text-sm text-subtle'>
        Hold a palette tile and drag it into the page to add a component. Release inside a region to drop, or outside to
        cancel. The log on the right echoes outgoing messages the editor sends back to Content Studio (
        <code>drag-started</code>, <code>add</code>, <code>drag-dropped</code>, <code>drag-stopped</code>).
      </div>
      <PaletteDragDemo />
    </div>
  ),
};
