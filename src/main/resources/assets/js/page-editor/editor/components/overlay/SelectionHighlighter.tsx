import type {JSX} from 'preact';
import {useStoreValue} from '../../hooks/use-store-value';
import {useTrackedRect} from '../../hooks/use-tracked-rect';
import {$dragState, $selectedPath, $textEditing} from '../../stores/registry';

const SELECTION_HIGHLIGHTER_NAME = 'SelectionHighlighter';

export const SelectionHighlighter = (): JSX.Element | null => {
    const selectedPath = useStoreValue($selectedPath);
    const dragState = useStoreValue($dragState);
    const textEditing = useStoreValue($textEditing);
    const rect = useTrackedRect(selectedPath);

    if (textEditing || dragState || !selectedPath || !rect) return null;

    const {top, left, width, height} = rect;

    return (
        <svg
            data-component={SELECTION_HIGHLIGHTER_NAME}
            className='pointer-events-none fixed inset-0 h-full w-full overflow-visible'
        >
            <line x1={left} y1='0' x2={left} y2='100%' strokeDasharray='4 4' className='stroke-bdr-select/30 stroke-1' />
            <line x1={left + width} y1='0' x2={left + width} y2='100%' strokeDasharray='4 4' className='stroke-bdr-select/30 stroke-1' />
            <line x1='0' y1={top} x2='100%' y2={top} strokeDasharray='4 4' className='stroke-bdr-select/30 stroke-1' />
            <line x1='0' y1={top + height} x2='100%' y2={top + height} strokeDasharray='4 4' className='stroke-bdr-select/30 stroke-1' />
            <rect
                x={left}
                y={top}
                width={width}
                height={height}
                className='fill-bdr-select/8 stroke-bdr-select stroke-1'
            />
        </svg>
    );
};

SelectionHighlighter.displayName = SELECTION_HIGHLIGHTER_NAME;
