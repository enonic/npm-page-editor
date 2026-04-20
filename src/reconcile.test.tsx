import type {ComponentPath, PageConfig} from './protocol';
import type {DragState} from './state/drag';
import type {Channel} from './transport';

vi.mock('./components/ComponentEmptyPlaceholder', () => ({ComponentEmptyPlaceholder: () => null}));
vi.mock('./components/ComponentErrorPlaceholder', () => ({ComponentErrorPlaceholder: () => null}));
vi.mock('./components/ComponentLoadingPlaceholder', () => ({ComponentLoadingPlaceholder: () => null}));
vi.mock('./components/ComponentPlaceholder', () => ({ComponentPlaceholder: () => null}));
vi.mock('./components/RegionPlaceholder', () => ({RegionPlaceholder: () => null}));

import {setComponentLoadCallback} from './load-request';
import {fromString} from './protocol';
import {
  reconcilePage,
  reconcileSubtree,
  destroyPlaceholders,
  markInitReady,
  resetPageReadyFlag,
  syncDragEmptyRegions,
} from './reconcile';
import {$registry, $selectedPath, $hoveredPath, $config, $contextMenu, getPathForElement} from './state';
import {$dragState, resetDragState} from './state/drag';
import {setChannel, resetChannel} from './transport';

//
// * Polyfills
//

beforeAll(() => {
  if (!('replaceSync' in CSSStyleSheet.prototype)) {
    Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
      value(_text: string) {
        // no-op: JSDOM polyfill
      },
      configurable: true,
      writable: true,
    });
  }

  if (!('adoptedStyleSheets' in ShadowRoot.prototype)) {
    const store = new WeakMap<ShadowRoot, CSSStyleSheet[]>();
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      get(this: ShadowRoot) {
        return store.get(this) ?? [];
      },
      set(this: ShadowRoot, sheets: CSSStyleSheet[]) {
        store.set(this, sheets);
      },
      configurable: true,
    });
  }
});

//
// * Helpers
//

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeDrag(overrides?: Partial<DragState>): DragState {
  return {
    itemType: 'part',
    itemLabel: 'My Part',
    sourcePath: path('/main/0'),
    targetRegion: undefined,
    targetIndex: undefined,
    dropAllowed: true,
    message: undefined,
    placeholderElement: undefined,
    placeholderVariant: undefined,
    x: undefined,
    y: undefined,
    ...overrides,
  };
}

function noop(): void {
  // unsubscribe stub
}

let sendSpy: ReturnType<typeof vi.fn<Channel['send']>>;
let loadSpy: ReturnType<typeof vi.fn<(path: string, existing: boolean) => void>>;

function makeMinimalConfig(): PageConfig {
  return {
    contentId: 'test',
    pageName: 'Test',
    pageIconClass: '',
    locked: false,
    modifyPermissions: true,
    pageEmpty: false,
    pageTemplate: false,
    fragment: false,
    fragmentAllowed: true,
    resetEnabled: false,
    phrases: {},
  };
}

beforeEach(() => {
  $registry.set({});
  $selectedPath.set(undefined);
  $hoveredPath.set(undefined);
  $config.set(makeMinimalConfig());
  $contextMenu.set(undefined);
  resetDragState();
  resetPageReadyFlag();
  markInitReady();

  sendSpy = vi.fn<Channel['send']>();
  setChannel({
    send: sendSpy,
    subscribe: vi.fn<Channel['subscribe']>().mockReturnValue(noop),
    destroy: vi.fn<Channel['destroy']>(),
  });

  loadSpy = vi.fn<(path: string, existing: boolean) => void>();
  setComponentLoadCallback((path, existing) => loadSpy(path, existing));
});

afterEach(() => {
  destroyPlaceholders();
  resetChannel();
  setComponentLoadCallback(undefined);
  document.body.innerHTML = '';
});

//
// * reconcilePage
//

describe('reconcilePage', () => {
  it('parses DOM tree and populates registry', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    const registry = $registry.get();
    expect(registry['/']).toMatchObject({type: 'page', children: ['/main']});
    expect(registry['/main']).toMatchObject({type: 'region', children: ['/main/0']});
    expect(registry['/main/0']).toMatchObject({type: 'part', parentPath: '/main'});
  });

  it('populates element-index after reconcile', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    const regionEl = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    expect(getPathForElement(regionEl)).toBe('/main');

    const partEl = document.querySelector('[data-portal-component-type="part"]') as HTMLElement;
    expect(getPathForElement(partEl)).toBe('/main/0');
  });

  it('clears selected path and sends deselect when selected record disappears', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});
    $selectedPath.set(path('/main/0'));

    document.body.innerHTML = '<section data-portal-region="main"></section>';
    reconcilePage(document.body, {});

    expect($selectedPath.get()).toBeUndefined();
    expect($contextMenu.get()).toBeUndefined();
    expect(sendSpy).toHaveBeenCalledWith({type: 'deselect', path: '/main/0'});
  });

  it('keeps selected path when record still exists', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});
    $selectedPath.set(path('/main/0'));
    sendSpy.mockClear();

    reconcilePage(document.body, {});

    expect($selectedPath.get()).toBe('/main/0');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('clears hovered path when hovered record disappears', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});
    $hoveredPath.set(path('/main/0'));

    document.body.innerHTML = '<section data-portal-region="main"></section>';
    reconcilePage(document.body, {});

    expect($hoveredPath.get()).toBeUndefined();
  });

  it('skips reconciliation when dragging', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});
    const registryBefore = $registry.get();

    $dragState.set(makeDrag());

    document.body.innerHTML = '<section data-portal-region="main"></section>';
    reconcilePage(document.body, {});

    expect($registry.get()).toBe(registryBefore);
  });

  it('reconciles normally after drag ends', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});
    $dragState.set(makeDrag());

    document.body.innerHTML = '<section data-portal-region="main"></section>';
    reconcilePage(document.body, {});

    // Still has old records due to drag guard
    expect($registry.get()['/main/0']).toBeDefined();

    // End drag and reconcile
    $dragState.set(undefined);
    reconcilePage(document.body, {});

    expect($registry.get()['/main/0']).toBeUndefined();
    expect($registry.get()['/main']).toMatchObject({type: 'region', empty: true});
  });

  it('respects fragment config from $config store', () => {
    $config.set({
      contentId: 'test',
      pageName: 'Test',
      pageIconClass: '',
      locked: false,
      modifyPermissions: true,
      pageEmpty: false,
      pageTemplate: false,
      fragment: true,
      fragmentAllowed: true,
      resetEnabled: false,
      phrases: {},
    });

    document.body.innerHTML = `
      <div class="outer">
        <article data-portal-component-type="text"></article>
      </div>
    `;

    reconcilePage(document.body, {});

    expect($registry.get()['/']).toMatchObject({type: 'text'});
  });
});

//
// * page-ready
//

describe('page-ready', () => {
  it('emits page-ready on first successful reconcile', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {});

    expect(sendSpy).toHaveBeenCalledWith({type: 'page-ready'});
  });

  it('emits page-ready only once across repeated reconciles', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {});
    reconcilePage(document.body, {});
    reconcilePage(document.body, {});

    const readyCalls = sendSpy.mock.calls.filter(([msg]) => msg?.type === 'page-ready');
    expect(readyCalls).toHaveLength(1);
  });

  it('resetPageReadyFlag re-arms the one-shot emit', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {});
    resetPageReadyFlag();
    markInitReady();
    sendSpy.mockClear();

    reconcilePage(document.body, {});

    expect(sendSpy).toHaveBeenCalledWith({type: 'page-ready'});
  });

  it('does not emit page-ready when reconcile is skipped due to drag', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';
    $dragState.set(makeDrag());

    reconcilePage(document.body, {});

    expect(sendSpy).not.toHaveBeenCalledWith({type: 'page-ready'});
  });

  it('does not emit page-ready until markInitReady() has been called', () => {
    resetPageReadyFlag();
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {});

    expect(sendSpy).not.toHaveBeenCalledWith({type: 'page-ready'});

    markInitReady();
    reconcilePage(document.body, {});

    expect(sendSpy).toHaveBeenCalledWith({type: 'page-ready'});
  });

  it('does not emit page-ready when config is unset', () => {
    resetPageReadyFlag();
    markInitReady();
    $config.set(undefined);
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {});

    expect(sendSpy).not.toHaveBeenCalledWith({type: 'page-ready'});
  });
});

//
// * Controller switch short-circuit (I3 defensive)
//

describe('controller switch short-circuit', () => {
  it('skips ensureStubs and load fan-out when the / descriptor changes', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part" id="stay"></article>
      </section>
    `;

    reconcilePage(document.body, {
      '/': {descriptor: 'app:landing'},
      '/main/0': {type: 'part', descriptor: 'app:hello'},
    });
    loadSpy.mockClear();

    reconcilePage(document.body, {
      '/': {descriptor: 'app:article'},
      '/main/0': {type: 'part', descriptor: 'app:hello'},
      '/main/1': {type: 'part', descriptor: 'app:new'},
    });

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    expect(region.querySelectorAll('[data-portal-component-type]')).toHaveLength(1);
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('stays short-circuited on subsequent reconciles until reset', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {'/': {descriptor: 'app:a'}});
    reconcilePage(document.body, {'/': {descriptor: 'app:b'}});
    loadSpy.mockClear();

    reconcilePage(document.body, {
      '/': {descriptor: 'app:b'},
      '/main/0': {type: 'part', descriptor: 'app:hello'},
    });

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    expect(region.querySelectorAll('[data-portal-component-type]')).toHaveLength(0);
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('resumes normal reconciliation after resetPageReadyFlag (fresh init)', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {'/': {descriptor: 'app:a'}});
    reconcilePage(document.body, {'/': {descriptor: 'app:b'}});

    resetPageReadyFlag();
    markInitReady();
    loadSpy.mockClear();

    reconcilePage(document.body, {
      '/': {descriptor: 'app:b'},
      '/main/0': {type: 'part', descriptor: 'app:hello'},
    });

    expect(loadSpy).toHaveBeenCalledWith('/main/0', false);
  });
});

//
// * Placeholder diffing
//

describe('placeholder diffing', () => {
  it('creates placeholder island for empty region', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {});

    expect(document.body.querySelectorAll('[data-pe-placeholder-host]')).toHaveLength(1);
  });

  it('creates placeholder island for empty component', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    // The empty part gets a placeholder; the non-empty region does not
    const hosts = document.body.querySelectorAll('[data-pe-placeholder-host]');
    expect(hosts).toHaveLength(1);
  });

  it('creates placeholder island for error component', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part" data-portal-placeholder-error="true"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    const hosts = document.body.querySelectorAll('[data-pe-placeholder-host]');
    expect(hosts).toHaveLength(1);
  });

  it('destroys placeholder when record becomes non-empty', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';
    reconcilePage(document.body, {});
    expect(document.body.querySelectorAll('[data-pe-placeholder-host]')).toHaveLength(1);

    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;
    reconcilePage(document.body, {});

    // Region placeholder destroyed (region now has children)
    // Part placeholder created (empty part)
    const hosts = document.body.querySelectorAll('[data-pe-placeholder-host]');
    expect(hosts).toHaveLength(1);

    // The remaining placeholder belongs to the part, not the region
    const partEl = document.querySelector('[data-portal-component-type="part"]') as HTMLElement;
    expect(partEl.querySelector('[data-pe-placeholder-host]')).not.toBeNull();
  });

  it('recreates placeholder when record state changes but element stays the same', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    const partEl = document.querySelector('[data-portal-component-type="part"]') as HTMLElement;
    const hostBefore = partEl.querySelector('[data-pe-placeholder-host]');
    expect(hostBefore).not.toBeNull();

    // Add error attribute to the same element — state changes, element stays
    partEl.setAttribute('data-portal-placeholder-error', 'true');
    reconcilePage(document.body, {});

    const hostAfter = partEl.querySelector('[data-pe-placeholder-host]');
    expect(hostAfter).not.toBeNull();
    // The placeholder host should be a different instance (recreated)
    expect(hostAfter).not.toBe(hostBefore);
  });

  it('destroys placeholder when record is removed', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';
    reconcilePage(document.body, {});
    expect(document.body.querySelectorAll('[data-pe-placeholder-host]')).toHaveLength(1);

    document.body.innerHTML = '';
    reconcilePage(document.body, {});

    expect(document.body.querySelectorAll('[data-pe-placeholder-host]')).toHaveLength(0);
  });
});

//
// * syncDragEmptyRegions
//

describe('syncDragEmptyRegions', () => {
  it('mounts a placeholder when the region becomes effectively empty during drag', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    // No drag-time placeholder yet — only the empty-part's inner placeholder exists
    expect(region.querySelector(':scope > [data-pe-placeholder-host]')).toBeNull();

    syncDragEmptyRegions(path('/main/0'));

    expect(region.querySelector(':scope > [data-pe-placeholder-host]')).not.toBeNull();
  });

  it('does not mount a placeholder when other siblings remain visible', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    syncDragEmptyRegions(path('/main/0'));

    // Only the existing empty-part placeholders remain; no new region host
    const hosts = region.querySelectorAll(':scope > [data-pe-placeholder-host]');
    expect(hosts).toHaveLength(0);
  });

  it('tears down drag-time placeholders when the drag ends', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});
    syncDragEmptyRegions(path('/main/0'));

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    expect(region.querySelector('[data-pe-placeholder-host]')).not.toBeNull();

    syncDragEmptyRegions(undefined);

    // The region's direct placeholder host (drag-time) was removed
    expect(region.querySelector(':scope > [data-pe-placeholder-host]')).toBeNull();
  });

  it('dims ancestor region when dragged component is the only descendant of a nested layout', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="layout">
          <section data-portal-region="inner">
            <article data-portal-component-type="part"></article>
          </section>
        </div>
      </section>
    `;

    reconcilePage(document.body, {});

    const main = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const inner = document.querySelector('[data-portal-region="inner"]') as HTMLElement;

    syncDragEmptyRegions(path('/main/0/inner/0'));

    expect(inner.querySelector(':scope > [data-pe-placeholder-host]')).not.toBeNull();
    expect(main.querySelector(':scope > [data-pe-placeholder-host]')).not.toBeNull();
  });

  it('does not dim ancestor region when nested layout has a sibling component', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="layout">
          <section data-portal-region="inner">
            <article data-portal-component-type="part"></article>
          </section>
        </div>
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    const main = document.querySelector('[data-portal-region="main"]') as HTMLElement;

    syncDragEmptyRegions(path('/main/0/inner/0'));

    // Main region still has the sibling part — no drag-time host should mount at its root
    expect(main.querySelector(':scope > [data-pe-placeholder-host]')).toBeNull();
  });
});

//
// * reconcileSubtree
//

describe('reconcileSubtree', () => {
  it('replaces only records within the subtree', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
      <section data-portal-region="aside"></section>
    `;

    reconcilePage(document.body, {});

    const mainRecord = $registry.get()['/main'];
    const aside = document.querySelector('[data-portal-region="aside"]') as HTMLElement;
    aside.innerHTML = '<article data-portal-component-type="part"></article>';

    reconcileSubtree(aside, path('/aside'), {});

    // Main record is the same reference (not replaced)
    expect($registry.get()['/main']).toBe(mainRecord);

    // Aside was updated
    expect($registry.get()['/aside']).toMatchObject({children: ['/aside/0']});
    expect($registry.get()['/aside/0']).toMatchObject({type: 'part'});
  });

  it('skips reconciliation when dragging', () => {
    document.body.innerHTML = `
      <section data-portal-region="main"></section>
    `;

    reconcilePage(document.body, {});
    const registryBefore = $registry.get();

    $dragState.set(makeDrag());

    const main = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    main.innerHTML = '<article data-portal-component-type="part"></article>';

    reconcileSubtree(main, path('/main'), {});

    expect($registry.get()).toBe(registryBefore);
  });
});

//
// * Stub synthesis & component-load-request
//

describe('stub synthesis and load callback', () => {
  it('synthesizes a stub and fires the load callback for a descriptor without a DOM element', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'app:hello'},
      '/main/1': {type: 'part', descriptor: 'app:new'},
    });

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const components = region.querySelectorAll('[data-portal-component-type]');
    expect(components).toHaveLength(2);
    expect($registry.get()['/main/1']).toMatchObject({type: 'part', loading: true});

    expect(loadSpy).toHaveBeenCalledWith('/main/1', false);
  });

  it('appends stub at the end when descriptor path is beyond existing DOM children', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part" id="first"></article>
        <article data-portal-component-type="part" id="second"></article>
      </section>
    `;

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a'},
      '/main/1': {type: 'part', descriptor: 'b'},
      '/main/2': {type: 'part', descriptor: 'c'},
    });

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const elements = Array.from(region.querySelectorAll('[data-portal-component-type]'));
    expect(elements).toHaveLength(3);
    expect(elements[0].id).toBe('first');
    expect(elements[1].id).toBe('second');
    expect(elements[2].id).toBe('');
    expect(loadSpy).toHaveBeenCalledWith('/main/2', false);
  });

  it('fires load callback with existing=true when descriptor changes on an existing element', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a'},
    });
    loadSpy.mockClear();

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'b'},
    });

    expect(loadSpy).toHaveBeenCalledWith('/main/0', true);
    expect($registry.get()['/main/0']).toMatchObject({loading: true, descriptor: 'b'});
  });

  it('does not fire load for surviving siblings after a delete shifts their paths', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part" id="a"></article>
        <article data-portal-component-type="part" id="b"></article>
        <article data-portal-component-type="part" id="c"></article>
      </section>
    `;

    // First reconcile: three tracked components.
    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'desc-a'},
      '/main/1': {type: 'part', descriptor: 'desc-b'},
      '/main/2': {type: 'part', descriptor: 'desc-c'},
    });

    // Delete the middle component in DOM and describe the survivors.
    // Their indices have now shifted: what was `/main/2` is now `/main/1`.
    document.getElementById('b')?.remove();
    loadSpy.mockClear();

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'desc-a'},
      '/main/1': {type: 'part', descriptor: 'desc-c'},
    });

    // ! Surviving siblings must NOT trigger `load(existing=true)` — their DOM content
    // ! is already correct; the only change is the path index assigned by the parser.
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('fires load callback with existing=true when only configHash changes', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a', configHash: 'h1'},
    });
    loadSpy.mockClear();

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a', configHash: 'h2'},
    });

    expect(loadSpy).toHaveBeenCalledWith('/main/0', true);
    expect($registry.get()['/main/0']).toMatchObject({loading: true});
  });

  it('does not fire the load callback when descriptors are unchanged', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a'},
    });
    loadSpy.mockClear();

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a'},
    });

    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('skips stub creation when parent region is missing', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="layout"></article>
      </section>
    `;

    reconcilePage(document.body, {
      '/main/0': {type: 'layout', descriptor: 'layout:a'},
      '/main/0/body/0': {type: 'part', descriptor: 'nested'},
    });

    expect($registry.get()['/main/0/body/0']).toBeUndefined();
    expect(loadSpy).not.toHaveBeenCalledWith('/main/0/body/0', expect.anything());
  });

  it('does not re-fire for paths already marked loading', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part"></article>
      </section>
    `;

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a'},
      '/main/1': {type: 'part', descriptor: 'b'},
    });
    loadSpy.mockClear();

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a'},
      '/main/1': {type: 'part', descriptor: 'b'},
    });

    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('uses descriptor entry type when synthesizing stub element', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {
      '/main/0': {type: 'layout', descriptor: 'layout:a'},
    });

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const stub = region.querySelector('[data-portal-component-type]') as HTMLElement;
    expect(stub.getAttribute('data-portal-component-type')).toBe('layout');
  });

  it('detaches DOM when a previously-tracked path disappears from descriptors', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part" id="first"></article>
        <article data-portal-component-type="part" id="second"></article>
      </section>
    `;

    // First reconcile: both components are tracked.
    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a'},
      '/main/1': {type: 'part', descriptor: 'b'},
    });

    // Second reconcile: `/main/1` has been removed from descriptors (delete).
    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'a'},
    });

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const remaining = region.querySelectorAll('[data-portal-component-type]');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('first');
    expect($registry.get()['/main/1']).toBeUndefined();
  });

  it('does not detach server-rendered components on first reconcile when descriptors are empty', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <article data-portal-component-type="part" id="server"></article>
      </section>
    `;

    reconcilePage(document.body, {});

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const remaining = region.querySelectorAll('[data-portal-component-type]');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('server');
  });

  it('synthesized stub has a min size so hit-testing lands on it in flex/grid regions', () => {
    document.body.innerHTML = '<section data-portal-region="main"></section>';

    reconcilePage(document.body, {
      '/main/0': {type: 'part', descriptor: 'app:hello'},
    });

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const stub = region.querySelector('[data-portal-component-type]') as HTMLElement;
    expect(stub.style.minHeight).toBe('40px');
    expect(stub.style.minWidth).toBe('40px');
  });
});

//
// * destroyPlaceholders
//

describe('destroyPlaceholders', () => {
  it('unmounts all placeholder islands', () => {
    document.body.innerHTML = `
      <section data-portal-region="main"></section>
      <section data-portal-region="aside"></section>
    `;

    reconcilePage(document.body, {});
    expect(document.body.querySelectorAll('[data-pe-placeholder-host]')).toHaveLength(2);

    destroyPlaceholders();
    expect(document.body.querySelectorAll('[data-pe-placeholder-host]')).toHaveLength(0);
  });
});
