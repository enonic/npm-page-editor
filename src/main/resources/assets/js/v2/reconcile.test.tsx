import type {ComponentPath} from './protocol';
import type {DragState} from './state/drag';
import type {Channel} from './transport';

vi.mock('./components/ComponentEmptyPlaceholder', () => ({ComponentEmptyPlaceholder: () => null}));
vi.mock('./components/ComponentErrorPlaceholder', () => ({ComponentErrorPlaceholder: () => null}));
vi.mock('./components/ComponentLoadingPlaceholder', () => ({ComponentLoadingPlaceholder: () => null}));
vi.mock('./components/ComponentPlaceholder', () => ({ComponentPlaceholder: () => null}));
vi.mock('./components/RegionPlaceholder', () => ({RegionPlaceholder: () => null}));

import {fromString} from './protocol';
import {reconcilePage, reconcileSubtree, destroyPlaceholders, syncDragEmptyRegions} from './reconcile';
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

beforeEach(() => {
  $registry.set({});
  $selectedPath.set(undefined);
  $hoveredPath.set(undefined);
  $config.set(undefined);
  $contextMenu.set(undefined);
  resetDragState();

  sendSpy = vi.fn<Channel['send']>();
  setChannel({
    send: sendSpy,
    subscribe: vi.fn<Channel['subscribe']>().mockReturnValue(noop),
    destroy: vi.fn<Channel['destroy']>(),
  });
});

afterEach(() => {
  destroyPlaceholders();
  resetChannel();
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
