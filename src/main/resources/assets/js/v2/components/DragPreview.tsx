import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {$dragState} from '../state';

const DRAG_PREVIEW_NAME = 'DragPreview';

export const DragPreview = (): JSX.Element | null => {
  const dragState = useStoreValue($dragState);

  if (dragState == null || dragState.x == null || dragState.y == null) return null;

  const isAllowed = dragState.dropAllowed;
  const modeLabel = dragState.sourcePath != null ? 'Move' : 'Insert';
  const status =
    dragState.message ??
    (dragState.targetRegion != null
      ? isAllowed
        ? 'Release to drop here'
        : 'Cannot drop here'
      : 'Move over a region to drop');

  const tone = isAllowed ? 'border-info/25 bg-surface-primary text-main' : 'border-error/30 bg-error/10 text-main';
  const badgeTone = isAllowed ? 'border-info/20 bg-info/12 text-info' : 'border-error/20 bg-error/12 text-error';

  return (
    <div
      data-component={DRAG_PREVIEW_NAME}
      className={cn('pe-card-shadow pointer-events-none fixed max-w-[280px] rounded-[18px] border px-4 py-3', tone)}
      style={{
        top: `${String(dragState.y + 18)}px`,
        left: `${String(dragState.x + 18)}px`,
      }}
    >
      <div className='flex items-start gap-3'>
        <div
          className={cn(
            'rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase',
            badgeTone,
          )}
        >
          {modeLabel}
        </div>
        <div className='min-w-0'>
          <p className='truncate text-sm font-semibold text-main'>{dragState.itemLabel}</p>
          <p className='mt-1 text-xs text-subtle'>{status}</p>
        </div>
      </div>
    </div>
  );
};

DragPreview.displayName = DRAG_PREVIEW_NAME;
