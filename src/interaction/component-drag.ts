import type {ComponentPath, ComponentType} from '../protocol';
import type {Channel} from '../transport';

import {markDirty} from '../geometry';
import {translate} from '../i18n';
import {collectTrackedDescendants, isComponentElement} from '../parse';
import {insertAt} from '../protocol/path';
import {syncDragEmptyRegions} from '../reconcile';
import {setDragCursor} from '../rendering/drag-cursor';
import {
  closeContextMenu,
  getPathForElement,
  getRecord,
  isDragging,
  setDragState,
  setElementIndexFrozen,
  setHoveredPath,
  setSelectedPath,
  updateDragState,
} from '../state';
import {clearPlaceholder, ensurePlaceholderAnchor, inferDropTarget, validateDrop} from './drop-target';
import {getTrackedTarget, isOverlayChromeEvent} from './guards';

export type ComponentDragOptions = {
  // ! Called once the drag has mutated the DOM locally (successful drop) so the host can
  // ! suppress reconcile until the corresponding `page-state` round-trip lands. Without
  // ! this, the MutationObserver-triggered reconcile runs against still-old descriptors
  // ! and mis-stubs the shifted path, clobbering the moved element with stale server HTML.
  // ! Returns a `syncId` the drag code stamps onto the outgoing `move` / `drag-dropped` so
  // ! CS can echo it on the resulting `page-state` and the host can match request-to-response.
  onAfterLocalMove?: () => number | undefined;
};

//
// * Constants
//

const DRAG_THRESHOLD = 5;

//
// * Types
//

type PendingDrag = {
  path: ComponentPath;
  startX: number;
  startY: number;
};

type ActiveDrag = {
  path: ComponentPath;
  itemType: ComponentType;
  itemLabel: string;
  sourceElement: HTMLElement;
  sourceDisplay: string;
  // ! Pinned at drag-start. `getRecord(parentPath)?.element` can churn mid-drag
  // ! if the registry is rebuilt (e.g., a reconcile that slips past the drag guard);
  // ! keeping the original ref guarantees `relocateInDom` removes the source from
  // ! the DOM tree it actually lives in.
  sourceRegionElement: HTMLElement;
  placeholderAnchor: HTMLElement | undefined;
};

//
// * Init
//

export function initComponentDrag(channel: Channel, options?: ComponentDragOptions): () => void {
  let pending: PendingDrag | undefined;
  let active: ActiveDrag | undefined;

  // ? Walks from a tracked component up to the outermost wrapper that still contains ONLY this
  // ? one tracked descendant, stopping at the region boundary. Real server HTML frequently wraps
  // ? components in layout divs (`<div class="row"><article data-portal-component-type="part"/></div>`);
  // ? moving the bare `<article>` out of its wrapper breaks the grid/flex layout invariant the
  // ? server renders with. The slot-ancestor is the correct move unit.
  function findSlotAncestor(tracked: HTMLElement, regionEl: HTMLElement): HTMLElement {
    let slot: HTMLElement = tracked;
    while (true) {
      const parent = slot.parentElement;
      if (parent == null || parent === regionEl) return slot;
      const descendants = collectTrackedDescendants(parent, isComponentElement);
      if (descendants.length !== 1 || descendants[0] !== tracked) return slot;
      slot = parent;
    }
  }

  function relocateInDom(
    sourceElement: HTMLElement,
    sourceRegionEl: HTMLElement,
    targetRegionEl: HTMLElement,
    targetIndex: number,
  ): boolean {
    const sourceSlot = findSlotAncestor(sourceElement, sourceRegionEl);

    // ? Component siblings are resolved fresh: the source element is about to be spliced out
    // ? and re-inserted, so an index captured before removal is only valid against the live list.
    const siblings = collectTrackedDescendants(targetRegionEl, isComponentElement);
    const filtered = siblings.filter(el => el !== sourceElement);
    const anchorComponent = targetIndex < filtered.length ? filtered[targetIndex] : undefined;

    if (anchorComponent != null) {
      const anchorSlot = findSlotAncestor(anchorComponent, targetRegionEl);
      targetRegionEl.insertBefore(sourceSlot, anchorSlot);
    } else {
      targetRegionEl.appendChild(sourceSlot);
    }
    return true;
  }

  function beginDrag(p: ComponentPath, x: number, y: number): void {
    if (isDragging()) return;
    const record = getRecord(p);
    if (record?.element == null || record.parentPath == null) return;

    const regionRecord = getRecord(record.parentPath);
    if (regionRecord?.element == null) return;

    const label = record.descriptor ?? translate(`field.${record.type}`);

    active = {
      path: p,
      itemType: record.type,
      itemLabel: label,
      sourceElement: record.element,
      sourceDisplay: record.element.style.display,
      sourceRegionElement: regionRecord.element,
      placeholderAnchor: undefined,
    };
    pending = undefined;

    record.element.style.display = 'none';

    setHoveredPath(undefined);
    setSelectedPath(undefined);
    closeContextMenu();
    setElementIndexFrozen(true);

    setDragState({
      itemType: record.type,
      itemLabel: label,
      sourcePath: p,
      targetRegion: undefined,
      targetIndex: undefined,
      dropAllowed: false,
      message: undefined,
      placeholderElement: undefined,
      placeholderVariant: undefined,
      x,
      y,
    });

    syncDragEmptyRegions(p);
    setDragCursor(true);
    channel.send({type: 'drag-started', path: p});
    updateDropTarget(x, y);
  }

  function updateDropTarget(x: number, y: number): void {
    if (active == null) return;

    const target = inferDropTarget(x, y, active.path);

    if (target != null) {
      const validation = validateDrop(active.path, target.regionPath, active.itemType);
      const regionRecord = getRecord(target.regionPath);

      if (regionRecord?.element != null && validation.allowed) {
        active.placeholderAnchor = ensurePlaceholderAnchor(
          active.placeholderAnchor,
          regionRecord.element,
          target.index,
          active.path,
          target.axis,
        );
      } else {
        clearPlaceholder(active.placeholderAnchor);
        active.placeholderAnchor = undefined;
      }

      updateDragState({
        targetRegion: target.regionPath,
        targetIndex: target.index,
        dropAllowed: validation.allowed,
        message: validation.message,
        placeholderElement: validation.allowed ? active.placeholderAnchor : regionRecord?.element,
        placeholderVariant: validation.allowed ? 'slot' : 'region',
        x,
        y,
      });
    } else {
      clearPlaceholder(active.placeholderAnchor);
      active.placeholderAnchor = undefined;
      updateDragState({
        targetRegion: undefined,
        targetIndex: undefined,
        dropAllowed: false,
        message: undefined,
        placeholderElement: undefined,
        placeholderVariant: undefined,
        x,
        y,
      });
    }
  }

  // ! Always fire `drag-stopped` (on both success and cancel) — the legacy editor did this
  // ! and CS relies on it to unwind per-drag compensation state. Firing only on cancel forces
  // ! CS to mirror the semantics inside its `drag-dropped` handler (see
  // ! `docs/architectural-regressions.md#I9`). The outgoing order on success is
  // ! `move` → `drag-dropped` → `drag-stopped`; consumers deduplicate by session state.
  function endDrag(): void {
    if (active == null) return;

    setDragCursor(false);
    const dragPath = active.path;
    active.sourceElement.style.display = active.sourceDisplay;
    clearPlaceholder(active.placeholderAnchor);
    active = undefined;

    syncDragEmptyRegions(undefined);
    setDragState(undefined);
    setElementIndexFrozen(false);
    channel.send({type: 'drag-stopped', path: dragPath});
    markDirty();
  }

  //
  // * Event handlers
  //

  const handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    if (isOverlayChromeEvent(event)) return;
    if (isDragging()) return;

    const target = getTrackedTarget(event.target);
    if (target == null) return;

    const p = getPathForElement(target);
    if (p == null) return;

    const record = getRecord(p);
    if (record == null || record.type === 'page' || record.type === 'region') return;

    pending = {path: p, startX: event.clientX, startY: event.clientY};
  };

  const handleMouseMove = (event: MouseEvent): void => {
    if (active != null) {
      updateDropTarget(event.clientX, event.clientY);
      return;
    }

    if (pending == null) return;

    const dx = event.clientX - pending.startX;
    const dy = event.clientY - pending.startY;
    if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;

    beginDrag(pending.path, event.clientX, event.clientY);
  };

  const handleMouseUp = (event: MouseEvent): void => {
    if (pending != null) {
      pending = undefined;
    }

    if (active == null) return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const dragState = active;
    const target = inferDropTarget(event.clientX, event.clientY, active.path);

    if (target != null) {
      const validation = validateDrop(active.path, target.regionPath, active.itemType);
      if (validation.allowed) {
        const to = insertAt(target.regionPath, target.index);
        const targetRegionRecord = getRecord(target.regionPath);
        const targetRegionEl = targetRegionRecord?.element;
        // ! Move the DOM element locally BEFORE notifying CS. The v2 protocol treats
        // ! page-state as the source of truth, but reconcile cannot relocate existing
        // ! elements — it only stubs new paths and fires `load(existing=true)` on type
        // ! changes, which fetches pre-move server HTML. Moving the DOM here means the
        // ! subsequent CS page-state round-trip describes exactly what is already in DOM.
        const moved =
          targetRegionEl != null &&
          relocateInDom(dragState.sourceElement, dragState.sourceRegionElement, targetRegionEl, target.index);
        const syncId = moved ? options?.onAfterLocalMove?.() : undefined;
        channel.send({type: 'move', from: dragState.path, to, syncId});
        channel.send({type: 'drag-dropped', from: dragState.path, to, syncId});
      }
    }

    endDrag();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && active != null) {
      event.preventDefault();
      endDrag();
    }
  };

  const handleWindowBlur = (): void => {
    if (pending != null) pending = undefined;
    if (active != null) endDrag();
  };

  //
  // * Lifecycle
  //

  document.addEventListener('mousedown', handleMouseDown, {capture: true});
  document.addEventListener('mousemove', handleMouseMove, {capture: true});
  document.addEventListener('mouseup', handleMouseUp, {capture: true});
  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('blur', handleWindowBlur);

  return () => {
    document.removeEventListener('mousedown', handleMouseDown, {capture: true});
    document.removeEventListener('mousemove', handleMouseMove, {capture: true});
    document.removeEventListener('mouseup', handleMouseUp, {capture: true});
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('blur', handleWindowBlur);

    if (active != null) endDrag();
    pending = undefined;
  };
}
