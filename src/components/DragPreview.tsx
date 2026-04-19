import {FilledCircleCheck, FilledCircleX} from '@enonic/ui';

import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {$dragState} from '../state';

const DRAG_PREVIEW_NAME = 'DragPreview';

export const DragPreview = (): JSX.Element | null => {
  const dragState = useStoreValue($dragState);

  if (dragState == null || dragState.x == null || dragState.y == null) return null;

  const isAllowed = dragState.dropAllowed;

  return (
    <div
      data-component={DRAG_PREVIEW_NAME}
      className='pointer-events-none fixed flex gap-4'
      style={{
        top: `${String(dragState.y - 28)}px`,
        left: `${String(dragState.x - 24)}px`,
      }}
    >
      <span className='relative mt-2.5 size-7 shrink-0'>
        <span className='absolute inset-[2.33px] rounded-full bg-surface-neutral' />
        {isAllowed ? (
          <FilledCircleCheck className='relative size-7 text-success' />
        ) : (
          <FilledCircleX className='relative size-7 text-error' />
        )}
      </span>
      <div className='rounded-lg border border-bdr-soft bg-surface-neutral px-7.5 py-4 leading-5.5 font-semibold whitespace-nowrap text-main shadow'>
        {dragState.itemLabel}
      </div>
    </div>
  );
};

DragPreview.displayName = DRAG_PREVIEW_NAME;
