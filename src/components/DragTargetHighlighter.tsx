import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {$dragState} from '../state';
import {DragPlaceholder} from './DragPlaceholder';

const DRAG_TARGET_HIGHLIGHTER_NAME = 'DragTargetHighlighter';

export const DragTargetHighlighter = (): JSX.Element | null => {
  const dragState = useStoreValue($dragState);
  const el = dragState?.placeholderElement;
  // ? Read on every render rather than caching via ResizeObserver. The anchor
  // ? can move without changing size (flex sibling reorder on insertBefore),
  // ? and no resize/scroll event fires. The component re-renders on every
  // ? mousemove via $dragState anyway, so `getBoundingClientRect()` stays
  // ? fresh and cheap enough.
  const rect = el?.getBoundingClientRect();

  if (dragState == null || el == null || rect == null) return null;

  return (
    <div
      data-component={DRAG_TARGET_HIGHLIGHTER_NAME}
      className='pointer-events-none fixed'
      style={{
        top: `${String(rect.top)}px`,
        left: `${String(rect.left)}px`,
        width: `${String(rect.width)}px`,
        height: `${String(rect.height)}px`,
      }}
    >
      <DragPlaceholder
        itemLabel={dragState.itemLabel}
        dropAllowed={dragState.dropAllowed}
        message={dragState.message}
        variant={dragState.placeholderVariant ?? 'slot'}
        className='h-full'
      />
    </div>
  );
};

DragTargetHighlighter.displayName = DRAG_TARGET_HIGHLIGHTER_NAME;
