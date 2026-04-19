import type {ComponentPath, IncomingMessage, PageConfig, PageDescriptor} from '../protocol';
import type {ComponentRecord} from '../state';
import type {Channel, MessageHandler} from './channel';

import {initContextWindowDrag} from '../interaction/context-window-drag';
import {fromString} from '../protocol';
import {
  $config,
  $contextMenu,
  $dragState,
  $locked,
  $modifyAllowed,
  $pageControllers,
  $registry,
  $selectedPath,
  $theme,
  resetDragState,
} from '../state';
import {createAdapter} from './adapter';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeConfig(overrides?: Partial<PageConfig>): PageConfig {
  return {
    contentId: 'content-1',
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
    ...overrides,
  };
}

function makeRecord(p: ComponentPath, overrides?: Partial<ComponentRecord>): ComponentRecord {
  return {
    path: p,
    type: 'part',
    element: undefined,
    parentPath: undefined,
    children: [],
    empty: false,
    error: false,
    descriptor: undefined,
    fragmentContentId: undefined,
    loading: false,
    ...overrides,
  };
}

type FakeChannel = Channel & {
  emit(msg: IncomingMessage): void;
  sendMock: ReturnType<typeof vi.fn<Channel['send']>>;
};

function createFakeChannel(): FakeChannel {
  const handlers = new Set<MessageHandler>();
  const sendMock = vi.fn<Channel['send']>();
  return {
    send: sendMock,
    sendMock,
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    destroy: vi.fn<Channel['destroy']>(),
    emit(msg) {
      for (const handler of handlers) {
        handler(msg);
      }
    },
  };
}

describe('adapter', () => {
  let fakeChannel: FakeChannel;

  beforeEach(() => {
    fakeChannel = createFakeChannel();
    $selectedPath.set(undefined);
    $locked.set(false);
    $modifyAllowed.set(true);
    $config.set(undefined);
    $pageControllers.set([]);
    $registry.set({});
    $contextMenu.set(undefined);
    $theme.set('light');
    resetDragState();
  });

  describe('init gating', () => {
    it('queues non-init messages until init received', () => {
      createAdapter(fakeChannel);

      fakeChannel.emit({type: 'select', path: path('/main/0')});

      expect($selectedPath.get()).toBeUndefined();
    });

    it('processes init immediately', () => {
      const config = makeConfig();
      createAdapter(fakeChannel);

      fakeChannel.emit({type: 'init', config});

      expect($config.get()).toEqual(config);
    });

    it('flushes queued messages in order after init', () => {
      createAdapter(fakeChannel);

      fakeChannel.emit({type: 'select', path: path('/main/0')});
      fakeChannel.emit({type: 'set-lock', locked: true});
      fakeChannel.emit({type: 'init', config: makeConfig()});

      expect($selectedPath.get()).toEqual(path('/main/0'));
      expect($locked.get()).toBe(true);
    });

    it('processes messages immediately after initialization', () => {
      createAdapter(fakeChannel);

      fakeChannel.emit({type: 'init', config: makeConfig()});
      fakeChannel.emit({type: 'select', path: path('/main/0')});

      expect($selectedPath.get()).toEqual(path('/main/0'));
    });

    it('handles second init without re-flushing', () => {
      const onPageState = vi.fn<(page: PageDescriptor) => void>();
      createAdapter(fakeChannel, {onPageState});

      fakeChannel.emit({type: 'init', config: makeConfig()});
      fakeChannel.emit({
        type: 'page-state',
        page: {components: {'/main/0': {descriptor: 'my.app:widget'}}},
      });
      expect(onPageState).toHaveBeenCalledOnce();

      fakeChannel.emit({type: 'init', config: makeConfig({locked: true})});

      expect($locked.get()).toBe(true);
      // ? onPageState should not be called again — queue was already flushed
      expect(onPageState).toHaveBeenCalledOnce();
    });
  });

  describe('message dispatch', () => {
    it('init: sets page config, locked, and modifyAllowed', () => {
      createAdapter(fakeChannel);
      const config = makeConfig({locked: true, modifyPermissions: false});

      fakeChannel.emit({type: 'init', config});

      expect($config.get()).toEqual(config);
      expect($locked.get()).toBe(true);
      expect($modifyAllowed.get()).toBe(false);
    });

    it('select: sets selected path', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      fakeChannel.emit({type: 'select', path: path('/main/0')});

      expect($selectedPath.get()).toEqual(path('/main/0'));
    });

    it('deselect: clears selected path and closes context menu', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      $selectedPath.set(path('/main/0'));
      $contextMenu.set({kind: 'component', path: path('/main/0'), x: 100, y: 200});

      fakeChannel.emit({type: 'deselect'});

      expect($selectedPath.get()).toBeUndefined();
      expect($contextMenu.get()).toBeUndefined();
    });

    it('load: sets loading true and forwards existing=true to onComponentLoadRequest', () => {
      const p = path('/main/0');
      $registry.set({[p]: makeRecord(p)});

      const onComponentLoadRequest = vi.fn<(path: ComponentPath, existing: boolean) => void>();
      createAdapter(fakeChannel, {onComponentLoadRequest});
      fakeChannel.emit({type: 'init', config: makeConfig()});

      fakeChannel.emit({type: 'load', path: p, existing: true});

      expect($registry.get()[p]?.loading).toBe(true);
      expect(onComponentLoadRequest).toHaveBeenCalledWith(p, true);
    });

    it('load: forwards existing=false for newly-added components', () => {
      const p = path('/main/0');
      $registry.set({[p]: makeRecord(p)});

      const onComponentLoadRequest = vi.fn<(path: ComponentPath, existing: boolean) => void>();
      createAdapter(fakeChannel, {onComponentLoadRequest});
      fakeChannel.emit({type: 'init', config: makeConfig()});

      fakeChannel.emit({type: 'load', path: p, existing: false});

      expect(onComponentLoadRequest).toHaveBeenCalledWith(p, false);
    });

    it('load: works without callback', () => {
      const p = path('/main/0');
      $registry.set({[p]: makeRecord(p)});

      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      expect(() => {
        fakeChannel.emit({type: 'load', path: p, existing: true});
      }).not.toThrow();

      expect($registry.get()[p]?.loading).toBe(true);
    });

    it('set-component-state: sets loading to processing value', () => {
      const p = path('/main/0');
      $registry.set({[p]: makeRecord(p)});

      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      fakeChannel.emit({type: 'set-component-state', path: p, processing: true});
      expect($registry.get()[p]?.loading).toBe(true);

      fakeChannel.emit({type: 'set-component-state', path: p, processing: false});
      expect($registry.get()[p]?.loading).toBe(false);
    });

    it('page-state: calls onPageState callback', () => {
      const onPageState = vi.fn<(page: PageDescriptor) => void>();
      createAdapter(fakeChannel, {onPageState});
      fakeChannel.emit({type: 'init', config: makeConfig()});

      const page = {components: {'/main/0': {descriptor: 'my.app:widget'}}};
      fakeChannel.emit({type: 'page-state', page});

      expect(onPageState).toHaveBeenCalledWith(page);
    });

    it('page-state: works without callback', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      expect(() => {
        fakeChannel.emit({
          type: 'page-state',
          page: {components: {}},
        });
      }).not.toThrow();
    });

    it('set-lock: sets locked state', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      fakeChannel.emit({type: 'set-lock', locked: true});
      expect($locked.get()).toBe(true);

      fakeChannel.emit({type: 'set-lock', locked: false});
      expect($locked.get()).toBe(false);
    });

    it('set-modify-allowed: sets state and locks when false', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      fakeChannel.emit({type: 'set-modify-allowed', allowed: false});

      expect($modifyAllowed.get()).toBe(false);
      expect($locked.get()).toBe(true);
    });

    it('init: sets theme from config when provided', () => {
      createAdapter(fakeChannel);
      const config = makeConfig({theme: 'dark'});

      fakeChannel.emit({type: 'init', config});

      expect($theme.get()).toBe('dark');
    });

    it('init: keeps default theme when config.theme is absent', () => {
      createAdapter(fakeChannel);
      const config = makeConfig();

      fakeChannel.emit({type: 'init', config});

      expect($theme.get()).toBe('light');
    });

    it('set-theme: updates theme state', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      fakeChannel.emit({type: 'set-theme', theme: 'dark'});
      expect($theme.get()).toBe('dark');

      fakeChannel.emit({type: 'set-theme', theme: 'light'});
      expect($theme.get()).toBe('light');
    });

    it('set-modify-allowed: does not unlock when true', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig({locked: true})});

      fakeChannel.emit({type: 'set-modify-allowed', allowed: true});

      expect($modifyAllowed.get()).toBe(true);
      expect($locked.get()).toBe(true);
    });

    it('draggable messages: no-op', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      expect(() => {
        fakeChannel.emit({type: 'create-draggable', componentType: 'part'});
        fakeChannel.emit({type: 'destroy-draggable'});
        fakeChannel.emit({type: 'set-draggable-visible', visible: false});
      }).not.toThrow();
    });

    it('draggable messages: adapter and context-window-drag coexist on the same channel', () => {
      createAdapter(fakeChannel);
      const stopDrag = initContextWindowDrag(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      fakeChannel.emit({type: 'create-draggable', componentType: 'part'});

      expect($dragState.get()?.itemType).toBe('part');

      stopDrag();
    });

    it('page-controllers: sets controllers', () => {
      createAdapter(fakeChannel);
      fakeChannel.emit({type: 'init', config: makeConfig()});

      const controllers = [{descriptorKey: 'my.app:main', displayName: 'Main', iconClass: 'icon'}];
      fakeChannel.emit({type: 'page-controllers', controllers});

      expect($pageControllers.get()).toEqual(controllers);
    });
  });

  describe('cleanup', () => {
    it('unsubscribes from channel', () => {
      const cleanup = createAdapter(fakeChannel);

      cleanup();

      fakeChannel.emit({type: 'init', config: makeConfig()});
      expect($config.get()).toBeUndefined();
    });
  });

  //
  // * G13 — error reporting
  //

  describe('error reporting', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('posts init-phase error and keeps adapter uninitialized when init handler throws', () => {
      createAdapter(fakeChannel);

      vi.spyOn($config, 'set').mockImplementationOnce(() => {
        throw new Error('bad config');
      });

      fakeChannel.emit({type: 'init', config: makeConfig()});

      expect(fakeChannel.sendMock).toHaveBeenCalledWith({type: 'error', phase: 'init', message: 'bad config'});

      // Adapter remained uninitialized; a subsequent select stays queued.
      fakeChannel.emit({type: 'select', path: path('/main/0')});
      expect($selectedPath.get()).toBeUndefined();

      // A second init succeeds and drains the queue.
      fakeChannel.emit({type: 'init', config: makeConfig()});
      expect($selectedPath.get()).toEqual(path('/main/0'));
    });

    it('reports handle-phase errors per-message while draining the queue', () => {
      const onPageState = vi.fn<(page: PageDescriptor) => void>().mockImplementationOnce(() => {
        throw new Error('queued boom');
      });
      createAdapter(fakeChannel, {onPageState});

      fakeChannel.emit({type: 'page-state', page: {components: {}}});
      fakeChannel.emit({type: 'select', path: path('/main/0')});
      fakeChannel.emit({type: 'init', config: makeConfig()});

      expect(fakeChannel.sendMock).toHaveBeenCalledWith({type: 'error', phase: 'handle', message: 'queued boom'});
      expect($selectedPath.get()).toEqual(path('/main/0'));
    });

    it('reports handle-phase error for post-init message without re-throwing', () => {
      const onPageState = vi.fn<(page: PageDescriptor) => void>().mockImplementation(() => {
        throw new Error('post-init boom');
      });
      createAdapter(fakeChannel, {onPageState});

      fakeChannel.emit({type: 'init', config: makeConfig()});

      expect(() => {
        fakeChannel.emit({type: 'page-state', page: {components: {}}});
      }).not.toThrow();

      expect(fakeChannel.sendMock).toHaveBeenCalledWith({type: 'error', phase: 'handle', message: 'post-init boom'});
    });
  });
});
