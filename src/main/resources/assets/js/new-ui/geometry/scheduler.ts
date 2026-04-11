import {getRecord} from '../stores/registry';

export interface GeometryConsumer {
    targetPath: string;
    callback: (rect: DOMRect) => void;
}

const consumers = new Set<GeometryConsumer>();
let dirty = false;
let frameId: number | undefined;

function cloneDomRect(rect: DOMRect): DOMRect {
    return DOMRect.fromRect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    });
}

function measure(): void {
    dirty = false;
    frameId = undefined;

    consumers.forEach((consumer) => {
        const element = getRecord(consumer.targetPath)?.element;
        if (!element) {
            return;
        }

        consumer.callback(cloneDomRect(element.getBoundingClientRect()));
    });
}

export function markDirty(): void {
    if (dirty) {
        return;
    }

    dirty = true;
    frameId = window.requestAnimationFrame(measure);
}

export function registerConsumer(consumer: GeometryConsumer): () => void {
    consumers.add(consumer);
    markDirty();

    return () => {
        consumers.delete(consumer);
    };
}

export function initGeometryTriggers(): () => void {
    const scrollHandler = () => markDirty();
    const resizeHandler = () => markDirty();

    document.addEventListener('scroll', scrollHandler, {capture: true, passive: true});
    window.addEventListener('resize', resizeHandler, {passive: true});

    return () => {
        document.removeEventListener('scroll', scrollHandler, {capture: true});
        window.removeEventListener('resize', resizeHandler);

        if (frameId != null) {
            window.cancelAnimationFrame(frameId);
        }
    };
}
