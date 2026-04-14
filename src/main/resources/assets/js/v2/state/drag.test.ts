import type {ComponentPath} from '../protocol';

import {fromString} from '../protocol';
import {getDragState, isDragging, isPostDragCooldown, resetDragState, setDragState, type DragState} from './drag';

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
    x: undefined,
    y: undefined,
    ...overrides,
  };
}

describe('drag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDragState();
  });

  afterEach(() => {
    resetDragState();
    vi.useRealTimers();
  });

  describe('isDragging', () => {
    it('returns false when no drag is active', () => {
      expect(isDragging()).toBe(false);
    });

    it('returns true after starting a drag', () => {
      setDragState(makeDrag());
      expect(isDragging()).toBe(true);
    });

    it('returns false after ending a drag', () => {
      setDragState(makeDrag());
      setDragState(undefined);
      expect(isDragging()).toBe(false);
    });
  });

  describe('getDragState', () => {
    it('returns the current drag state', () => {
      const drag = makeDrag();
      setDragState(drag);
      expect(getDragState()).toBe(drag);
    });

    it('returns undefined when no drag is active', () => {
      expect(getDragState()).toBeUndefined();
    });
  });

  describe('mutual exclusion', () => {
    it('rejects a new drag while one is already active', () => {
      const first = makeDrag({itemLabel: 'First'});
      const second = makeDrag({itemLabel: 'Second'});

      setDragState(first);
      setDragState(second);

      expect(getDragState()).toBe(first);
    });
  });

  describe('post-drag cooldown', () => {
    it('returns false when no drag has occurred', () => {
      expect(isPostDragCooldown()).toBe(false);
    });

    it('returns true immediately after drag ends', () => {
      setDragState(makeDrag());
      setDragState(undefined);

      expect(isPostDragCooldown()).toBe(true);
    });

    it('returns false after 100ms', () => {
      setDragState(makeDrag());
      setDragState(undefined);

      vi.advanceTimersByTime(100);

      expect(isPostDragCooldown()).toBe(false);
    });

    it('returns true at 99ms, false at 100ms', () => {
      setDragState(makeDrag());
      setDragState(undefined);

      vi.advanceTimersByTime(99);
      expect(isPostDragCooldown()).toBe(true);

      vi.advanceTimersByTime(1);
      expect(isPostDragCooldown()).toBe(false);
    });

    it('clears cooldown when a new drag starts during cooldown', () => {
      setDragState(makeDrag());
      setDragState(undefined);
      expect(isPostDragCooldown()).toBe(true);

      setDragState(makeDrag());
      expect(isPostDragCooldown()).toBe(false);
    });
  });
});
