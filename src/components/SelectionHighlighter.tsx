import {useEffect} from 'react';

import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {useTrackedRect} from '../hooks/use-tracked-rect';
import {$dragState, $selectedPath, $silentSelection, getRecord} from '../state';

const SELECTION_HIGHLIGHTER_NAME = 'SelectionHighlighter';

export const SelectionHighlighter = (): JSX.Element | null => {
  const selectedPath = useStoreValue($selectedPath);
  const dragState = useStoreValue($dragState);
  const rect = useTrackedRect(selectedPath);

  useEffect(() => {
    if (selectedPath == null) return;
    if ($silentSelection.get()) return;

    const element = getRecord(selectedPath)?.element;
    element?.scrollIntoView({block: 'nearest'});
  }, [selectedPath]);

  if (dragState != null || selectedPath == null || rect == null) return null;

  const {top, left, width, height} = rect;

  return (
    <svg
      data-component={SELECTION_HIGHLIGHTER_NAME}
      className='pointer-events-none fixed inset-0 h-full w-full overflow-visible'
    >
      <line x1={left} y1='0' x2={left} y2='100%' strokeDasharray='4 4' className='stroke-bdr-select/30 stroke-1' />
      <line
        x1={left + width}
        y1='0'
        x2={left + width}
        y2='100%'
        strokeDasharray='4 4'
        className='stroke-bdr-select/30 stroke-1'
      />
      <line x1='0' y1={top} x2='100%' y2={top} strokeDasharray='4 4' className='stroke-bdr-select/30 stroke-1' />
      <line
        x1='0'
        y1={top + height}
        x2='100%'
        y2={top + height}
        strokeDasharray='4 4'
        className='stroke-bdr-select/30 stroke-1'
      />
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        className='fill-bdr-select/8 stroke-bdr-select stroke-1 transition-[x,y,width,height] duration-[50ms]'
      />
    </svg>
  );
};

SelectionHighlighter.displayName = SELECTION_HIGHLIGHTER_NAME;
