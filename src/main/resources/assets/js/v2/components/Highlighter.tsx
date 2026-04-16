import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {useTrackedRect} from '../hooks/use-tracked-rect';
import {$dragState, $hoveredPath} from '../state';

const HIGHLIGHTER_NAME = 'Highlighter';

export const Highlighter = (): JSX.Element | null => {
  const hoveredPath = useStoreValue($hoveredPath);
  const dragState = useStoreValue($dragState);
  const rect = useTrackedRect(hoveredPath);

  if (dragState != null || hoveredPath == null || rect == null) return null;

  return (
    <div
      data-component={HIGHLIGHTER_NAME}
      className='pointer-events-none fixed border-2 border-main/80 transition-all duration-75'
      style={{
        top: `${String(rect.top)}px`,
        left: `${String(rect.left)}px`,
        width: `${String(rect.width)}px`,
        height: `${String(rect.height)}px`,
      }}
    />
  );
};

Highlighter.displayName = HIGHLIGHTER_NAME;
