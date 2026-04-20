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
const DRAG_PLACEHOLDER_SIZE_PX = 120;

//
// * Drop target inference
//

function findRegionElement(x: number, y: number): HTMLElement | undefined {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    const region = el.matches(REGION_SELECTOR) ? el : el.closest<HTMLElement>(REGION_SELECTOR);
    if (region != null) return region;
  }
  return undefined;
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

export function inferDropTarget(x: number, y: number, sourcePath?: ComponentPath): DropTarget | undefined {
  const regionElement = findRegionElement(x, y);
  if (regionElement == null) return undefined;

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

type AnchorRect = {top: number; left: number; width: number; height: number};

// ! The anchor uses `position: fixed` so it is removed from the region's flex/grid flow.
// ! If it participated in flow, a freshly-inserted anchor would shift its siblings' bounding
// ! rects by 120px and the next `computeInsertionIndex` call would read a different target —
// ! producing an oscillation where the anchor dances between positions on every mousemove.
// ! Viewport coords are computed from the adjacent siblings' rects and kept in sync with the
// ! `DragTargetHighlighter` overlay, which reads `anchor.getBoundingClientRect()`.
function midlineY(before: DOMRect | undefined, after: DOMRect | undefined): number {
  if (before != null && after != null) return (before.bottom + after.top) / 2;
  if (after != null) return after.top;
  return before?.bottom ?? 0;
}

function midlineX(before: DOMRect | undefined, after: DOMRect | undefined): number {
  if (before != null && after != null) return (before.right + after.left) / 2;
  if (after != null) return after.left;
  return before?.right ?? 0;
}

function computeAnchorRect(regionElement: HTMLElement, siblings: HTMLElement[], index: number, axis: Axis): AnchorRect {
  if (siblings.length === 0) {
    const r = regionElement.getBoundingClientRect();
    if (axis === 'y') {
      return {top: r.top, left: r.left, width: r.width, height: DRAG_PLACEHOLDER_SIZE_PX};
    }
    return {top: r.top, left: r.left, width: DRAG_PLACEHOLDER_SIZE_PX, height: r.height};
  }

  const clamped = Math.max(0, Math.min(index, siblings.length));
  const before = clamped > 0 ? siblings[clamped - 1].getBoundingClientRect() : undefined;
  const after = clamped < siblings.length ? siblings[clamped].getBoundingClientRect() : undefined;
  const ref = after ?? before;
  if (ref == null) {
    return {top: 0, left: 0, width: 0, height: 0};
  }

  const half = DRAG_PLACEHOLDER_SIZE_PX / 2;
  if (axis === 'y') {
    return {top: midlineY(before, after) - half, left: ref.left, width: ref.width, height: DRAG_PLACEHOLDER_SIZE_PX};
  }
  return {top: ref.top, left: midlineX(before, after) - half, width: DRAG_PLACEHOLDER_SIZE_PX, height: ref.height};
}

function applyAnchorStyles(anchor: HTMLElement, rect: AnchorRect): void {
  anchor.style.position = 'fixed';
  anchor.style.pointerEvents = 'none';
  anchor.style.top = `${String(rect.top)}px`;
  anchor.style.left = `${String(rect.left)}px`;
  anchor.style.width = `${String(rect.width)}px`;
  anchor.style.height = `${String(rect.height)}px`;
  anchor.style.removeProperty('align-self');
  anchor.style.removeProperty('flex');
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

  // Compute reference child for insertion, excluding source and existing anchors.
  // Kept in DOM for `inferDropTarget` filtering and DOM-order inspection in tests,
  // but `position: fixed` keeps it out of the region's layout.
  const domChildren = Array.from(regionElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      !child.hasAttribute(PLACEHOLDER_ATTR) &&
      (sourcePath == null || getPathForElement(child) !== sourcePath),
  );

  const reference = domChildren[index] ?? null;

  if (anchor.parentElement !== regionElement || anchor.nextSibling !== reference) {
    regionElement.insertBefore(anchor, reference);
  }

  applyAnchorStyles(anchor, computeAnchorRect(regionElement, domChildren, index, axis));

  return anchor;
}

export function clearPlaceholder(element: HTMLElement | undefined): void {
  element?.remove();
}
