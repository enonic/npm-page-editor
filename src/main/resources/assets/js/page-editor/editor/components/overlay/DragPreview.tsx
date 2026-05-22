import {FilledCircleCheck, FilledCircleX} from '@enonic/ui';

import type {JSX} from 'preact';

import {useStoreValue} from '../../hooks/use-store-value';
import {$dragState} from '../../stores/registry';
import {ComponentPlaceholder} from '../placeholders/ComponentPlaceholder';
import type {ComponentRecordType} from '../../types';

const DRAG_PREVIEW_NAME = 'DragPreview';

export const DragPreview = (): JSX.Element | null => {
  const dragState = useStoreValue($dragState);

  if (dragState == null || dragState.x == null || dragState.y == null) return null;

  const isAllowed = dragState.dropAllowed;

  return (
    <div
      data-component={DRAG_PREVIEW_NAME}
      className='pointer-events-none fixed'
      style={{
        top: `${String(dragState.y)}px`,
        left: `${String(dragState.x)}px`,
      }}
    >
      <ComponentPlaceholder
        type={dragState.itemType as ComponentRecordType}
        error={false}
        bare
        className='absolute w-70 -translate-x-1/2 -translate-y-1/2 rounded-xs border border-bdr-soft shadow-lg'
      />
      <span className='absolute -top-4.5 -left-6 size-7 shrink-0 drop-shadow-[0_0_2px_var(--color-surface-neutral)]'>
        <span className='absolute inset-[2.33px] rounded-full bg-surface-neutral' />
        {isAllowed ? (
          <FilledCircleCheck className='relative size-7 text-success' />
        ) : (
          <FilledCircleX className='relative size-7 text-error' />
        )}
      </span>
    </div>
  );
};

DragPreview.displayName = DRAG_PREVIEW_NAME;
