import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

import {useStoreValue} from '../../hooks/use-store-value';
import {useTrackedRect} from '../../hooks/use-tracked-rect';
import {$dragState} from '../../stores/registry';

const DRAG_TARGET_HIGHLIGHTER_NAME = 'DragTargetHighlighter';

export const DragTargetHighlighter = (): JSX.Element | null => {
    const dragState = useStoreValue($dragState);
    const rect = useTrackedRect(dragState?.targetPath);

    if (dragState?.targetPath == null || rect == null) return null;

    return (
        <div
            data-component={DRAG_TARGET_HIGHLIGHTER_NAME}
            className={cn(
                'pointer-events-none fixed border-2 transition-[top,left,width,height] duration-50',
                dragState.dropAllowed ? 'border-bdr-select' : 'border-error',
            )}
            style={{
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            }}
        />
    );
};

DragTargetHighlighter.displayName = DRAG_TARGET_HIGHLIGHTER_NAME;
