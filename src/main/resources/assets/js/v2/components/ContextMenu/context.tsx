import {createContext} from 'preact';
import {useContext} from 'preact/hooks';

import type {ActionId} from '../../actions';

type DispatchFn = (actionId: ActionId) => void;

const MenuActionContext = createContext<DispatchFn | undefined>(undefined);

export const MenuActionProvider = MenuActionContext.Provider;

export function useMenuAction(): DispatchFn {
  const dispatch = useContext(MenuActionContext);
  if (dispatch == null) throw new Error('useMenuAction must be used within MenuActionProvider');
  return dispatch;
}
