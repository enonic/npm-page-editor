import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from '../state';

import {parsePage} from '../parse/parse-page';
import {fromString} from '../protocol';
import {$contextMenu, $selectedPath, rebuildIndex, resetDragState, setDragState, setSelectedPath} from '../state';
import {initSelectionDetection} from './selection';
import {createFakeChannel} from './testing/helpers';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeRecord(p: ComponentPath, element?: HTMLElement): ComponentRecord {
  return {
    path: p,
    type: 'part',
    element,
    parentPath: undefined,
    children: [],
    empty: false,
    error: false,
    descriptor: undefined,
    fragmentContentId: undefined,
    loading: false,
    maxOccurrences: undefined,
  };
}

function makeTrackedElement(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-portal-component-type', 'part');
  document.body.appendChild(el);
  return el;
}

describe('selection', () => {
  let cleanup: () => void;
  let channel: ReturnType<typeof createFakeChannel>;

  beforeEach(() => {
    $selectedPath.set(undefined);
    $contextMenu.set(undefined);
    resetDragState();
    channel = createFakeChannel();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  describe('initSelectionDetection', () => {
    //
    // * Click Selection
    //

    it('selects component on click', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      cleanup = initSelectionDetection(channel);

      el.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      expect($selectedPath.get()).toBe(p);
      expect(channel.messages).toEqual([expect.objectContaining({type: 'select', path: p})]);
    });

    it('deselects on click when already selected', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});
      setSelectedPath(p);

      cleanup = initSelectionDetection(channel);

      el.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      expect($selectedPath.get()).toBeUndefined();
      expect(channel.messages).toEqual([expect.objectContaining({type: 'deselect', path: p})]);
    });

    it('deselects current when clicking outside tracked elements', () => {
      const p = path('/main/0');
      setSelectedPath(p);

      cleanup = initSelectionDetection(channel);

      document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      expect($selectedPath.get()).toBeUndefined();
      expect(channel.messages).toEqual([expect.objectContaining({type: 'deselect', path: p})]);
    });

    it('does nothing when clicking outside with no selection', () => {
      cleanup = initSelectionDetection(channel);

      document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      expect($selectedPath.get()).toBeUndefined();
      expect(channel.messages).toEqual([]);
    });

    //
    // * Context Menu
    //

    it('opens context menu on right click', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      cleanup = initSelectionDetection(channel);

      el.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));

      expect($selectedPath.get()).toBe(p);
      expect($contextMenu.get()).toEqual(expect.objectContaining({kind: 'component', path: p}));
      expect(channel.messages).toEqual([expect.objectContaining({type: 'select', path: p, rightClicked: true})]);
    });

    //
    // * Guards
    //

    it('ignores click during drag', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      setDragState({
        itemType: 'part',
        itemLabel: 'Part',
        sourcePath: p,
        targetRegion: undefined,
        targetIndex: undefined,
        dropAllowed: false,
        message: undefined,
        placeholderElement: undefined,
        placeholderVariant: undefined,
        x: undefined,
        y: undefined,
      });

      cleanup = initSelectionDetection(channel);

      el.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      expect($selectedPath.get()).toBeUndefined();
      expect(channel.messages).toEqual([]);
    });

    it('ignores click during post-drag cooldown', () => {
      vi.useFakeTimers();

      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      // Start then end drag to trigger cooldown (setDragState, not resetDragState)
      setDragState({
        itemType: 'part',
        itemLabel: 'Part',
        sourcePath: p,
        targetRegion: undefined,
        targetIndex: undefined,
        dropAllowed: false,
        message: undefined,
        placeholderElement: undefined,
        placeholderVariant: undefined,
        x: undefined,
        y: undefined,
      });
      // setDragState(undefined) triggers cooldown; resetDragState() would skip it
      setDragState(undefined);

      cleanup = initSelectionDetection(channel);

      el.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      expect($selectedPath.get()).toBeUndefined();
      expect(channel.messages).toEqual([]);

      vi.useRealTimers();
    });

    it('ignores context menu during drag', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      setDragState({
        itemType: 'part',
        itemLabel: 'Part',
        sourcePath: p,
        targetRegion: undefined,
        targetIndex: undefined,
        dropAllowed: false,
        message: undefined,
        placeholderElement: undefined,
        placeholderVariant: undefined,
        x: undefined,
        y: undefined,
      });

      cleanup = initSelectionDetection(channel);

      el.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));

      expect($selectedPath.get()).toBeUndefined();
      expect(channel.messages).toEqual([]);
    });

    //
    // * Cleanup
    //

    it('removes listeners on cleanup', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      cleanup = initSelectionDetection(channel);
      cleanup();

      el.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      expect($selectedPath.get()).toBeUndefined();
      expect(channel.messages).toEqual([]);
    });

    //
    // * Fragments
    //

    it('selects the fragment wrapper when clicking inner fragment content', () => {
      document.body.innerHTML = `
        <section data-portal-region="main">
          <div data-portal-component-type="fragment" id="frag">
            <div data-portal-region="inner">
              <article data-portal-component-type="part" id="inner"></article>
            </div>
          </div>
        </section>
      `;

      const records = parsePage(document.body);
      rebuildIndex(records);

      cleanup = initSelectionDetection(channel);

      const inner = document.getElementById('inner');
      inner?.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      const fragPath = path('/main/0');
      expect($selectedPath.get()).toBe(fragPath);
      expect(channel.messages).toEqual([expect.objectContaining({type: 'select', path: fragPath})]);
    });
  });
});
