import type {JSX} from 'preact';
import {useStoreValue} from '../../hooks/use-store-value';
import {useTrackedRect} from '../../hooks/use-tracked-rect';
import {$dragState, $hoveredPath} from '../../stores/registry';

const HIGHLIGHTER_NAME = 'Highlighter';

export const Highlighter = (): JSX.Element | null => {
    const hoveredPath = useStoreValue($hoveredPath);
    const dragState = useStoreValue($dragState);
    const rect = useTrackedRect(hoveredPath);

    if (dragState || !hoveredPath || !rect) return null;

    return (
        <div
            data-component={HIGHLIGHTER_NAME}
            className='pointer-events-none fixed border-2 border-bdr-select transition-[top,left,width,height] duration-50'
            style={{
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            }}
        />
    );
};

Highlighter.displayName = HIGHLIGHTER_NAME;
