/**
 * Auto-scrolls a viewport while a drag operation is active and the pointer
 * approaches any of its edges. Drives scrolling from `requestAnimationFrame`
 * with time-based velocity (px/ms) so behavior is identical across refresh rates.
 *
 * The controller is stateful but isolated; create one per drag-session lifecycle.
 */

export const HOT_ZONE_PX = 64;
const MAX_SPEED_PX_PER_MS = 1.1;
const MIN_SPEED_PX_PER_MS = 0.08;
const MAX_DT_MS = 32;

export type EdgeAutoScrollOptions = {
    onScrolled: () => void;
    getScroller?: () => Element | undefined;
};

export type EdgeAutoScroll = {
    update(x: number, y: number): void;
    stop(): void;
};

function defaultScroller(): Element | undefined {
    return document.scrollingElement ?? document.documentElement ?? undefined;
}

function isDocumentScroller(scroller: Element): boolean {
    return scroller === document.scrollingElement || scroller === document.documentElement;
}

function getViewportSize(scroller: Element): {width: number; height: number; top: number; left: number} {
    if (isDocumentScroller(scroller)) {
        return {width: window.innerWidth, height: window.innerHeight, top: 0, left: 0};
    }

    // ! Use outer rect dimensions, not clientWidth/Height, to keep distance-from-edge symmetric
    const rect = scroller.getBoundingClientRect();
    return {width: rect.width, height: rect.height, top: rect.top, left: rect.left};
}

/**
 * Cubic ease-in normalized to 0..1, where 0 = outside the hot zone and 1 = at the viewport edge.
 * Scroll velocity is `MIN_SPEED + (MAX_SPEED - MIN_SPEED) * intensity`.
 */
export function calcEdgeIntensity(distFromEdge: number): number {
    if (distFromEdge >= HOT_ZONE_PX) return 0;
    const t = 1 - Math.max(0, distFromEdge) / HOT_ZONE_PX;
    return t * t * t;
}

function calcSpeedPxPerMs(distFromEdge: number): number {
    const intensity = calcEdgeIntensity(distFromEdge);
    if (intensity === 0) return 0;
    return MIN_SPEED_PX_PER_MS + (MAX_SPEED_PX_PER_MS - MIN_SPEED_PX_PER_MS) * intensity;
}

function calcAxisVelocity(distFromStart: number, distFromEnd: number): number {
    if (distFromStart < HOT_ZONE_PX && distFromStart < distFromEnd) {
        return -calcSpeedPxPerMs(distFromStart);
    }
    if (distFromEnd < HOT_ZONE_PX) {
        return calcSpeedPxPerMs(distFromEnd);
    }
    return 0;
}

export function createEdgeAutoScroll(options: EdgeAutoScrollOptions): EdgeAutoScroll {
    const {onScrolled, getScroller = defaultScroller} = options;

    let active = false;
    let vxPxPerMs = 0;
    let vyPxPerMs = 0;
    let rafId: number | undefined;
    let lastTimestamp: number | undefined;

    const cancelFrame = (): void => {
        if (rafId != null) {
            cancelAnimationFrame(rafId);
            rafId = undefined;
        }
        lastTimestamp = undefined;
    };

    const stop = (): void => {
        active = false;
        vxPxPerMs = 0;
        vyPxPerMs = 0;
        cancelFrame();
    };

    const tick = (now: number): void => {
        rafId = undefined;
        if (!active || (vxPxPerMs === 0 && vyPxPerMs === 0)) return;

        const scroller = getScroller();
        if (!scroller) {
            stop();
            return;
        }

        if (lastTimestamp == null) {
            lastTimestamp = now;
            rafId = requestAnimationFrame(tick);
            return;
        }

        // Clamp dt so a backgrounded tab doesn't snap the page in one frame
        const dt = Math.min(now - lastTimestamp, MAX_DT_MS);
        lastTimestamp = now;

        const requestedDx = vxPxPerMs * dt;
        const requestedDy = vyPxPerMs * dt;

        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight;
        const atLeft = scroller.scrollLeft <= 0;
        const atRight = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth;

        const dy = (requestedDy < 0 && atTop) || (requestedDy > 0 && atBottom) ? 0 : requestedDy;
        const dx = (requestedDx < 0 && atLeft) || (requestedDx > 0 && atRight) ? 0 : requestedDx;

        if (dx === 0 && dy === 0) {
            stop();
            return;
        }

        const beforeTop = scroller.scrollTop;
        const beforeLeft = scroller.scrollLeft;
        // ! Direct assignment bypasses CSS `scroll-behavior`; `scrollBy({behavior: 'instant'})` can queue
        if (dy !== 0) scroller.scrollTop += dy;
        if (dx !== 0) scroller.scrollLeft += dx;
        const afterTop = scroller.scrollTop;
        const afterLeft = scroller.scrollLeft;

        if (beforeTop === afterTop && beforeLeft === afterLeft) {
            stop();
            return;
        }

        if (!active) return;

        onScrolled();

        if (!active || (vxPxPerMs === 0 && vyPxPerMs === 0)) return;
        rafId = requestAnimationFrame(tick);
    };

    const update = (x: number, y: number): void => {
        const scroller = getScroller();
        if (!scroller) {
            stop();
            return;
        }

        const {width, height, top, left} = getViewportSize(scroller);
        const localX = x - left;
        const localY = y - top;

        const nextVy = calcAxisVelocity(localY, height - localY);
        const nextVx = calcAxisVelocity(localX, width - localX);

        if (nextVx === 0 && nextVy === 0) {
            vxPxPerMs = 0;
            vyPxPerMs = 0;
            cancelFrame();
            active = false;
            return;
        }

        vxPxPerMs = nextVx;
        vyPxPerMs = nextVy;
        active = true;

        if (rafId == null) {
            lastTimestamp = undefined;
            rafId = requestAnimationFrame(tick);
        }
    };

    return {update, stop};
}
