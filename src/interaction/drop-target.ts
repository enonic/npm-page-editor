import type {ComponentPath, ComponentType} from '../protocol';
import type {ComponentRecord} from '../state';

import {translate} from '../i18n';
import {isDescendantOf} from '../protocol/path';
import {getPathForElement, getRecord, $registry} from '../state';

//
// * Types
//

export type Axis = 'x' | 'y';

export type DropTarget = {
  regionPath: ComponentPath;
  index: number;
  axis: Axis;
  regionEmpty: boolean;
};

export type DropValidation = {
  allowed: boolean;
  message?: string;
};

//
// * Constants
//

const REGION_SELECTOR = '[data-portal-region]';
const PLACEHOLDER_ATTR = 'data-pe-drag-anchor';
const PLACEHOLDER_HOST_ATTR = 'data-pe-placeholder-host';
const DRAG_PLACEHOLDER_SIZE_PX = 120;
// ? Dead-zone band around a layout's outer edge. Used for two purposes:
// ? 1. Hysteresis: when crossing between "inside a layout region" and "outside any layout",
// ?    the target stays on the previous one until the cursor is past the band.
// ? 2. Escape edges: along the outer region's flow axis (top/bottom for a vertical parent,
// ?    left/right for horizontal), this band disables proximity snap — hovering there is
// ?    treated as "drop before/after the layout as a unit" rather than into an inner region.
const UNSAFE_BAND_PX = 8;

//
// * Geometry helpers
//

function rectContainsPoint(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function distanceToRect(x: number, y: number, rect: DOMRect): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

// ? The cursor is in the layout's "escape zone" when it sits within `band` of the edges
// ? parallel to the outer region's flow. On a vertical parent that's top/bottom; on a
// ? horizontal parent that's left/right. Intent there is "drop before/after the layout as
// ? a unit", not "snap into an inner region".
function isInEscapeZone(x: number, y: number, rect: DOMRect, outerAxis: Axis, band: number): boolean {
  if (outerAxis === 'y') return y - rect.top <= band || rect.bottom - y <= band;
  return x - rect.left <= band || rect.right - x <= band;
}

// ? Near one of the cross-axis edges (perpendicular to the outer flow): left/right for a
// ? vertical parent, top/bottom for a horizontal parent. Flow-axis edges are governed by
// ? the escape zone inside the layout and clean transitions outside — hysteresis there
// ? would conflict with the escape zone's "drop before/after" intent.
function isNearCrossAxisEdge(x: number, y: number, rect: DOMRect, outerAxis: Axis, band: number): boolean {
  if (outerAxis === 'y') return Math.min(Math.abs(x - rect.left), Math.abs(x - rect.right)) <= band;
  return Math.min(Math.abs(y - rect.top), Math.abs(y - rect.bottom)) <= band;
}

function getContainerFlowAxis(containerRegion: HTMLElement): Axis {
  const style = window.getComputedStyle(containerRegion);
  if (style.display === 'flex' || style.display === 'inline-flex') {
    const dir = style.flexDirection;
    return dir === 'row' || dir === 'row-reverse' ? 'x' : 'y';
  }
  if (style.display === 'grid' || style.display === 'inline-grid') {
    const cols = style.gridTemplateColumns;
    if (cols != null && cols !== 'none' && cols.trim().split(/\s+/).length > 1) return 'x';
  }
  return 'y';
}

function getLayoutOuterAxis(layoutRecord: ComponentRecord): Axis {
  if (layoutRecord.parentPath == null) return 'y';
  const parent = getRecord(layoutRecord.parentPath);
  if (parent?.element == null) return 'y';
  return getContainerFlowAxis(parent.element);
}

//
// * Drop target inference
//

// ? When `elementsFromPoint` lands on a region, the cursor may actually be in a layout's
// ? gap/padding (the layout itself isn't a region, so `.closest()` walks up to the parent
// ? region). In that case, snap to the closest inner region of the matching layout so the
// ? user's drop intent maps to the inner column rather than "before/after the layout".
function findProximalInnerRegion(containerRegion: HTMLElement, x: number, y: number): HTMLElement | undefined {
  const containerPath = getPathForElement(containerRegion);
  if (containerPath == null) return undefined;
  const containerRecord = getRecord(containerPath);
  if (containerRecord == null) return undefined;

  const outerAxis = getContainerFlowAxis(containerRegion);

  let bestRegion: HTMLElement | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const childPath of containerRecord.children) {
    const child = getRecord(childPath);
    if (child?.type !== 'layout' || child.element == null) continue;

    const layoutRect = child.element.getBoundingClientRect();
    if (!rectContainsPoint(layoutRect, x, y)) continue;

    // ? The cursor is inside the layout but sitting on the escape edges — treat as an
    // ? outer-region drop (before/after the layout) instead of snapping into a column.
    if (isInEscapeZone(x, y, layoutRect, outerAxis, UNSAFE_BAND_PX)) continue;

    for (const innerPath of child.children) {
      const inner = getRecord(innerPath);
      if (inner?.type !== 'region' || inner.element == null) continue;

      const innerRect = inner.element.getBoundingClientRect();
      const d = distanceToRect(x, y, innerRect);
      if (d < bestDistance) {
        bestDistance = d;
        bestRegion = inner.element;
      }
    }
  }

  return bestRegion;
}

function findRegionElement(x: number, y: number): HTMLElement | undefined {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    const region = el.matches(REGION_SELECTOR) ? el : el.closest<HTMLElement>(REGION_SELECTOR);
    if (region == null) continue;

    const proximal = findProximalInnerRegion(region, x, y);
    return proximal ?? region;
  }
  return undefined;
}

function getEnclosingLayoutPath(regionPath: ComponentPath): ComponentPath | undefined {
  const record = getRecord(regionPath);
  if (record?.parentPath == null) return undefined;
  const parent = getRecord(record.parentPath);
  return parent?.type === 'layout' ? parent.path : undefined;
}

// ? Hysteresis: when crossing a layout boundary cross-axis (perpendicular to the outer
// ? flow), stay on the previous target within the unsafe band. Flow-axis crossings are
// ? intentionally excluded so the escape zone's "drop before/after the layout" can fire
// ? immediately when the cursor reaches the top/bottom edge of a vertical layout.
function applyHysteresis(
  candidateRegion: HTMLElement,
  x: number,
  y: number,
  previousRegionPath: ComponentPath | undefined,
): HTMLElement {
  if (previousRegionPath == null) return candidateRegion;

  const candidatePath = getPathForElement(candidateRegion);
  if (candidatePath == null || candidatePath === previousRegionPath) return candidateRegion;

  const previousRecord = getRecord(previousRegionPath);
  if (previousRecord?.element == null) return candidateRegion;

  const prevLayoutPath = getEnclosingLayoutPath(previousRegionPath);
  const candLayoutPath = getEnclosingLayoutPath(candidatePath);
  if (prevLayoutPath === candLayoutPath) return candidateRegion;

  const boundaryLayoutPath = prevLayoutPath ?? candLayoutPath;
  if (boundaryLayoutPath == null) return candidateRegion;

  const boundaryLayout = getRecord(boundaryLayoutPath);
  if (boundaryLayout?.element == null) return candidateRegion;

  const outerAxis = getLayoutOuterAxis(boundaryLayout);
  const rect = boundaryLayout.element.getBoundingClientRect();
  if (isNearCrossAxisEdge(x, y, rect, outerAxis, UNSAFE_BAND_PX)) return previousRecord.element;

  return candidateRegion;
}

function getDirectChildren(regionRecord: ComponentRecord, sourcePath?: ComponentPath): ComponentRecord[] {
  const result: ComponentRecord[] = [];
  for (const childPath of regionRecord.children) {
    if (sourcePath != null && childPath === sourcePath) continue;
    const child = getRecord(childPath);
    if (child?.element != null) result.push(child);
  }
  return result;
}

function inferAxis(regionElement: HTMLElement, children: ComponentRecord[]): Axis {
  const style = window.getComputedStyle(regionElement);
  if (style.display === 'flex' || style.display === 'inline-flex') {
    const dir = style.flexDirection;
    if (dir === 'row' || dir === 'row-reverse') return 'x';
    return 'y';
  }

  if (style.display === 'grid' || style.display === 'inline-grid') {
    const cols = style.gridTemplateColumns;
    if (cols != null && cols !== 'none' && cols.trim().split(/\s+/).length > 1) return 'x';
    return 'y';
  }

  if (children.length >= 2) {
    const a = children[0].element?.getBoundingClientRect();
    const b = children[1].element?.getBoundingClientRect();
    if (a != null && b != null && Math.abs(a.top - b.top) < Math.abs(a.left - b.left)) return 'x';
    return 'y';
  }

  return 'y';
}

function computeInsertionIndex(children: ComponentRecord[], axis: Axis, cursor: number): number {
  for (let i = 0; i < children.length; i++) {
    const rect = children[i].element?.getBoundingClientRect();
    if (rect == null) continue;
    const mid = axis === 'y' ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    if (cursor < mid) return i;
  }
  return children.length;
}

export function inferDropTarget(
  x: number,
  y: number,
  sourcePath?: ComponentPath,
  previousRegionPath?: ComponentPath,
): DropTarget | undefined {
  const rawRegion = findRegionElement(x, y);
  if (rawRegion == null) return undefined;

  const regionElement = applyHysteresis(rawRegion, x, y, previousRegionPath);

  const regionPath = getPathForElement(regionElement);
  if (regionPath == null) return undefined;

  const regionRecord = getRecord(regionPath);
  if (regionRecord == null || regionRecord.type !== 'region') return undefined;

  const children = getDirectChildren(regionRecord, sourcePath);
  const axis = children.length > 0 ? inferAxis(regionElement, children) : 'y';
  const cursor = axis === 'y' ? y : x;
  const index = computeInsertionIndex(children, axis, cursor);

  return {regionPath, index, axis, regionEmpty: children.length === 0};
}

//
// * Drop validation
//

function hasLayoutDescendant(sourcePath: ComponentPath): boolean {
  const registry = $registry.get();
  for (const record of Object.values(registry)) {
    if (record.type === 'layout' && isDescendantOf(record.path, sourcePath)) return true;
  }
  return false;
}

function isInsideLayout(regionPath: ComponentPath): boolean {
  const regionRecord = getRecord(regionPath);
  if (regionRecord?.parentPath == null) return false;
  const parentRecord = getRecord(regionRecord.parentPath);
  return parentRecord?.type === 'layout';
}

function occupancyExcludingSource(regionPath: ComponentPath, sourcePath: ComponentPath | undefined): number {
  const regionRecord = getRecord(regionPath);
  if (regionRecord == null) return 0;
  let count = 0;
  for (const path of regionRecord.children) {
    if (path !== sourcePath) count += 1;
  }
  return count;
}

// ? Generic capacity check using the server-authored `maxOccurrences`. Regions without
// ? a declared cap are unlimited. Legacy layout-cell single-slot behavior is handled by
// ? the caller via `isLayoutCellOccupied` as a fallback.
function isRegionAtCapacity(regionPath: ComponentPath, sourcePath: ComponentPath | undefined): boolean {
  const regionRecord = getRecord(regionPath);
  if (regionRecord?.maxOccurrences == null) return false;
  return occupancyExcludingSource(regionPath, sourcePath) >= regionRecord.maxOccurrences;
}

function isLayoutCellOccupied(regionPath: ComponentPath, sourcePath: ComponentPath | undefined): boolean {
  // ? Legacy fallback when the descriptor hasn't supplied `maxOccurrences`: treat any
  // ? region whose parent is a `layout` as single-slot. Once CS propagates the cap,
  // ? `isRegionAtCapacity` above takes over and this path becomes a no-op for those regions.
  const regionRecord = getRecord(regionPath);
  if (regionRecord == null) return false;
  if (regionRecord.maxOccurrences != null) return false;
  return regionRecord.children.some(path => path !== sourcePath);
}

export function validateDrop(
  sourcePath: ComponentPath | undefined,
  targetRegion: ComponentPath,
  itemType: ComponentType,
): DropValidation {
  // No drop on own descendant
  if (sourcePath != null && isDescendantOf(targetRegion, sourcePath)) {
    return {allowed: false, message: translate('field.drag.self')};
  }

  const insideLayout = isInsideLayout(targetRegion);

  // No layout inside layout
  if (insideLayout && itemType === 'layout') {
    return {allowed: false, message: translate('field.drag.layoutNested')};
  }

  // No fragment-with-layout inside layout
  if (insideLayout && itemType === 'fragment' && sourcePath != null && hasLayoutDescendant(sourcePath)) {
    return {allowed: false, message: translate('field.drag.fragmentLayout')};
  }

  // Descriptor-driven capacity (region.maxOccurrences). Applies to all regions.
  if (isRegionAtCapacity(targetRegion, sourcePath)) {
    return {allowed: false, message: translate('field.drag.cellOccupied')};
  }

  // Legacy fallback: layout cells are single-slot when no cap is declared.
  if (insideLayout && isLayoutCellOccupied(targetRegion, sourcePath)) {
    return {allowed: false, message: translate('field.drag.cellOccupied')};
  }

  return {allowed: true};
}

//
// * Placeholder anchor management
//

// ! The anchor participates in the region's flex/grid flow, occupying DRAG_PLACEHOLDER_SIZE_PX
// ! on the primary axis. This displaces adjacent siblings to create a real blank drop zone —
// ! matching the legacy editor's behavior and giving the user a tangible target instead of an
// ! overlay that occludes existing content. `DragTargetHighlighter` reads the anchor's rect to
// ! position the visual indicator on top of the reserved slot.
// !
// ! The anchor is marked with `data-pe-drag-anchor` and filtered out of `inferDropTarget`'s
// ! sibling list, so its presence does not affect the next insertion-index computation:
// ! `computeInsertionIndex` walks siblings in registry order, compares the cursor against each
// ! sibling's midpoint, and returns a stable index regardless of whether the anchor has shifted
// ! those siblings downstream.
function applyAnchorStyles(anchor: HTMLElement, axis: Axis): void {
  anchor.style.pointerEvents = 'none';
  anchor.style.removeProperty('position');
  anchor.style.removeProperty('top');
  anchor.style.removeProperty('left');
  anchor.style.removeProperty('flex');
  if (axis === 'x') {
    anchor.style.width = `${String(DRAG_PLACEHOLDER_SIZE_PX)}px`;
    anchor.style.removeProperty('height');
    // ? In flex-row the default cross-axis is `stretch`, but explicit `align-self: stretch`
    // ? covers grid cells and other containers where the default would leave the anchor
    // ? collapsed to zero height.
    anchor.style.alignSelf = 'stretch';
  } else {
    anchor.style.height = `${String(DRAG_PLACEHOLDER_SIZE_PX)}px`;
    anchor.style.removeProperty('width');
    anchor.style.removeProperty('align-self');
  }
}

export function ensurePlaceholderAnchor(
  current: HTMLElement | undefined,
  regionElement: HTMLElement,
  index: number,
  sourcePath?: ComponentPath,
  axis: Axis = 'y',
): HTMLElement {
  const anchor = current ?? document.createElement('div');
  anchor.setAttribute(PLACEHOLDER_ATTR, '');

  // Filter out the source (for component moves), any existing anchors, and the region's
  // placeholder-island host. The host carries `height: 100%` and would otherwise count as a
  // sibling when the region is empty, breaking the "empty → append at 0" invariant.
  const domChildren = Array.from(regionElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      !child.hasAttribute(PLACEHOLDER_ATTR) &&
      !child.hasAttribute(PLACEHOLDER_HOST_ATTR) &&
      (sourcePath == null || getPathForElement(child) !== sourcePath),
  );

  const reference = domChildren[index] ?? null;

  if (anchor.parentElement !== regionElement || anchor.nextSibling !== reference) {
    regionElement.insertBefore(anchor, reference);
  }

  applyAnchorStyles(anchor, axis);

  return anchor;
}

export function clearPlaceholder(element: HTMLElement | undefined): void {
  element?.remove();
}
