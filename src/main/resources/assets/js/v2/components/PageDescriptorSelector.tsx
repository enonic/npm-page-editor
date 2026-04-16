import {Combobox, Listbox, cn} from '@enonic/ui';
import {FileCog} from 'lucide-preact';

import type {JSX} from 'preact';

import {usePageDescriptorSelector} from '../hooks/use-page-descriptor-selector';

export type PageDescriptorSelectorProps = {
  className?: string;
};

const PAGE_DESCRIPTOR_SELECTOR_NAME = 'PageDescriptorSelector';

export const PageDescriptorSelector = ({className}: PageDescriptorSelectorProps): JSX.Element => {
  const {
    filteredControllers,
    selectedController,
    searchValue,
    setSearchValue,
    selection,
    handleSelectionChange,
    disabled,
    isEmpty,
  } = usePageDescriptorSelector();

  const placeholder = isEmpty ? 'No controllers available' : 'Choose a controller';

  return (
    <div data-component={PAGE_DESCRIPTOR_SELECTOR_NAME} className={cn('flex flex-col gap-2.5', className)}>
      <span className='font-semibold'>Page controller</span>
      <Combobox.Root
        value={searchValue}
        onChange={setSearchValue}
        selection={selection}
        onSelectionChange={handleSelectionChange}
        disabled={disabled}
      >
        <Combobox.Content>
          <Combobox.Control>
            <Combobox.Search>
              {selectedController != null && (
                <Combobox.Value className='w-full gap-2'>
                  <FileCog className='size-4 shrink-0' strokeWidth={1.75} />
                  <span className='truncate leading-5.5 font-semibold'>{selectedController.displayName}</span>
                </Combobox.Value>
              )}
              <Combobox.Input placeholder={placeholder} />
              <Combobox.Toggle />
            </Combobox.Search>
          </Combobox.Control>
          <Combobox.Popup>
            <Listbox.Content className='max-h-60 rounded-sm'>
              {filteredControllers.map(controller => (
                <Listbox.Item key={controller.descriptorKey} value={controller.descriptorKey}>
                  <div className='flex flex-col overflow-hidden'>
                    <span className='truncate leading-5.5 font-semibold group-data-[tone=inverse]:text-alt'>
                      {controller.displayName}
                    </span>
                    <small className='truncate text-sm leading-4.5 text-subtle group-data-[tone=inverse]:text-alt'>
                      {controller.descriptorKey}
                    </small>
                  </div>
                </Listbox.Item>
              ))}
            </Listbox.Content>
          </Combobox.Popup>
        </Combobox.Content>
      </Combobox.Root>
    </div>
  );
};

PageDescriptorSelector.displayName = PAGE_DESCRIPTOR_SELECTOR_NAME;
