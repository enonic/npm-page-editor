import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from '../state';

import {fromString} from '../protocol';
import {$hoveredPath, rebuildIndex, resetDragState, setDragState} from '../state';
import {initHoverDetection} from './hover';

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

describe('hover', () => {
  let cleanup: () => void;

  beforeEach(() => {
    $hoveredPath.set(undefined);
    resetDragState();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  describe('initHoverDetection', () => {
    it('sets hovered path on mouseover of tracked element', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      cleanup = initHoverDetection();

      el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));

      expect($hoveredPath.get()).toBe(p);
    });

    it('clears hovered path on mouseout with no tracked relatedTarget', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      cleanup = initHoverDetection();

      el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
      expect($hoveredPath.get()).toBe(p);

      el.dispatchEvent(new MouseEvent('mouseout', {bubbles: true, relatedTarget: document.body}));
      expect($hoveredPath.get()).toBeUndefined();
    });

    it('keeps hovered path on mouseout when relatedTarget is tracked', () => {
      const el1 = makeTrackedElement();
      const el2 = makeTrackedElement();
      const p1 = path('/main/0');
      const p2 = path('/main/1');
      rebuildIndex({[p1]: makeRecord(p1, el1), [p2]: makeRecord(p2, el2)});

      cleanup = initHoverDetection();

      el1.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
      expect($hoveredPath.get()).toBe(p1);

      el1.dispatchEvent(new MouseEvent('mouseout', {bubbles: true, relatedTarget: el2}));
      expect($hoveredPath.get()).toBe(p1);
    });

    it('clears hovered path during drag', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      cleanup = initHoverDetection();

      el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
      expect($hoveredPath.get()).toBe(p);

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

      el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
      expect($hoveredPath.get()).toBeUndefined();
    });

    it('removes listeners on cleanup', () => {
      const el = makeTrackedElement();
      const p = path('/main/0');
      rebuildIndex({[p]: makeRecord(p, el)});

      cleanup = initHoverDetection();
      cleanup();

      el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
      expect($hoveredPath.get()).toBeUndefined();
    });
  });
});
