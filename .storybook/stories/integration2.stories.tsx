import {useEffect, useRef} from 'preact/hooks';

import type {
  ComponentPath,
  ComponentType,
  IncomingMessage,
  OutgoingMessage,
  PageConfig,
} from '../../src/main/resources/assets/js/v2/protocol';
import type {ComponentRecord} from '../../src/main/resources/assets/js/v2/state';
import type {Channel} from '../../src/main/resources/assets/js/v2/transport';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {ComponentEmptyPlaceholder} from '../../src/main/resources/assets/js/v2/components/ComponentEmptyPlaceholder';
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
import {resetChannel, setChannel} from '../../src/main/resources/assets/js/v2/transport';

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

function createStoryChannel(): Channel {
  const handlers = new Set<(msg: IncomingMessage) => void>();
  return {
    send(message: OutgoingMessage): void {
      // oxlint-disable-next-line no-console
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
};

function HorizonPage({locked = false}: HorizonPageProps): JSX.Element {
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

    const channel = createStoryChannel();
    setChannel(channel);
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
      resetChannel();
      resetState();
    };
  }, [locked]);

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
// * Meta
//

const meta = {
  title: 'Integration2',
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
