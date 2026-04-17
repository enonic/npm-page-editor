import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from '../state';

import {fromString} from '../protocol';
import {$dragState, rebuildIndex, resetDragState, setDragState, setRegistry} from '../state';
import {initContextWindowDrag} from './context-window-drag';
import {createFakeChannel} from './testing/helpers';

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
  };
}

function setupRegistry(records: Record<string, ComponentRecord>): void {
  setRegistry(records);
  rebuildIndex(records);
}

function mouseMove(x: number, y: number): void {
  document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: x, clientY: y}));
}

function mouseUp(x = 0, y = 0): void {
  document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: x, clientY: y, button: 0}));
}

describe('context-window-drag', () => {
  let cleanup: () => void;
  let channel: ReturnType<typeof createFakeChannel>;

  beforeEach(() => {
    document.body.innerHTML = '';
    resetDragState();
    channel = createFakeChannel();
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

  describe('initContextWindowDrag', () => {
    //
    // * Create / destroy lifecycle
    //

    it('starts drag on create-draggable message', () => {
      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'part'});

      const state = $dragState.get();
      expect(state).toBeDefined();
      expect(state?.itemType).toBe('part');
      expect(state?.sourcePath).toBeUndefined();
      expect(channel.messages).toEqual([expect.objectContaining({type: 'drag-started'})]);
    });

    it('cancels drag on destroy-draggable message', () => {
      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'part'});
      channel.messages.length = 0;

      channel.dispatch({type: 'destroy-draggable'});

      expect($dragState.get()).toBeUndefined();
      expect(channel.messages).toEqual([expect.objectContaining({type: 'drag-stopped'})]);
    });

    it('ignores create-draggable with invalid component type', () => {
      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'invalid'});

      expect($dragState.get()).toBeUndefined();
    });

    it('ignores create-draggable while another drag is already active', () => {
      cleanup = initContextWindowDrag(channel);

      // Simulate a pre-existing drag session (e.g., component-drag)
      setDragState({
        itemType: 'part',
        itemLabel: 'Existing',
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

      channel.dispatch({type: 'create-draggable', componentType: 'layout'});

      // Original session preserved
      expect($dragState.get()?.itemLabel).toBe('Existing');
      expect(channel.messages.some(m => m.type === 'drag-started')).toBe(false);
    });

    //
    // * Visibility
    //

    it('does not update drop target while invisible', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      setupRegistry({
        '/': makeRecord('/', 'page', document.createElement('div'), undefined, ['/main']),
        '/main': makeRecord('/main', 'region', region, '/'),
      });

      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'part'});
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      mouseMove(100, 100);

      expect($dragState.get()?.targetRegion).toBeUndefined();
    });

    it('updates drop target when visible', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      setupRegistry({
        '/': makeRecord('/', 'page', document.createElement('div'), undefined, ['/main']),
        '/main': makeRecord('/main', 'region', region, '/'),
      });

      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'part'});
      channel.dispatch({type: 'set-draggable-visible', visible: true});

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      mouseMove(100, 100);

      expect($dragState.get()?.targetRegion).toBe(path('/main'));
      expect($dragState.get()?.dropAllowed).toBe(true);
    });

    it('clears target when set invisible', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      setupRegistry({
        '/': makeRecord('/', 'page', document.createElement('div'), undefined, ['/main']),
        '/main': makeRecord('/main', 'region', region, '/'),
      });

      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'part'});
      channel.dispatch({type: 'set-draggable-visible', visible: true});

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);
      mouseMove(100, 100);

      channel.dispatch({type: 'set-draggable-visible', visible: false});

      expect($dragState.get()?.targetRegion).toBeUndefined();
      expect($dragState.get()?.x).toBeUndefined();
    });

    //
    // * Drop
    //

    it('sends add on valid drop', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      setupRegistry({
        '/': makeRecord('/', 'page', document.createElement('div'), undefined, ['/main']),
        '/main': makeRecord('/main', 'region', region, '/'),
      });

      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'part'});
      channel.dispatch({type: 'set-draggable-visible', visible: true});

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      mouseMove(100, 100);
      channel.messages.length = 0;
      mouseUp(100, 100);

      expect(channel.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({type: 'add', componentType: 'part'}),
          expect.objectContaining({type: 'drag-dropped'}),
        ]),
      );
      expect(channel.messages.some(m => m.type === 'drag-stopped')).toBe(false);
      expect($dragState.get()).toBeUndefined();
    });

    it('rejects layout inside layout', () => {
      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      document.body.appendChild(layout);

      const innerRegion = document.createElement('section');
      innerRegion.setAttribute('data-portal-region', 'inner');
      layout.appendChild(innerRegion);

      setupRegistry({
        '/main/0': makeRecord('/main/0', 'layout', layout, '/main', ['/main/0/inner']),
        '/main/0/inner': makeRecord('/main/0/inner', 'region', innerRegion, '/main/0'),
      });

      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'layout'});
      channel.dispatch({type: 'set-draggable-visible', visible: true});

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([innerRegion]);

      mouseMove(100, 100);

      expect($dragState.get()?.dropAllowed).toBe(false);
    });

    //
    // * Cleanup
    //

    it('cleans up session on teardown', () => {
      cleanup = initContextWindowDrag(channel);

      channel.dispatch({type: 'create-draggable', componentType: 'part'});
      expect($dragState.get()).toBeDefined();

      cleanup();
      expect($dragState.get()).toBeUndefined();

      cleanup = () => undefined;
    });

    it('ignores mousemove/mouseup without active session', () => {
      cleanup = initContextWindowDrag(channel);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);

      mouseMove(100, 100);
      mouseUp(100, 100);

      expect($dragState.get()).toBeUndefined();
      expect(channel.messages).toEqual([]);
    });
  });
});
