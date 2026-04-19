import type {ComponentPath, PageConfig} from './protocol';
import type * as ReconcileModule from './reconcile';

vi.mock('./components/ComponentEmptyPlaceholder', () => ({ComponentEmptyPlaceholder: () => null}));
vi.mock('./components/ComponentErrorPlaceholder', () => ({ComponentErrorPlaceholder: () => null}));
vi.mock('./components/ComponentLoadingPlaceholder', () => ({ComponentLoadingPlaceholder: () => null}));
vi.mock('./components/ComponentPlaceholder', () => ({ComponentPlaceholder: () => null}));
vi.mock('./components/RegionPlaceholder', () => ({RegionPlaceholder: () => null}));
vi.mock('./components/OverlayApp', () => ({OverlayApp: () => null}));

const reconcileState = vi.hoisted(() => ({shouldThrow: false}));

vi.mock('./reconcile', async importOriginal => {
  const actual = await importOriginal<typeof ReconcileModule>();
  return {
    ...actual,
    reconcilePage: (root: HTMLElement, descriptors: Parameters<typeof actual.reconcilePage>[1]) => {
      if (reconcileState.shouldThrow) throw new Error('forced reconcile failure');
      actual.reconcilePage(root, descriptors);
    },
  };
});

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

  //
  // * G22 — idempotent init
  //

  it('second initPageEditor call returns the existing instance and warns', () => {
    const {target, postMessage} = createMockTarget();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const first = initPageEditor(document.body, target);
    postMessage.mockClear();
    const second = initPageEditor(document.body, target);

    expect(second).toBe(first);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({type: 'ready'}), '*');

    warnSpy.mockRestore();
    first.destroy();
  });

  it('initPageEditor works fresh after destroy', () => {
    const {target: firstTarget} = createMockTarget();
    const first = initPageEditor(document.body, firstTarget);
    first.destroy();

    const {target: secondTarget, postMessage: secondPost} = createMockTarget();
    const second = initPageEditor(document.body, secondTarget);

    expect(second).not.toBe(first);
    expect(secondPost).toHaveBeenCalledWith(expect.objectContaining({type: 'ready'}), '*');

    second.destroy();
  });

  //
  // * G14 — page-ready
  //

  it('posts page-ready after first successful page-state reconcile', () => {
    const {target, postMessage} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    emitIncoming({type: 'init', config: makeConfig()});
    postMessage.mockClear();
    emitIncoming({type: 'page-state', page: {components: {}}});

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({type: 'page-ready'}), '*');

    instance.destroy();
  });

  it('posts page-ready only once across multiple page-state messages', () => {
    const {target, postMessage} = createMockTarget();
    const instance = initPageEditor(document.body, target);

    emitIncoming({type: 'init', config: makeConfig()});
    emitIncoming({type: 'page-state', page: {components: {}}});
    emitIncoming({type: 'page-state', page: {components: {}}});

    const readyCalls = postMessage.mock.calls.filter(([msg]) => (msg as {type?: string})?.type === 'page-ready');
    expect(readyCalls).toHaveLength(1);

    instance.destroy();
  });

  it('emits page-ready again after destroy + re-init', () => {
    const {target: t1} = createMockTarget();
    const first = initPageEditor(document.body, t1);
    emitIncoming({type: 'init', config: makeConfig()});
    emitIncoming({type: 'page-state', page: {components: {}}});
    first.destroy();

    const {target: t2, postMessage: post2} = createMockTarget();
    const second = initPageEditor(document.body, t2);
    post2.mockClear();
    emitIncoming({type: 'init', config: makeConfig()});
    emitIncoming({type: 'page-state', page: {components: {}}});

    expect(post2).toHaveBeenCalledWith(expect.objectContaining({type: 'page-ready'}), '*');

    second.destroy();
  });

  //
  // * G13 — reconcile-phase error
  //

  it('posts reconcile-phase error when reconcilePage throws and does not re-throw', () => {
    const {target, postMessage} = createMockTarget();
    const instance = initPageEditor(document.body, target);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    emitIncoming({type: 'init', config: makeConfig()});
    postMessage.mockClear();

    reconcileState.shouldThrow = true;
    try {
      expect(() => {
        emitIncoming({type: 'page-state', page: {components: {}}});
      }).not.toThrow();
    } finally {
      reconcileState.shouldThrow = false;
    }

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({type: 'error', phase: 'reconcile', message: 'forced reconcile failure'}),
      '*',
    );
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({type: 'page-ready'}), '*');

    errorSpy.mockRestore();
    instance.destroy();
  });

  //
  // * G23 — EditorOptions
  //

  it('routes onComponentLoadRequest from options when load message arrives', () => {
    const {target} = createMockTarget();
    const onComponentLoadRequest = vi.fn<(p: ComponentPath) => void>();

    const instance = initPageEditor(document.body, target, {onComponentLoadRequest});

    emitIncoming({type: 'init', config: makeConfig()});
    emitIncoming({type: 'load', path: '/main/0'});

    expect(onComponentLoadRequest).toHaveBeenCalledWith(path('/main/0'));

    instance.destroy();
  });

  it('accepts hostDomain in options without throwing', () => {
    const {target} = createMockTarget();

    const instance = initPageEditor(document.body, target, {hostDomain: 'https://example.com'});

    expect(instance).toBeDefined();

    instance.destroy();
  });
});
