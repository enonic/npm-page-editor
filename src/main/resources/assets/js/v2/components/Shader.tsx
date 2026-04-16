import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {root} from '../protocol';
import {
  $contextMenu,
  $dragState,
  $locked,
  $modifyAllowed,
  $selectedPath,
  closeContextMenu,
  openContextMenu,
  setSelectedPath,
} from '../state';
import {getChannel} from '../transport';

const SHADER_NAME = 'Shader';

export const Shader = (): JSX.Element | null => {
  const locked = useStoreValue($locked);
  const dragState = useStoreValue($dragState);
  const modifyAllowed = useStoreValue($modifyAllowed);
  const selectedPath = useStoreValue($selectedPath);
  const contextMenu = useStoreValue($contextMenu);

  if (dragState != null || !locked) return null;

  const pagePath = root();

  const toggleLockedMenu = (x: number, y: number): void => {
    if (contextMenu?.kind === 'locked-page') {
      closeContextMenu();
      return;
    }

    openContextMenu({kind: 'locked-page', path: pagePath, x, y});
  };

  const handleSelectionFallback = (x: number, y: number, rightClicked: boolean): void => {
    closeContextMenu();
    const channel = getChannel();

    if (selectedPath !== pagePath || rightClicked) {
      setSelectedPath(pagePath);
      channel.send({type: 'select', path: pagePath, position: {x, y}, rightClicked});
      return;
    }

    setSelectedPath(undefined);
    channel.send({type: 'deselect', path: pagePath});
  };

  const handleClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    if (modifyAllowed) {
      toggleLockedMenu(event.pageX, event.pageY);
      return;
    }

    handleSelectionFallback(event.pageX, event.pageY, false);
  };

  const handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    if (modifyAllowed) {
      toggleLockedMenu(event.pageX, event.pageY);
      return;
    }

    handleSelectionFallback(event.pageX, event.pageY, true);
  };

  return (
    <div
      role='presentation'
      data-component={SHADER_NAME}
      className='pointer-events-auto fixed inset-0 bg-black/18'
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  );
};

Shader.displayName = SHADER_NAME;
