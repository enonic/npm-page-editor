import {ContextMenu as UiContextMenu, useContextMenu} from '@enonic/ui';
import {useLayoutEffect} from 'preact/hooks';

import type {JSX} from 'preact';

import {useStoreValue} from '../../hooks/use-store';
import {$contextMenu, $dragState, closeContextMenu} from '../../state';
import {ContextMenuItems} from './ContextMenuItems';

const CONTEXT_MENU_NAME = 'ContextMenu';

//
// * Position sync
//

type PositionSetterProps = {
  x: number;
  y: number;
};

const PositionSetter = ({x, y}: PositionSetterProps): null => {
  const {setPosition} = useContextMenu();

  useLayoutEffect(() => {
    setPosition({x, y});
  }, [setPosition, x, y]);

  return null;
};

//
// * Component
//

export type ContextMenuProps = {
  portalContainer?: HTMLElement;
};

export const ContextMenu = ({portalContainer}: ContextMenuProps): JSX.Element | null => {
  const state = useStoreValue($contextMenu);
  const dragState = useStoreValue($dragState);

  if (dragState != null || state == null) return null;

  const handleOpenChange = (open: boolean): void => {
    if (!open) closeContextMenu();
  };

  return (
    <UiContextMenu open onOpenChange={handleOpenChange}>
      <PositionSetter x={state.x} y={state.y} />
      <UiContextMenu.Portal container={portalContainer}>
        <UiContextMenu.Content className='pointer-events-auto z-50' data-component={CONTEXT_MENU_NAME}>
          <ContextMenuItems path={state.path} kind={state.kind} />
        </UiContextMenu.Content>
      </UiContextMenu.Portal>
    </UiContextMenu>
  );
};

ContextMenu.displayName = CONTEXT_MENU_NAME;
