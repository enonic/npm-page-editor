import type {ComponentType, IncomingMessage} from '../protocol';
import type {Channel} from '../transport';

import {markDirty} from '../geometry';
import {translate} from '../i18n';
import {insertAt} from '../protocol/path';
import {setDragCursor} from '../rendering/drag-cursor';
import {
  closeContextMenu,
  getRecord,
  isDragging,
  setDragState,
  setElementIndexFrozen,
  setHoveredPath,
  updateDragState,
} from '../state';
import {clearPlaceholder, ensurePlaceholderAnchor, inferDropTarget, validateDrop} from './drop-target';

//
// * Types
//

type ContextDragSession = {
  itemType: ComponentType;
  itemLabel: string;
  visible: boolean;
  placeholderAnchor: HTMLElement | undefined;
};

const VALID_COMPONENT_TYPES: readonly ComponentType[] = ['page', 'region', 'text', 'part', 'layout', 'fragment'];

function isComponentType(raw: string): raw is ComponentType {
  return (VALID_COMPONENT_TYPES as readonly string[]).includes(raw);
}

//
// * Init
//

export function initContextWindowDrag(channel: Channel): () => void {
  let session: ContextDragSession | undefined;

  // ! Always fire `drag-stopped` — see `component-drag.ts:endDrag` for the full rationale.
  // ! On success, emit order is `add` → `drag-dropped` → `drag-stopped`; on cancel it fires alone.
  function destroySession(): void {
    if (session == null) return;

    setDragCursor(false);
    clearPlaceholder(session.placeholderAnchor);
    session = undefined;

    setDragState(undefined);
    setElementIndexFrozen(false);
    channel.send({type: 'drag-stopped'});
    markDirty();
  }

  function handleMessage(message: IncomingMessage): void {
    switch (message.type) {
      case 'create-draggable': {
        if (session != null) destroySession();
        if (isDragging()) return;

        if (!isComponentType(message.componentType)) return;
        const itemType = message.componentType;

        const itemLabel = translate(`field.${itemType}`);

        session = {
          itemType,
          itemLabel,
          visible: false,
          placeholderAnchor: undefined,
        };

        setHoveredPath(undefined);
        setElementIndexFrozen(true);

        // ! Set drag state BEFORE closing the context menu so `ContextMenu` gets a
        // ! render pass with `open=false` (Radix dismiss lifecycle — pointer-capture
        // ! release, focus return, portal teardown) before the subsequent
        // ! `closeContextMenu` unmounts it. Clearing state first unmounts the
        // ! component while Radix still thinks it is open, leaving a stuck overlay
        // ! on the next render cycle. See `docs/architectural-regressions.md#H3`.
        setDragState({
          itemType,
          itemLabel,
          sourcePath: undefined,
          targetRegion: undefined,
          targetIndex: undefined,
          dropAllowed: false,
          message: undefined,
          placeholderElement: undefined,
          placeholderVariant: undefined,
          x: undefined,
          y: undefined,
        });
        closeContextMenu();

        setDragCursor(true);
        channel.send({type: 'drag-started'});
        break;
      }

      case 'destroy-draggable':
        destroySession();
        break;

      case 'set-draggable-visible':
        if (session == null) break;
        session.visible = message.visible;
        if (!message.visible) {
          clearPlaceholder(session.placeholderAnchor);
          session.placeholderAnchor = undefined;
          updateDragState({
            targetRegion: undefined,
            targetIndex: undefined,
            dropAllowed: false,
            message: undefined,
            placeholderElement: undefined,
            placeholderVariant: undefined,
            x: undefined,
            y: undefined,
          });
        }
        break;

      default:
        break;
    }
  }

  //
  // * Event handlers
  //

  const handleMouseMove = (event: MouseEvent): void => {
    if (session == null || !session.visible) return;

    const x = event.clientX;
    const y = event.clientY;
    const target = inferDropTarget(x, y);

    if (target != null) {
      const validation = validateDrop(undefined, target.regionPath, session.itemType);
      const regionRecord = getRecord(target.regionPath);

      if (regionRecord?.element != null && validation.allowed) {
        session.placeholderAnchor = ensurePlaceholderAnchor(
          session.placeholderAnchor,
          regionRecord.element,
          target.index,
          undefined,
          target.axis,
        );
      } else {
        clearPlaceholder(session.placeholderAnchor);
        session.placeholderAnchor = undefined;
      }

      updateDragState({
        targetRegion: target.regionPath,
        targetIndex: target.index,
        dropAllowed: validation.allowed,
        message: validation.message,
        placeholderElement: validation.allowed ? session.placeholderAnchor : regionRecord?.element,
        placeholderVariant: validation.allowed ? 'slot' : 'region',
        x,
        y,
      });
    } else {
      clearPlaceholder(session.placeholderAnchor);
      session.placeholderAnchor = undefined;
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
  };

  const handleMouseUp = (event: MouseEvent): void => {
    if (session == null || !session.visible) return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const target = inferDropTarget(event.clientX, event.clientY);

    if (target != null) {
      const validation = validateDrop(undefined, target.regionPath, session.itemType);
      if (validation.allowed) {
        const to = insertAt(target.regionPath, target.index);
        channel.send({type: 'add', path: to, componentType: session.itemType});
        channel.send({type: 'drag-dropped', to});
      }
    }

    destroySession();
  };

  //
  // * Lifecycle
  //

  const unsubscribe = channel.subscribe(handleMessage);
  document.addEventListener('mousemove', handleMouseMove, {capture: true});
  document.addEventListener('mouseup', handleMouseUp, {capture: true});

  return () => {
    unsubscribe();
    document.removeEventListener('mousemove', handleMouseMove, {capture: true});
    document.removeEventListener('mouseup', handleMouseUp, {capture: true});
    if (session != null) destroySession();
  };
}
