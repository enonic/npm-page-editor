import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from '../state';
import type {Channel} from '../transport';

import {fromString} from '../protocol';
import {$selectedPath, setRegistry, setSelectedPath} from '../state';
import {executeAction, resolveInsertPath} from './definitions';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeChannel(): Channel & {messages: Record<string, unknown>[]} {
  const messages: Record<string, unknown>[] = [];

  return {
    messages,
    send(message) {
      messages.push(message as Record<string, unknown>);
    },
    subscribe() {
      return () => undefined;
    },
    destroy() {
      // noop
    },
  };
}

function makeRecord(p: string, overrides?: Partial<ComponentRecord>): ComponentRecord {
  return {
    path: path(p),
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

describe('definitions', () => {
  beforeEach(() => {
    setSelectedPath(undefined);
    setRegistry({});
  });

  afterEach(() => {
    setSelectedPath(undefined);
    setRegistry({});
  });

  //
  // * resolveInsertPath
  //

  describe('resolveInsertPath', () => {
    it('appends at end for region with children', () => {
      setRegistry({
        '/main': makeRecord('/main', {children: ['/main/0', '/main/1', '/main/2'].map(path)}),
      });

      expect(resolveInsertPath(path('/main'))).toBe('/main/3');
    });

    it('appends at 0 for empty region', () => {
      setRegistry({
        '/main': makeRecord('/main'),
      });

      expect(resolveInsertPath(path('/main'))).toBe('/main/0');
    });

    it('inserts after component at given index', () => {
      expect(resolveInsertPath(path('/main/1'))).toBe('/main/2');
    });

    it('inserts after first component', () => {
      expect(resolveInsertPath(path('/main/0'))).toBe('/main/1');
    });

    it('inserts after nested component', () => {
      expect(resolveInsertPath(path('/main/1/left/0'))).toBe('/main/1/left/1');
    });
  });

  //
  // * executeAction
  //

  describe('executeAction', () => {
    it('sends inspect message', () => {
      const ch = makeChannel();
      executeAction('inspect', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'inspect', path: '/main/0'}]);
    });

    it('sends remove message', () => {
      const ch = makeChannel();
      executeAction('remove', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'remove', path: '/main/0'}]);
    });

    it('sends duplicate message', () => {
      const ch = makeChannel();
      executeAction('duplicate', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'duplicate', path: '/main/0'}]);
    });

    it('sends reset message', () => {
      const ch = makeChannel();
      executeAction('reset', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'reset', path: '/main/0'}]);
    });

    it('sends create-fragment message', () => {
      const ch = makeChannel();
      executeAction('create-fragment', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'create-fragment', path: '/main/0'}]);
    });

    it('sends save-as-template message', () => {
      const ch = makeChannel();
      executeAction('save-as-template', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'save-as-template'}]);
    });

    it('sends inspect at root for page-settings', () => {
      const ch = makeChannel();
      executeAction('page-settings', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'inspect', path: '/'}]);
    });

    it('sets selectedPath to parent and sends select for select-parent', () => {
      const ch = makeChannel();
      executeAction('select-parent', path('/main/0'), ch);
      expect($selectedPath.get()).toBe('/main');
      expect(ch.messages).toEqual([{type: 'select', path: '/main'}]);
    });

    it('does nothing for select-parent at root', () => {
      const ch = makeChannel();
      executeAction('select-parent', path('/'), ch);
      expect($selectedPath.get()).toBeUndefined();
      expect(ch.messages).toEqual([]);
    });

    it('sends add with resolved path for insert-part', () => {
      setRegistry({
        '/main': makeRecord('/main', {children: ['/main/0'].map(path)}),
      });
      const ch = makeChannel();
      executeAction('insert-part', path('/main'), ch);
      expect(ch.messages).toEqual([{type: 'add', path: '/main/1', componentType: 'part'}]);
    });

    it('sends add with resolved path for insert-layout', () => {
      const ch = makeChannel();
      executeAction('insert-layout', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'add', path: '/main/1', componentType: 'layout'}]);
    });

    it('sends add with resolved path for insert-text', () => {
      const ch = makeChannel();
      executeAction('insert-text', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'add', path: '/main/1', componentType: 'text'}]);
    });

    it('sends add with resolved path for insert-fragment', () => {
      const ch = makeChannel();
      executeAction('insert-fragment', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'add', path: '/main/1', componentType: 'fragment'}]);
    });

    it('does nothing for insert grouping action', () => {
      const ch = makeChannel();
      executeAction('insert', path('/main/0'), ch);
      expect(ch.messages).toEqual([]);
    });

    it('sends edit-text message', () => {
      const ch = makeChannel();
      executeAction('edit-text', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'edit-text', path: '/main/0'}]);
    });

    it('sends edit-content message with contentId from registry', () => {
      setRegistry({
        '/main/0': makeRecord('/main/0', {type: 'fragment', fragmentContentId: 'abc-123'}),
      });
      const ch = makeChannel();
      executeAction('edit-content', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'edit-content', contentId: 'abc-123'}]);
    });

    it('does nothing for edit-content when fragmentContentId is missing', () => {
      setRegistry({
        '/main/0': makeRecord('/main/0', {type: 'fragment'}),
      });
      const ch = makeChannel();
      executeAction('edit-content', path('/main/0'), ch);
      expect(ch.messages).toEqual([]);
    });

    it('sends detach-fragment message', () => {
      const ch = makeChannel();
      executeAction('detach-fragment', path('/main/0'), ch);
      expect(ch.messages).toEqual([{type: 'detach-fragment', path: '/main/0'}]);
    });
  });
});
