import {markDirty} from './scheduler';

const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
    markDirty();
});

export function trackElementResize(element: HTMLElement): () => void {
    if (!resizeObserver) {
        return () => undefined;
    }

    resizeObserver.observe(element);
    return () => resizeObserver.unobserve(element);
}
