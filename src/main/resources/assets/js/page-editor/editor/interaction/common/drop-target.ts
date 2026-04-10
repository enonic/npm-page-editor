import {REGION_SELECTOR} from '../../constants';
import {elementIndex} from '../../stores/element-index';
import {getRecord} from '../../stores/registry';
import type {ComponentRecord} from '../../types';

const LAYOUT_SELECTOR = '[data-portal-component-type="layout"]';
const REGION_OR_LAYOUT_SELECTOR = `${REGION_SELECTOR}, ${LAYOUT_SELECTOR}`;
const LAYOUT_EDGE_BAND_PX = 12;

function isInLayoutEdgeBand(rect: DOMRect, y: number): boolean {
    const band = Math.min(LAYOUT_EDGE_BAND_PX, rect.height * 0.08);
    return y - rect.top < band || rect.bottom - y < band;
}

function findNearestLayoutRegion(layout: ComponentRecord, x: number, y: number): string | undefined {
    let best: {path: string; distance: number} | undefined;

    for (const childPath of layout.children) {
        const child = getRecord(childPath);
        if (child?.type !== 'region' || !child.element) {
            continue;
        }

        const rect = child.element.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return childPath;
        }

        const dx = x - (rect.left + rect.width / 2);
        const dy = y - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy);
        if (!best || distance < best.distance) {
            best = {path: childPath, distance};
        }
    }

    return best?.path;
}

// ? When the pointer is over a Layout, descend into its nearest child Region
//   instead of bubbling up to the Layout's parent region. A thin edge band
//   around the Layout's top/bottom acts as an "escape hatch" so the user can
//   still drop the item before/after the Layout itself.
export function resolveTargetRegionPath(elements: HTMLElement[], x: number, y: number): string | undefined {
    for (const element of elements) {
        const container = element.matches(REGION_OR_LAYOUT_SELECTOR)
            ? element
            : element.closest(REGION_OR_LAYOUT_SELECTOR);
        if (!container) {
            continue;
        }

        const path = elementIndex.get(container as HTMLElement);
        const record = getRecord(path);
        if (!record) {
            continue;
        }

        if (record.type === 'region') {
            return path;
        }

        if (record.type === 'layout') {
            const rect = (container as HTMLElement).getBoundingClientRect();
            if (isInLayoutEdgeBand(rect, y)) {
                return record.parentPath;
            }
            return findNearestLayoutRegion(record, x, y) ?? record.parentPath;
        }
    }

    return undefined;
}
