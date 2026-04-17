import type {ComponentPath, PageConfig} from './protocol';

vi.mock('./components/ComponentEmptyPlaceholder', () => ({ComponentEmptyPlaceholder: () => null}));
vi.mock('./components/ComponentErrorPlaceholder', () => ({ComponentErrorPlaceholder: () => null}));
vi.mock('./components/ComponentLoadingPlaceholder', () => ({ComponentLoadingPlaceholder: () => null}));
vi.mock('./components/ComponentPlaceholder', () => ({ComponentPlaceholder: () => null}));
vi.mock('./components/RegionPlaceholder', () => ({RegionPlaceholder: () => null}));
vi.mock('./components/OverlayApp', () => ({OverlayApp: () => null}));

import {initPageEditor} from './init';
import {fromString} from './protocol/path';
import {
  $config,
  $dragState,
  $hoveredPath,
  $registry,
  $selectedPath,
  $pageControllers,
  $locked,
  $modifyAllowed,
} from './state';
import {tryGetChannel} from './transport';

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

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

type MockTarget = {target: Window; postMessage: ReturnType<typeof vi.fn<Window['postMessage']>>};

function createMockTarget(): MockTarget {
  const postMessage = vi.fn<Window['postMessage']>();
  return {target: {postMessage} as unknown as Window, postMessage};
}

function makeConfig(): PageConfig {
  return {
    contentId: 'content-1',
    pageName: 'Page',
    pageIconClass: '',
    locked: false,
    modifyPermissions: true,
    pageEmpty: false,
    pageTemplate: false,
    fragment: false,
    fragmentAllowed: false,
    resetEnabled: false,
    phrases: {},
  };
}

function emitIncoming(data: Record<string, unknown>): void {
  globalThis.dispatchEvent(
    new MessageEvent('message', {
      data: {version: 2, source: 'page-editor', ...data},
      origin: '',
    }),
  );
}

describe('initPageEditor', () => {
  afterEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '';
    document.body.className = '';
    $registry.set({});
    $selectedPath.set(undefined);
    $hoveredPath.set(undefined);
    $config.set(undefined);
    $dragState.set(undefined);
    $pageControllers.set([]);
    $locked.set(false);
    $modifyAllowed.set(true);
  });

  it('adds overlay class, mounts overlay host, and sends ready', () => {
    const {target, postMessage} = createMockTarget();

    const instance = initPageEditor(document.body, target);

    expect(document.body.classList.contains('pe-overlay-active')).toBe(true);
    expect(document.getElementById('pe-overlay-host')).not.toBeNull();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({version: 2, source: 'page-editor', type: 'ready'}),
      '*',
    );

    instance.destroy();
  });

  it('populates $config when init message arrives', () => {
    const {target} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    emitIncoming({type: 'init', config: makeConfig()});

    expect($config.get()?.contentId).toBe('content-1');
    instance.destroy();
  });

  it('notifyComponentLoaded posts outgoing component-loaded', () => {
    const {target, postMessage} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    postMessage.mockClear();
    instance.notifyComponentLoaded(path('/main/0'));

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({type: 'component-loaded', path: '/main/0'}), '*');
    instance.destroy();
  });

  it('notifyComponentLoadFailed posts reason', () => {
    const {target, postMessage} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    postMessage.mockClear();
    instance.notifyComponentLoadFailed(path('/main/0'), 'boom');

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({type: 'component-load-failed', path: '/main/0', reason: 'boom'}),
      '*',
    );
    instance.destroy();
  });

  it('requestPageReload posts page-reload-request', () => {
    const {target, postMessage} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    postMessage.mockClear();
    instance.requestPageReload();

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({type: 'page-reload-request'}), '*');
    instance.destroy();
  });

  it('destroy removes overlay, resets atoms, and clears channel', () => {
    const {target} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    emitIncoming({type: 'init', config: makeConfig()});
    $selectedPath.set(path('/main/0'));
    $hoveredPath.set(path('/main/1'));

    instance.destroy();

    expect(document.body.classList.contains('pe-overlay-active')).toBe(false);
    expect(document.getElementById('pe-overlay-host')).toBeNull();
    expect($selectedPath.get()).toBeUndefined();
    expect($hoveredPath.get()).toBeUndefined();
    expect($registry.get()).toEqual({});
    expect($config.get()).toBeUndefined();
    expect($dragState.get()).toBeUndefined();
    expect(tryGetChannel()).toBeUndefined();
  });

  it('destroy is idempotent', () => {
    const {target} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    instance.destroy();
    expect(() => instance.destroy()).not.toThrow();
  });

  it('after destroy, incoming messages do not update state', () => {
    const {target} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    instance.destroy();
    emitIncoming({type: 'init', config: makeConfig()});

    expect($config.get()).toBeUndefined();
  });
});
