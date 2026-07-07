import {afterEach, beforeEach, describe, expect, it, vi} from 'vite-plus/test';

import {createEdgeAutoScroll} from './edge-auto-scroll';

//
// * Test Harness
//

type Frame = (now: number) => void;

interface FakeScroller {
    element: Element;
    deltas: Array<{top: number; left: number}>;
    setScrollTop(value: number): void;
    setScrollLeft(value: number): void;
    getScrollTop(): number;
    getScrollLeft(): number;
}

interface FakeScrollerOptions {
    scrollHeight?: number;
    scrollWidth?: number;
    clientHeight?: number;
    clientWidth?: number;
    scrollTop?: number;
    scrollLeft?: number;
}

function createFakeScroller(opts: FakeScrollerOptions = {}): FakeScroller {
    const state = {
        scrollHeight: opts.scrollHeight ?? 2000,
        scrollWidth: opts.scrollWidth ?? 600,
        clientHeight: opts.clientHeight ?? 400,
        clientWidth: opts.clientWidth ?? 600,
        scrollTop: opts.scrollTop ?? 0,
        scrollLeft: opts.scrollLeft ?? 0,
    };

    const clampTop = (value: number): number => Math.max(0, Math.min(state.scrollHeight - state.clientHeight, value));
    const clampLeft = (value: number): number => Math.max(0, Math.min(state.scrollWidth - state.clientWidth, value));

    const scrollDeltas: Array<{top: number; left: number}> = [];

    const element = {
        get scrollTop() {
            return state.scrollTop;
        },
        set scrollTop(value: number) {
            const next = clampTop(value);
            scrollDeltas.push({top: next - state.scrollTop, left: 0});
            state.scrollTop = next;
        },
        get scrollLeft() {
            return state.scrollLeft;
        },
        set scrollLeft(value: number) {
            const next = clampLeft(value);
            const last = scrollDeltas[scrollDeltas.length - 1];
            if (last && last.left === 0) {
                last.left = next - state.scrollLeft;
            } else {
                scrollDeltas.push({top: 0, left: next - state.scrollLeft});
            }
            state.scrollLeft = next;
        },
        get scrollHeight() {
            return state.scrollHeight;
        },
        get scrollWidth() {
            return state.scrollWidth;
        },
        get clientHeight() {
            return state.clientHeight;
        },
        get clientWidth() {
            return state.clientWidth;
        },
        getBoundingClientRect() {
            return {
                top: 0,
                left: 0,
                right: state.clientWidth,
                bottom: state.clientHeight,
                width: state.clientWidth,
                height: state.clientHeight,
            } as DOMRect;
        },
    } as unknown as Element;

    return {
        element,
        deltas: scrollDeltas,
        setScrollTop(value: number) {
            state.scrollTop = value;
        },
        setScrollLeft(value: number) {
            state.scrollLeft = value;
        },
        getScrollTop() {
            return state.scrollTop;
        },
        getScrollLeft() {
            return state.scrollLeft;
        },
    };
}

let frameQueue: Array<{id: number; cb: Frame}>;
let nextFrameId: number;
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;
let originalInnerHeight: number;

function flushFrame(now: number): void {
    const next = frameQueue.shift();
    if (!next) return;
    next.cb(now);
}

beforeEach(() => {
    frameQueue = [];
    nextFrameId = 1;
    originalRAF = window.requestAnimationFrame;
    originalCAF = window.cancelAnimationFrame;
    originalInnerHeight = window.innerHeight;

    window.requestAnimationFrame = (cb: Frame): number => {
        const id = nextFrameId++;
        frameQueue.push({id, cb});
        return id;
    };

    window.cancelAnimationFrame = (id: number): void => {
        frameQueue = frameQueue.filter(entry => entry.id !== id);
    };

    Object.defineProperty(window, 'innerHeight', {configurable: true, value: 400});
});

afterEach(() => {
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCAF;
    Object.defineProperty(window, 'innerHeight', {configurable: true, value: originalInnerHeight});
});

//
// * Tests
//

describe('createEdgeAutoScroll', () => {
    it('does not scroll when pointer is in the middle of the viewport', () => {
        const scroller = createFakeScroller();
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(200, 200);

        expect(frameQueue).toHaveLength(0);
        expect(scroller.deltas).toHaveLength(0);
        expect(onScrolled).not.toHaveBeenCalled();
    });

    it('scrolls down when pointer is near the bottom edge', () => {
        const scroller = createFakeScroller();
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(200, 390); // 10px from bottom of 400px viewport

        // First tick primes the timestamp
        flushFrame(1000);
        expect(scroller.deltas).toHaveLength(0);

        // Second tick performs the scroll
        flushFrame(1016);
        expect(scroller.deltas).toHaveLength(1);
        expect(scroller.deltas[0].top).toBeGreaterThan(0);
        expect(onScrolled).toHaveBeenCalledTimes(1);
    });

    it('scrolls up with negative delta when pointer is near the top edge', () => {
        const scroller = createFakeScroller({scrollTop: 500});
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(200, 10); // 10px from top

        flushFrame(1000);
        flushFrame(1016);

        expect(scroller.deltas).toHaveLength(1);
        expect(scroller.deltas[0].top).toBeLessThan(0);
    });

    it('uses a larger velocity when pointer is deeper into the hot zone', () => {
        const scroller = createFakeScroller();
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(200, 345); // 55px from bottom — shallow inside 64px hot zone
        flushFrame(1000);
        flushFrame(1016);
        const shallowDy = scroller.deltas[0].top;

        ctrl.stop();
        scroller.setScrollTop(0);
        scroller.deltas.length = 0;

        const ctrl2 = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});
        ctrl2.update(200, 398); // 2px from bottom — deep in zone
        flushFrame(2000);
        flushFrame(2016);
        const deepDy = scroller.deltas[0].top;

        expect(deepDy).toBeGreaterThan(shallowDy);
    });

    it('stops the loop when the scroller hits its bottom boundary', () => {
        const scroller = createFakeScroller({scrollTop: 1600, scrollHeight: 2000, clientHeight: 400});
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(200, 395);
        flushFrame(1000);
        flushFrame(1016);

        expect(frameQueue).toHaveLength(0);
        expect(onScrolled).not.toHaveBeenCalled();
    });

    it('zeroes velocity and cancels rAF when the pointer leaves the hot zone', () => {
        const scroller = createFakeScroller();
        const ctrl = createEdgeAutoScroll({onScrolled: vi.fn(), getScroller: () => scroller.element});

        ctrl.update(200, 395);
        expect(frameQueue).toHaveLength(1);

        ctrl.update(200, 200);
        expect(frameQueue).toHaveLength(0);
    });

    it('stop() is idempotent and prevents further frames', () => {
        const scroller = createFakeScroller();
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(200, 395);
        ctrl.stop();
        ctrl.stop();

        expect(frameQueue).toHaveLength(0);

        // Even if a frame somehow leaks through, onScrolled must not fire
        ctrl.stop();
        expect(onScrolled).not.toHaveBeenCalled();
    });

    it('clamps a large frame delta so a throttled tab does not snap the page', () => {
        const scroller = createFakeScroller();
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(200, 395);
        flushFrame(1000);
        flushFrame(5000); // 4-second gap, should clamp to 32ms

        // With MAX 1.1 px/ms clamped at 32ms, dy is at most ~35
        expect(scroller.deltas[0].top).toBeLessThanOrEqual(32 * 1.1);
    });

    it('scrolls right when pointer is near the right edge', () => {
        const scroller = createFakeScroller({clientWidth: 600, scrollWidth: 2000});
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(595, 200); // 5px from right of 600px viewport

        flushFrame(1000);
        flushFrame(1016);

        expect(scroller.deltas[0].left).toBeGreaterThan(0);
        expect(scroller.deltas[0].top).toBe(0);
    });

    it('scrolls left when pointer is near the left edge', () => {
        const scroller = createFakeScroller({clientWidth: 600, scrollWidth: 2000, scrollLeft: 500});
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(5, 200);

        flushFrame(1000);
        flushFrame(1016);

        expect(scroller.deltas[0].left).toBeLessThan(0);
    });

    it('scrolls diagonally when pointer is near a corner', () => {
        const scroller = createFakeScroller({clientWidth: 600, scrollWidth: 2000});
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        // Pointer near bottom-right corner
        ctrl.update(590, 395);

        flushFrame(1000);
        flushFrame(1016);

        expect(scroller.deltas[0].left).toBeGreaterThan(0);
        expect(scroller.deltas[0].top).toBeGreaterThan(0);
    });

    it('only stops when blocked on every active axis', () => {
        // Already at the right edge — horizontal blocked, but vertical scroll should still happen
        const scroller = createFakeScroller({clientWidth: 600, scrollWidth: 600});
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(595, 395); // near right and bottom

        flushFrame(1000);
        flushFrame(1016);

        expect(scroller.deltas[0].top).toBeGreaterThan(0);
        expect(scroller.deltas[0].left).toBe(0);
        expect(onScrolled).toHaveBeenCalledTimes(1);
    });

    it('produces symmetric velocities at top and bottom edges when the scroller has a border', () => {
        // Scroller has a 2px border on each side. Outer rect 400, inner clientHeight 396.
        // If the controller mixed rect.top with clientHeight, the bottom edge would
        // appear ~4px deeper than the top edge for the same visual distance.
        const state = {
            clientHeight: 396,
            scrollHeight: 2000,
            scrollTop: 500,
            clientWidth: 600,
            scrollWidth: 600,
            scrollLeft: 0,
        };
        const observed: Array<{top: number; left: number}> = [];
        const element = {
            get scrollTop() {
                return state.scrollTop;
            },
            set scrollTop(value: number) {
                observed.push({top: value - state.scrollTop, left: 0});
                state.scrollTop = value;
            },
            get scrollLeft() {
                return state.scrollLeft;
            },
            set scrollLeft(value: number) {
                state.scrollLeft = value;
            },
            get scrollHeight() {
                return state.scrollHeight;
            },
            get scrollWidth() {
                return state.scrollWidth;
            },
            get clientHeight() {
                return state.clientHeight;
            },
            get clientWidth() {
                return state.clientWidth;
            },
            getBoundingClientRect: () =>
                ({top: 0, left: 0, right: 600, bottom: 400, width: 600, height: 400}) as DOMRect,
        } as unknown as Element;

        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => element});

        // 10px from outer top
        ctrl.update(300, 10);
        flushFrame(1000);
        flushFrame(1016);
        const topDy = Math.abs(observed[0].top);

        observed.length = 0;
        ctrl.stop();

        // 10px from outer bottom (rect.height = 400 → y = 390)
        ctrl.update(300, 390);
        flushFrame(2000);
        flushFrame(2016);
        const bottomDy = Math.abs(observed[0].top);

        // Tolerate microscopic float diff from the dt calculation
        expect(Math.abs(topDy - bottomDy)).toBeLessThan(0.1);
    });

    it('reschedules a frame after each successful scroll', () => {
        const scroller = createFakeScroller();
        const onScrolled = vi.fn();
        const ctrl = createEdgeAutoScroll({onScrolled, getScroller: () => scroller.element});

        ctrl.update(200, 395);
        flushFrame(1000);
        flushFrame(1016);
        expect(frameQueue).toHaveLength(1);

        flushFrame(1032);
        expect(onScrolled).toHaveBeenCalledTimes(2);
    });
});
