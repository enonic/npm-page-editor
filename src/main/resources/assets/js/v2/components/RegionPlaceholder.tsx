import type {ComponentPath} from '../protocol';
import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {$dragState} from '../state';

export type RegionPlaceholderProps = {
  path: ComponentPath;
  regionName: string;
};

const REGION_PLACEHOLDER_NAME = 'RegionPlaceholder';

export const RegionPlaceholder = ({path}: RegionPlaceholderProps): JSX.Element | null => {
  const dragState = useStoreValue($dragState);

  if (dragState?.targetRegion === path) return null;

  return (
    <div data-component={REGION_PLACEHOLDER_NAME} className='pe-shell overflow-hidden bg-surface-neutral'>
      <div className='h-full p-2.5'>
        <div className='pe-dash flex min-h-25 items-center justify-center px-4 py-2.5'>
          <p className='text-center text-subtle italic'>Drop components here...</p>
        </div>
      </div>
    </div>
  );
};

RegionPlaceholder.displayName = REGION_PLACEHOLDER_NAME;
