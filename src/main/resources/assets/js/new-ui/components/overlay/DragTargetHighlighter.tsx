import type {JSX} from 'preact';
import {useStoreValue} from '../../hooks/use-store-value';
import {useTrackedRect} from '../../hooks/use-tracked-rect';
import {$dragState} from '../../stores/registry';

export function DragTargetHighlighter(): JSX.Element | null {
    const dragState = useStoreValue($dragState);
    const rect = useTrackedRect(dragState?.targetPath);

    if (!dragState?.targetPath || !rect) {
        return null;
    }

    const tone = dragState.dropAllowed
        ? 'border-info/80 bg-info/8'
        : 'border-error/80 bg-error/8';

    return (
        <div
            className={`pointer-events-none fixed rounded-[12px] border-2 border-dashed transition-all duration-75 ${tone}`}
            style={{
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            }}
        />
    );
}
