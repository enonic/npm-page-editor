import {trackElementResize} from './resize-tracker';

type ResizeCallback = ResizeObserverCallback;

let resizeCallback: ResizeCallback | undefined;
let observedElements: Set<Element>;
let disconnected: boolean;

class FakeResizeObserver {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }

  observe(target: Element): void {
    observedElements.add(target);
  }

  unobserve(target: Element): void {
    observedElements.delete(target);
  }

  disconnect(): void {
    disconnected = true;
    observedElements.clear();
  }
}

describe('resize-tracker', () => {
  const OriginalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    resizeCallback = undefined;
    observedElements = new Set();
    disconnected = false;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = OriginalResizeObserver;
  });

  function triggerResize(...elements: Element[]): void {
    const entries = elements.map(target => ({target}) as ResizeObserverEntry);
    resizeCallback?.(entries, {} as ResizeObserver);
  }

  it('creates observer lazily on first track call', () => {
    expect(resizeCallback).toBeUndefined();

    const el = document.createElement('div');
    const cleanup = trackElementResize(el, vi.fn<() => void>());

    expect(resizeCallback).toBeDefined();

    cleanup();
  });

  it('observes element and calls onResize callback', () => {
    const el = document.createElement('div');
    const onResize = vi.fn<() => void>();

    const cleanup = trackElementResize(el, onResize);

    expect(observedElements.has(el)).toBe(true);

    triggerResize(el);
    expect(onResize).toHaveBeenCalledOnce();

    cleanup();
  });

  it('tracks multiple elements simultaneously', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    const cb1 = vi.fn<() => void>();
    const cb2 = vi.fn<() => void>();

    const cleanup1 = trackElementResize(el1, cb1);
    const cleanup2 = trackElementResize(el2, cb2);

    expect(observedElements.size).toBe(2);

    triggerResize(el1);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).not.toHaveBeenCalled();

    triggerResize(el2);
    expect(cb2).toHaveBeenCalledOnce();

    cleanup1();
    cleanup2();
  });

  it('cleanup unobserves element', () => {
    const el = document.createElement('div');
    const cleanup = trackElementResize(el, vi.fn<() => void>());

    expect(observedElements.has(el)).toBe(true);

    cleanup();

    expect(observedElements.has(el)).toBe(false);
  });

  it('disconnects observer when last element is untracked', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');

    const cleanup1 = trackElementResize(el1, vi.fn<() => void>());
    const cleanup2 = trackElementResize(el2, vi.fn<() => void>());

    cleanup1();
    expect(disconnected).toBe(false);

    cleanup2();
    expect(disconnected).toBe(true);
  });

  it('ignores duplicate tracking of the same element', () => {
    const el = document.createElement('div');
    const cb1 = vi.fn<() => void>();
    const cb2 = vi.fn<() => void>();

    const cleanup1 = trackElementResize(el, cb1);
    const cleanup2 = trackElementResize(el, cb2);

    triggerResize(el);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).not.toHaveBeenCalled();

    cleanup2();
    triggerResize(el);
    expect(cb1).toHaveBeenCalledTimes(2);

    cleanup1();
  });

  it('re-creates observer after previous one was disconnected', () => {
    const el1 = document.createElement('div');
    const cleanup1 = trackElementResize(el1, vi.fn<() => void>());
    cleanup1();
    expect(disconnected).toBe(true);

    disconnected = false;
    const el2 = document.createElement('div');
    const cb = vi.fn<() => void>();
    const cleanup2 = trackElementResize(el2, cb);

    expect(observedElements.has(el2)).toBe(true);

    triggerResize(el2);
    expect(cb).toHaveBeenCalledOnce();

    cleanup2();
  });

  it('returns no-op when ResizeObserver is unavailable', () => {
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    const el = document.createElement('div');
    const cleanup = trackElementResize(el, vi.fn<() => void>());

    expect(observedElements.size).toBe(0);

    cleanup();
  });
});
