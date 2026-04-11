import type {JSX} from 'preact';
import {useStoreValue} from '../../hooks/use-store-value';
import {useTrackedRect} from '../../hooks/use-tracked-rect';
import {$selectedPath} from '../../stores/registry';

export function SelectionHighlighter(): JSX.Element | null {
    const selectedPath = useStoreValue($selectedPath);
    const rect = useTrackedRect(selectedPath);

    if (!selectedPath || !rect) {
        return null;
    }

    const top = rect.top;
    const left = rect.left;
    const width = rect.width;
    const height = rect.height;

    return (
        <svg className='pointer-events-none fixed inset-0 h-full w-full overflow-visible'>
            <line x1={left} y1='0' x2={left} y2='100%' className='stroke-info/65 stroke-[1]' />
            <line x1={left + width} y1='0' x2={left + width} y2='100%' className='stroke-info/65 stroke-[1]' />
            <line x1='0' y1={top} x2='100%' y2={top} className='stroke-info/65 stroke-[1]' />
            <line x1='0' y1={top + height} x2='100%' y2={top + height} className='stroke-info/65 stroke-[1]' />
            <rect
                x={left}
                y={top}
                width={width}
                height={height}
                rx='3'
                className='fill-info/8 stroke-info stroke-[2]'
            />
        </svg>
    );
}
