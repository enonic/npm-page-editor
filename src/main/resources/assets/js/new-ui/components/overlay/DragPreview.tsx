import type {JSX} from 'preact';
import {useStoreValue} from '../../hooks/use-store-value';
import {$dragState} from '../../stores/registry';

export function DragPreview(): JSX.Element | null {
    const dragState = useStoreValue($dragState);

    if (!dragState || dragState.x == null || dragState.y == null) {
        return null;
    }

    const tone = dragState.dropAllowed
        ? 'border-info/25 bg-surface-primary text-main'
        : 'border-error/30 bg-error/10 text-main';
    const badgeTone = dragState.dropAllowed
        ? 'border-info/20 bg-info/12 text-info'
        : 'border-error/20 bg-error/12 text-error';
    const modeLabel = dragState.sourcePath ? 'Move' : 'Insert';
    const status = dragState.message || (dragState.targetPath
        ? (dragState.dropAllowed ? 'Release to drop here' : 'Cannot drop here')
        : 'Move over a region to drop');

    return (
        <div
            className={`pointer-events-none fixed max-w-[280px] rounded-[18px] border px-4 py-3 pe-card-shadow ${tone}`}
            style={{
                top: `${dragState.y + 18}px`,
                left: `${dragState.x + 18}px`,
            }}
        >
            <div className='flex items-start gap-3'>
                <div className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${badgeTone}`}>
                    {modeLabel}
                </div>
                <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-main'>{dragState.itemLabel}</p>
                    <p className='mt-1 text-xs text-subtle'>{status}</p>
                </div>
            </div>
        </div>
    );
}
