import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {useTrackedRect} from '../hooks/use-tracked-rect';
import {$dragState} from '../state';

const DRAG_TARGET_HIGHLIGHTER_NAME = 'DragTargetHighlighter';

export const DragTargetHighlighter = (): JSX.Element | null => {
  const dragState = useStoreValue($dragState);
  const rect = useTrackedRect(dragState?.targetRegion);

  if (dragState?.targetRegion == null || rect == null) return null;

  return (
    <div
      data-component={DRAG_TARGET_HIGHLIGHTER_NAME}
      className='pointer-events-none fixed border-2 border-dashed border-info-rev transition-all duration-75'
      style={{
        top: `${String(rect.top)}px`,
        left: `${String(rect.left)}px`,
        width: `${String(rect.width)}px`,
        height: `${String(rect.height)}px`,
      }}
    />
  );
};

DragTargetHighlighter.displayName = DRAG_TARGET_HIGHLIGHTER_NAME;
