import type {JSX} from 'preact';
import {useStoreValue} from '../../hooks/use-store-value';
import {useTrackedRect} from '../../hooks/use-tracked-rect';
import {$hoveredPath} from '../../stores/registry';

export function Highlighter(): JSX.Element | null {
    const hoveredPath = useStoreValue($hoveredPath);
    const rect = useTrackedRect(hoveredPath);

    if (!hoveredPath || !rect) {
        return null;
    }

    return (
        <div
            className='pointer-events-none fixed rounded-[4px] border-2 border-black/75 transition-all duration-75'
            style={{
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            }}
        />
    );
}
