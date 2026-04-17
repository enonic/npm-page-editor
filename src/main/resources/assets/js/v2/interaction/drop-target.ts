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

function isLayoutCellOccupied(regionPath: ComponentPath, sourcePath: ComponentPath | undefined): boolean {
  // TODO: Replace heuristic with `maxOccurrences` when the portal adapter
  // surfaces region max-child limits. Until then we treat any region whose
  // parent is a `layout` as single-slot.
  const regionRecord = getRecord(regionPath);
  if (regionRecord == null) return false;
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

  // Layout cells are single-slot (heuristic): reject if already occupied
  if (insideLayout && isLayoutCellOccupied(targetRegion, sourcePath)) {
    return {allowed: false, message: translate('field.drag.cellOccupied')};
  }

  return {allowed: true};
}

//
// * Placeholder anchor management
//

function applyAnchorSize(anchor: HTMLElement, axis: Axis): void {
  const size = `${String(DRAG_PLACEHOLDER_SIZE_PX)}px`;
  if (axis === 'x') {
    anchor.style.width = size;
    anchor.style.removeProperty('height');
    anchor.style.alignSelf = 'stretch';
  } else {
    anchor.style.height = size;
    anchor.style.removeProperty('width');
    anchor.style.removeProperty('align-self');
  }
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

  // Compute reference child for insertion, excluding source and existing anchors
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

  applyAnchorSize(anchor, axis);

  return anchor;
}

export function clearPlaceholder(element: HTMLElement | undefined): void {
  element?.remove();
}
