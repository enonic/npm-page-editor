import {useCallback, useMemo, useState} from 'react';

import type {PageController} from '../protocol';

import {$modifyAllowed, $pageControllers} from '../state';
import {getChannel} from '../transport';
import {useStoreValue} from './use-store';

type UsePageDescriptorSelectorReturn = {
  filteredControllers: readonly PageController[];
  selectedController: PageController | undefined;
  searchValue: string | undefined;
  setSearchValue: (value: string | undefined) => void;
  selection: readonly string[];
  handleSelectionChange: (selection: readonly string[]) => void;
  disabled: boolean;
  isEmpty: boolean;
};

export function usePageDescriptorSelector(): UsePageDescriptorSelectorReturn {
  const controllers = useStoreValue($pageControllers);
  const modifyAllowed = useStoreValue($modifyAllowed);

  const [searchValue, setSearchValue] = useState<string | undefined>();
  const [selectedKey, setSelectedKey] = useState('');

  const filteredControllers = useMemo(() => {
    if (!searchValue) return controllers;
    const lower = searchValue.toLowerCase();
    return controllers.filter(
      c => c.displayName.toLowerCase().includes(lower) || c.descriptorKey.toLowerCase().includes(lower),
    );
  }, [searchValue, controllers]);

  const selectedController = useMemo(
    () => controllers.find(c => c.descriptorKey === selectedKey),
    [controllers, selectedKey],
  );

  const handleSelectionChange = useCallback(
    (selection: readonly string[]): void => {
      if (selection.length === 0) return;

      const newKey = selection[0];
      if (newKey === selectedKey) return;

      setSearchValue(undefined);
      setSelectedKey(newKey);
      getChannel().send({type: 'select-page-descriptor', descriptorKey: newKey});
    },
    [selectedKey],
  );

  const isEmpty = controllers.length === 0;
  const disabled = !modifyAllowed || isEmpty;
  const selection = selectedKey ? [selectedKey] : [];

  return {
    filteredControllers,
    selectedController,
    searchValue,
    setSearchValue,
    selection,
    handleSelectionChange,
    disabled,
    isEmpty,
  };
}
