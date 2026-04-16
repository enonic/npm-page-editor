import type {Channel} from '../transport';

import {
  closeContextMenu,
  getPathForElement,
  getSelectedPath,
  isDragging,
  isPostDragCooldown,
  openContextMenu,
  setSelectedPath,
} from '../state';
import {getTrackedTarget, isOverlayChromeEvent, suppressNativeEvent} from './guards';

export function initSelectionDetection(channel: Channel): () => void {
  const handleClick = (event: MouseEvent): void => {
    if (isDragging() || isPostDragCooldown()) return;
    if (isOverlayChromeEvent(event)) return;

    const target = getTrackedTarget(event.target);
    const path = target != null ? getPathForElement(target) : undefined;
    const current = getSelectedPath();

    if (target != null && path != null) {
      suppressNativeEvent(event);
      closeContextMenu();

      if (current === path) {
        setSelectedPath(undefined);
        channel.send({type: 'deselect', path});
        return;
      }

      setSelectedPath(path);
      channel.send({type: 'select', path, position: {x: event.pageX, y: event.pageY}});
      return;
    }

    if (current != null) {
      closeContextMenu();
      setSelectedPath(undefined);
      channel.send({type: 'deselect', path: current});
    }
  };

  const handleContextMenu = (event: MouseEvent): void => {
    if (isDragging() || isPostDragCooldown()) return;
    if (isOverlayChromeEvent(event)) return;

    const target = getTrackedTarget(event.target);
    const path = target != null ? getPathForElement(target) : undefined;
    if (target == null || path == null) return;

    suppressNativeEvent(event);
    setSelectedPath(path);
    openContextMenu({kind: 'component', path, x: event.pageX, y: event.pageY});
    channel.send({type: 'select', path, position: {x: event.pageX, y: event.pageY}, rightClicked: true});
  };

  document.addEventListener('click', handleClick, {capture: true});
  document.addEventListener('contextmenu', handleContextMenu, {capture: true});

  return () => {
    document.removeEventListener('click', handleClick, {capture: true});
    document.removeEventListener('contextmenu', handleContextMenu, {capture: true});
  };
}
