import type {ComponentPath} from '../protocol';

import {initGeometryScheduler, markDirty, registerConsumer} from './scheduler';

function path(raw: string): ComponentPath {
  return raw as ComponentPath;
}

function makeElement(rect: Partial<DOMRect> = {}): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => DOMRect.fromRect({x: 0, y: 0, width: 100, height: 50, ...rect});
  return el;
}

describe('scheduler', () => {
  let cleanup: () => void;
  let elements: Map<string, HTMLElement>;

  beforeEach(() => {
    vi.useFakeTimers();
    elements = new Map();
    cleanup = initGeometryScheduler(p => elements.get(p));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('registerConsumer', () => {
    it('triggers measurement on registration', () => {
      const el = makeElement({x: 10, y: 20});
      elements.set('/main/0', el);

      const cb = vi.fn<(rect: DOMRect) => void>();
      registerConsumer(path('/main/0'), cb);

      vi.runAllTimers();

      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({x: 10, y: 20}));
    });

    it('unregister prevents future callbacks', () => {
      const el = makeElement();
      elements.set('/main/0', el);

      const cb = vi.fn<(rect: DOMRect) => void>();
      const unregister = registerConsumer(path('/main/0'), cb);

      vi.runAllTimers();
      cb.mockClear();

      unregister();
      markDirty();
      vi.runAllTimers();

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('markDirty', () => {
    it('schedules a single rAF even when called multiple times', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
      const el = makeElement();
      elements.set('/main/0', el);

      registerConsumer(path('/main/0'), vi.fn<(rect: DOMRect) => void>());
      vi.runAllTimers();
      rafSpy.mockClear();

      markDirty();
      markDirty();
      markDirty();

      expect(rafSpy).toHaveBeenCalledOnce();

      rafSpy.mockRestore();
    });
  });

  describe('measure', () => {
    it('calls each consumer with a cloned DOMRect', () => {
      const el1 = makeElement({x: 1});
      const el2 = makeElement({x: 2});
      elements.set('/main/0', el1);
      elements.set('/main/1', el2);

      const cb1 = vi.fn<(rect: DOMRect) => void>();
      const cb2 = vi.fn<(rect: DOMRect) => void>();
      registerConsumer(path('/main/0'), cb1);
      registerConsumer(path('/main/1'), cb2);

      vi.runAllTimers();

      expect(cb1).toHaveBeenCalledWith(expect.objectContaining({x: 1}));
      expect(cb2).toHaveBeenCalledWith(expect.objectContaining({x: 2}));
    });

    it('provides a cloned rect, not the original', () => {
      const el = makeElement({x: 5, y: 10, width: 100, height: 50});
      elements.set('/main/0', el);

      let received: DOMRect | undefined;
      registerConsumer(path('/main/0'), rect => {
        received = rect;
      });

      vi.runAllTimers();

      expect(received).toBeDefined();
      expect(received).not.toBe(el.getBoundingClientRect());
      expect(received?.x).toBe(5);
    });

    it('skips consumers whose element is missing', () => {
      const cb = vi.fn<(rect: DOMRect) => void>();
      registerConsumer(path('/main/0'), cb);

      vi.runAllTimers();

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('initGeometryScheduler', () => {
    it('scroll triggers measurement', () => {
      const el = makeElement({x: 42});
      elements.set('/main/0', el);

      const cb = vi.fn<(rect: DOMRect) => void>();
      registerConsumer(path('/main/0'), cb);
      vi.runAllTimers();
      cb.mockClear();

      document.dispatchEvent(new Event('scroll'));
      vi.runAllTimers();

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({x: 42}));
    });

    it('resize triggers measurement', () => {
      const el = makeElement({y: 99});
      elements.set('/main/0', el);

      const cb = vi.fn<(rect: DOMRect) => void>();
      registerConsumer(path('/main/0'), cb);
      vi.runAllTimers();
      cb.mockClear();

      window.dispatchEvent(new Event('resize'));
      vi.runAllTimers();

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({y: 99}));
    });

    it('cleanup removes listeners and cancels pending rAF', () => {
      const el = makeElement();
      elements.set('/main/0', el);

      const cb = vi.fn<(rect: DOMRect) => void>();
      registerConsumer(path('/main/0'), cb);
      vi.runAllTimers();
      cb.mockClear();

      cleanup();

      document.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
      vi.runAllTimers();

      expect(cb).not.toHaveBeenCalled();

      // Re-init for afterEach cleanup
      cleanup = initGeometryScheduler(p => elements.get(p));
    });
  });
});
