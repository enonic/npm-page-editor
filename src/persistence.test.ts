import type {ComponentPath, PageConfig} from './protocol';
import type {ComponentRecord} from './state';
import type {Channel, MessageHandler} from './transport';

import {flushSelectionRestore, initSelectionPersistence} from './persistence';
import {fromString} from './protocol/path';
import {$registry, $selectedPath, setPageConfig, setSelectedPath, clearPageConfig} from './state';
import {resetChannel, setChannel} from './transport';

const CONTENT_ID = 'content-123';
const KEY = 'pe-selected-path:' + CONTENT_ID;

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeRecord(p: ComponentPath): ComponentRecord {
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
  };
}

function makeConfig(overrides?: Partial<PageConfig>): PageConfig {
  return {
    contentId: CONTENT_ID,
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
    ...overrides,
  };
}

function createMockChannel(): {channel: Channel; send: ReturnType<typeof vi.fn<Channel['send']>>} {
  const send = vi.fn<Channel['send']>();
  const channel: Channel = {
    send,
    subscribe: (_: MessageHandler) => () => undefined,
    destroy: () => undefined,
  };
  return {channel, send};
}

describe('initSelectionPersistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    $registry.set({});
    setSelectedPath(undefined);
    clearPageConfig();
  });

  afterEach(() => {
    sessionStorage.clear();
    $registry.set({});
    setSelectedPath(undefined);
    clearPageConfig();
    resetChannel();
  });

  it('writes entry when selection changes after config is populated', () => {
    setPageConfig(makeConfig());
    const {channel} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    setSelectedPath(path('/main/0'));

    expect(sessionStorage.getItem(KEY)).toBe('/main/0');
    stop();
  });

  it('removes entry when selection cleared', () => {
    setPageConfig(makeConfig());
    const {channel} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    setSelectedPath(path('/main/0'));
    expect(sessionStorage.getItem(KEY)).toBe('/main/0');

    setSelectedPath(undefined);
    expect(sessionStorage.getItem(KEY)).toBeNull();
    stop();
  });

  it('skips writing root when fragment is false', () => {
    setPageConfig(makeConfig({fragment: false}));
    const {channel} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    setSelectedPath(path('/'));

    expect(sessionStorage.getItem(KEY)).toBeNull();
    stop();
  });

  it('writes root when fragment is true', () => {
    setPageConfig(makeConfig({fragment: true}));
    const {channel} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    setSelectedPath(path('/'));

    expect(sessionStorage.getItem(KEY)).toBe('/');
    stop();
  });

  it('restores stored valid path and sends select message', () => {
    const target = path('/main/0');
    $registry.set({[target]: makeRecord(target)});
    sessionStorage.setItem(KEY, target);
    setPageConfig(makeConfig());

    const {channel, send} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    flushSelectionRestore();

    expect($selectedPath.get()).toBe(target);
    expect(send).toHaveBeenCalledWith({type: 'select', path: target});
    stop();
  });

  it('removes stale stored path not present in registry', () => {
    sessionStorage.setItem(KEY, '/main/99');
    setPageConfig(makeConfig());

    const {channel, send} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    flushSelectionRestore();

    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect($selectedPath.get()).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    stop();
  });

  it('defers activation until config arrives and then restores once', () => {
    const target = path('/main/0');
    $registry.set({[target]: makeRecord(target)});
    sessionStorage.setItem(KEY, target);

    const {channel, send} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    flushSelectionRestore();

    expect($selectedPath.get()).toBeUndefined();
    expect(send).not.toHaveBeenCalled();

    setPageConfig(makeConfig());
    flushSelectionRestore();

    expect($selectedPath.get()).toBe(target);
    expect(send).toHaveBeenCalledTimes(1);

    setPageConfig(makeConfig({pageName: 'changed'}));
    flushSelectionRestore();
    expect(send).toHaveBeenCalledTimes(1);

    stop();
  });

  it('cleanup disposes both listeners', () => {
    const {channel} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    stop();

    setPageConfig(makeConfig());
    setSelectedPath(path('/main/0'));

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('drops malformed stored value', () => {
    sessionStorage.setItem(KEY, 'not-a-path');
    setPageConfig(makeConfig());

    const {channel, send} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    flushSelectionRestore();

    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect($selectedPath.get()).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    stop();
  });

  it('disposer cancels a pending restore that has not been flushed', () => {
    const target = path('/main/0');
    $registry.set({[target]: makeRecord(target)});
    sessionStorage.setItem(KEY, target);
    setPageConfig(makeConfig());

    const {channel, send} = createMockChannel();
    setChannel(channel);

    const stop = initSelectionPersistence();
    stop();
    flushSelectionRestore();

    expect($selectedPath.get()).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(KEY)).toBe(target);
  });
});
