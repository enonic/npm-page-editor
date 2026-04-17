import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {root} from '../protocol';
import {$registry} from '../state';
import {PageDescriptorSelector} from './PageDescriptorSelector';

const PAGE_PLACEHOLDER_OVERLAY_NAME = 'PagePlaceholderOverlay';

export const PagePlaceholderOverlay = (): JSX.Element | null => {
  const registry = useStoreValue($registry);
  const rootRecord = registry[root()];

  const isVisible = rootRecord?.type === 'page' && rootRecord.empty;

  if (!isVisible) return null;

  return (
    <div
      data-component={PAGE_PLACEHOLDER_OVERLAY_NAME}
      className='pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-surface-neutral p-6'
    >
      <PageDescriptorSelector className='w-full max-w-sm' />
    </div>
  );
};

PagePlaceholderOverlay.displayName = PAGE_PLACEHOLDER_OVERLAY_NAME;
