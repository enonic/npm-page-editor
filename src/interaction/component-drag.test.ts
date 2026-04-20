import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from '../state';

import {fromString} from '../protocol';
import {$dragState, isPostDragCooldown, rebuildIndex, resetDragState, setDragState, setRegistry} from '../state';
import {initComponentDrag} from './component-drag';
import {createFakeChannel} from './testing/helpers';

const syncDragEmptyRegionsMock = vi.fn<(path: string | undefined) => void>();
vi.mock('../reconcile', () => ({
  syncDragEmptyRegions: (path: string | undefined) => syncDragEmptyRegionsMock(path),
}));

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeRecord(
  p: string,
  type: ComponentRecord['type'],
  element: HTMLElement | undefined,
  parentPath: string | undefined,
  children: string[] = [],
): ComponentRecord {
  return {
    path: path(p),
    type,
    element,
    parentPath: parentPath != null ? path(parentPath) : undefined,
    children: children.map(path),
    empty: children.length === 0 && type === 'region',
    error: false,
    descriptor: undefined,
    fragmentContentId: undefined,
    loading: false,
    maxOccurrences: undefined,
  };
}

function setRect(el: HTMLElement, rect: Partial<DOMRect>): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  });
}

function makeTrackedElement(type = 'part'): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-portal-component-type', type);
  document.body.appendChild(el);
  return el;
}

function makeRegionElement(name: string): HTMLElement {
  const el = document.createElement('section');
  el.setAttribute('data-portal-region', name);
  document.body.appendChild(el);
  return el;
}

function setupRegistry(records: Record<string, ComponentRecord>): void {
  setRegistry(records);
  rebuildIndex(records);
}

function mouseDown(target: HTMLElement, x = 0, y = 0): void {
  target.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: x, clientY: y, button: 0}));
}

function mouseMove(x: number, y: number): void {
  document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: x, clientY: y}));
}

function mouseUp(x = 0, y = 0, button = 0): void {
  document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: x, clientY: y, button}));
}

describe('component-drag', () => {
  let cleanup: () => void;
  let channel: ReturnType<typeof createFakeChannel>;

  beforeEach(() => {
    document.body.innerHTML = '';
    resetDragState();
    channel = createFakeChannel();
    syncDragEmptyRegionsMock.mockReset();
    // jsdom does not implement elementsFromPoint — polyfill for tests
    if (!('elementsFromPoint' in document)) {
      Object.defineProperty(document, 'elementsFromPoint', {value: () => [], writable: true, configurable: true});
    }
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    resetDragState();
    setRegistry({});
  });

  describe('initComponentDrag', () => {
    //
    // * Basic drag flow
    //

    it('starts drag after threshold exceeded', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      expect($dragState.get()).toBeUndefined();

      mouseMove(110, 100);
      expect($dragState.get()).toBeDefined();
      expect(channel.messages).toEqual([expect.objectContaining({type: 'drag-started', path: path('/main/0')})]);
    });

    it('hides source element during drag', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);
      expect(part.style.display).toBe('none');
    });

    it('restores source element on drop', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);
      mouseUp(110, 100);

      expect(part.style.display).not.toBe('none');
    });

    it('sends move on valid drop', () => {
      const region = makeRegionElement('main');
      const part0 = makeTrackedElement('part');
      const part1 = makeTrackedElement('part');
      region.appendChild(part0);
      region.appendChild(part1);
      setRect(part0, {top: 0, height: 100});
      setRect(part1, {top: 100, height: 100});

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0', '/main/1']),
        '/main/0': makeRecord('/main/0', 'part', part0, '/main'),
        '/main/1': makeRecord('/main/1', 'part', part1, '/main'),
      });

      cleanup = initComponentDrag(channel);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      mouseDown(part0, 100, 50);
      mouseMove(100, 60);
      mouseUp(100, 180);

      const moveMsg = channel.messages.find(m => m.type === 'move');
      expect(moveMsg).toBeDefined();
    });

    it('sends drag-stopped on mouseup outside a valid target', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);
      mouseUp(110, 100);

      expect(channel.messages.some(m => m.type === 'drag-stopped')).toBe(true);
    });

    it('sends drag-stopped on successful drop after drag-dropped', () => {
      const region = makeRegionElement('main');
      const part0 = makeTrackedElement('part');
      const part1 = makeTrackedElement('part');
      region.appendChild(part0);
      region.appendChild(part1);
      setRect(part0, {top: 0, height: 100});
      setRect(part1, {top: 100, height: 100});

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0', '/main/1']),
        '/main/0': makeRecord('/main/0', 'part', part0, '/main'),
        '/main/1': makeRecord('/main/1', 'part', part1, '/main'),
      });

      cleanup = initComponentDrag(channel);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      mouseDown(part0, 100, 50);
      mouseMove(100, 60);
      mouseUp(100, 180);

      const types = channel.messages.map(m => m.type);
      expect(types).toContain('move');
      const droppedIdx = types.indexOf('drag-dropped');
      const stoppedIdx = types.indexOf('drag-stopped');
      expect(droppedIdx).toBeGreaterThanOrEqual(0);
      expect(stoppedIdx).toBeGreaterThan(droppedIdx);
    });

    it('clears drag state after drop', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);
      mouseUp(110, 100);

      expect($dragState.get()).toBeUndefined();
    });

    //
    // * Threshold
    //

    it('does not start drag below threshold', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(103, 100);

      expect($dragState.get()).toBeUndefined();
      expect(channel.messages).toEqual([]);
    });

    //
    // * Cancel
    //

    it('cancels drag on Escape', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);

      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));

      expect($dragState.get()).toBeUndefined();
      expect(part.style.display).not.toBe('none');
      expect(channel.messages.some(m => m.type === 'drag-stopped')).toBe(true);
    });

    it('cancels drag on window blur', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);

      window.dispatchEvent(new Event('blur'));

      expect($dragState.get()).toBeUndefined();
      expect(part.style.display).not.toBe('none');
    });

    //
    // * Guards
    //

    it('ignores non-primary button', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      part.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 100, clientY: 100, button: 2}));
      mouseMove(110, 100);

      expect($dragState.get()).toBeUndefined();
    });

    it('does not drag page records', () => {
      const page = document.createElement('div');
      page.setAttribute('data-portal-component-type', 'page');
      document.body.appendChild(page);

      setupRegistry({
        '/': makeRecord('/', 'page', page, undefined, ['/main']),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(page, 100, 100);
      mouseMove(110, 100);

      expect($dragState.get()).toBeUndefined();
    });

    it('does not drag region records', () => {
      const region = makeRegionElement('main');

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(region, 100, 100);
      mouseMove(110, 100);

      expect($dragState.get()).toBeUndefined();
    });

    //
    // * Mutual exclusion
    //

    it('rejects mousedown while another drag is already active', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      // Simulate a pre-existing drag session (e.g., context-window-drag)
      setDragState({
        itemType: 'part',
        itemLabel: 'External',
        sourcePath: undefined,
        targetRegion: undefined,
        targetIndex: undefined,
        dropAllowed: false,
        message: undefined,
        placeholderElement: undefined,
        placeholderVariant: undefined,
        x: undefined,
        y: undefined,
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);

      // The external session remains; no component-drag was started
      expect($dragState.get()?.sourcePath).toBeUndefined();
      expect(part.style.display).not.toBe('none');
      expect(channel.messages.some(m => m.type === 'drag-started')).toBe(false);
    });

    it('rejects beginDrag when another drag starts during the pending window', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      // mousedown sets pending — no guard triggered yet
      mouseDown(part, 100, 100);

      // Another session takes the lock between mousedown and mousemove
      setDragState({
        itemType: 'layout',
        itemLabel: 'External',
        sourcePath: undefined,
        targetRegion: undefined,
        targetIndex: undefined,
        dropAllowed: false,
        message: undefined,
        placeholderElement: undefined,
        placeholderVariant: undefined,
        x: undefined,
        y: undefined,
      });

      // Threshold exceeded — beginDrag must bail out, not desync state
      mouseMove(110, 100);

      expect($dragState.get()?.itemLabel).toBe('External');
      expect(part.style.display).not.toBe('none');
      expect(channel.messages.some(m => m.type === 'drag-started')).toBe(false);
    });

    //
    // * Post-drag cooldown
    //

    it('activates post-drag cooldown after successful drop', () => {
      vi.useFakeTimers();
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);
      setRect(part, {top: 0, height: 100});

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      mouseDown(part, 100, 50);
      mouseMove(100, 60);
      mouseUp(100, 80);

      expect(isPostDragCooldown()).toBe(true);

      vi.advanceTimersByTime(100);
      expect(isPostDragCooldown()).toBe(false);

      vi.useRealTimers();
    });

    it('activates post-drag cooldown after cancel', () => {
      vi.useFakeTimers();
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));

      expect(isPostDragCooldown()).toBe(true);

      vi.advanceTimersByTime(100);
      expect(isPostDragCooldown()).toBe(false);

      vi.useRealTimers();
    });

    //
    // * Cleanup
    //

    it('cleans up active drag on teardown', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);
      expect($dragState.get()).toBeDefined();

      cleanup();
      expect($dragState.get()).toBeUndefined();
      expect(part.style.display).not.toBe('none');

      // Prevent afterEach cleanup from calling it again
      cleanup = () => undefined;
    });

    it('removes listeners on cleanup', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);
      cleanup();

      mouseDown(part, 100, 100);
      mouseMove(110, 100);

      expect($dragState.get()).toBeUndefined();

      cleanup = () => undefined;
    });

    //
    // * Drag-time empty-region placeholders
    //

    it('notifies empty-region sync with the source path on drag start', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);

      expect(syncDragEmptyRegionsMock).toHaveBeenCalledWith(path('/main/0'));
    });

    it('clears empty-region sync on drag end', () => {
      const region = makeRegionElement('main');
      const part = makeTrackedElement('part');
      region.appendChild(part);

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', part, '/main'),
      });

      cleanup = initComponentDrag(channel);

      mouseDown(part, 100, 100);
      mouseMove(110, 100);
      syncDragEmptyRegionsMock.mockClear();

      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));

      expect(syncDragEmptyRegionsMock).toHaveBeenCalledWith(undefined);
    });

    //
    // * Placeholder sizing + variant
    //

    //
    // * Wrapper preservation (D2)
    //

    it('moves the wrapping slot ancestor, not the bare tracked element', () => {
      const region = makeRegionElement('main');
      // Wrapper hierarchy: region > wrapper > part
      const wrapper0 = document.createElement('div');
      const part0 = document.createElement('article');
      part0.setAttribute('data-portal-component-type', 'part');
      wrapper0.appendChild(part0);
      region.appendChild(wrapper0);

      const wrapper1 = document.createElement('div');
      const part1 = document.createElement('article');
      part1.setAttribute('data-portal-component-type', 'part');
      wrapper1.appendChild(part1);
      region.appendChild(wrapper1);

      setRect(part0, {top: 0, height: 100});
      setRect(part1, {top: 100, height: 100});

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0', '/main/1']),
        '/main/0': makeRecord('/main/0', 'part', part0, '/main'),
        '/main/1': makeRecord('/main/1', 'part', part1, '/main'),
      });

      cleanup = initComponentDrag(channel);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      mouseDown(part0, 100, 50);
      mouseMove(100, 60);
      mouseUp(100, 180);

      // wrapper0 (holding part0) is the move unit — it lands at the end, preserving the row-wrap.
      expect(wrapper0.contains(part0)).toBe(true);
      expect(wrapper1.contains(part1)).toBe(true);
      expect(Array.from(region.children)).toEqual([wrapper1, wrapper0]);
    });

    it('sizes the anchor to the fixed drop-placeholder height', () => {
      const region = makeRegionElement('main');
      const part0 = makeTrackedElement('part');
      const part1 = makeTrackedElement('part');
      region.appendChild(part0);
      region.appendChild(part1);
      setRect(part0, {top: 0, height: 200});
      setRect(part1, {top: 200, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0', '/main/1']),
        '/main/0': makeRecord('/main/0', 'part', part0, '/main'),
        '/main/1': makeRecord('/main/1', 'part', part1, '/main'),
      });

      cleanup = initComponentDrag(channel);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      mouseDown(part0, 100, 50);
      mouseMove(100, 60);

      const state = $dragState.get();
      expect(state?.placeholderVariant).toBe('slot');
      expect(state?.placeholderElement).toBeDefined();
      // Fixed 120px regardless of neighbour size (200px)
      expect(state?.placeholderElement?.style.height).toBe('120px');
    });

    it('refreshes the drop target on scroll at the last known cursor position', () => {
      // ? Scrolling shifts elements under a stationary cursor. Without a scroll listener
      // ? the in-flow anchor moves with the page but `$dragState` stops updating — the
      // ? visual highlighter (fixed-positioned) desyncs from the anchor.
      const regionA = makeRegionElement('a');
      const regionB = makeRegionElement('b');
      const part = makeTrackedElement('part');
      regionA.appendChild(part);

      setupRegistry({
        '/a': makeRecord('/a', 'region', regionA, '/', ['/a/0']),
        '/a/0': makeRecord('/a/0', 'part', part, '/a'),
        '/b': makeRecord('/b', 'region', regionB, '/', []),
      });

      cleanup = initComponentDrag(channel);

      const fromPoint = vi.spyOn(document, 'elementsFromPoint').mockReturnValue([regionA]);

      mouseDown(part, 100, 50);
      mouseMove(100, 60);
      expect($dragState.get()?.targetRegion).toEqual(path('/a'));

      // Scroll shifts region B under the same cursor position.
      fromPoint.mockReturnValue([regionB]);
      window.dispatchEvent(new Event('scroll'));

      expect($dragState.get()?.targetRegion).toEqual(path('/b'));
    });
  });
});
