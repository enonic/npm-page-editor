import type {ComponentPath, ComponentType} from '../protocol';
import type {Channel} from '../transport';

import {markDirty} from '../geometry';
import {translate} from '../i18n';
import {insertAt} from '../protocol/path';
import {syncDragEmptyRegions} from '../reconcile';
import {
  closeContextMenu,
  getPathForElement,
  getRecord,
  isDragging,
  setDragState,
  setHoveredPath,
  setSelectedPath,
  updateDragState,
} from '../state';
import {clearPlaceholder, ensurePlaceholderAnchor, inferDropTarget, validateDrop} from './drop-target';
import {getTrackedTarget, isOverlayChromeEvent} from './guards';

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
  placeholderAnchor: HTMLElement | undefined;
};

//
// * Init
//

export function initComponentDrag(channel: Channel): () => void {
  let pending: PendingDrag | undefined;
  let active: ActiveDrag | undefined;

  function beginDrag(p: ComponentPath, x: number, y: number): void {
    if (isDragging()) return;
    const record = getRecord(p);
    if (record?.element == null || record.parentPath == null) return;

    const label = record.descriptor ?? translate(`field.${record.type}`);

    active = {
      path: p,
      itemType: record.type,
      itemLabel: label,
      sourceElement: record.element,
      sourceDisplay: record.element.style.display,
      placeholderAnchor: undefined,
    };
    pending = undefined;

    record.element.style.display = 'none';

    setHoveredPath(undefined);
    setSelectedPath(undefined);
    closeContextMenu();

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

  function endDrag(canceled: boolean): void {
    if (active == null) return;

    const dragPath = active.path;
    active.sourceElement.style.display = active.sourceDisplay;
    clearPlaceholder(active.placeholderAnchor);
    active = undefined;

    syncDragEmptyRegions(undefined);
    setDragState(undefined);
    if (canceled) channel.send({type: 'drag-stopped', path: dragPath});
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
    let dropped = false;

    if (target != null) {
      const validation = validateDrop(active.path, target.regionPath, active.itemType);
      if (validation.allowed) {
        const to = insertAt(target.regionPath, target.index);
        channel.send({type: 'move', from: dragState.path, to});
        channel.send({type: 'drag-dropped', from: dragState.path, to});
        dropped = true;
      }
    }

    endDrag(!dropped);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && active != null) {
      event.preventDefault();
      endDrag(true);
    }
  };

  const handleWindowBlur = (): void => {
    if (pending != null) pending = undefined;
    if (active != null) endDrag(true);
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

    if (active != null) endDrag(true);
    pending = undefined;
  };
}
