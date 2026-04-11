import type {JSX} from 'preact';

interface DragPlaceholderProps {
    itemLabel: string;
    dropAllowed: boolean;
    message?: string;
}

export function DragPlaceholder({itemLabel, dropAllowed, message}: DragPlaceholderProps): JSX.Element {
    const title = dropAllowed ? 'Drop component here' : 'Drop unavailable';
    const description = message || (dropAllowed
        ? `Release to place ${itemLabel.toLowerCase()} in this region.`
        : 'Move this item into a valid region to continue.');
    const tone = dropAllowed
        ? 'border-info/25 bg-info/8 text-main'
        : 'border-error/30 bg-error/8 text-main';
    const badgeTone = dropAllowed
        ? 'border-info/20 bg-info/12 text-info'
        : 'border-error/20 bg-error/12 text-error';

    return (
        <div className={`pe-shell animate-in fade-in-50 rounded-[18px] border px-4 py-4 pe-card-shadow ${tone}`}>
            <div className='flex items-start gap-3'>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeTone}`}>
                    {dropAllowed ? 'Go' : 'No'}
                </div>
                <div className='min-w-0'>
                    <p className='text-sm font-semibold text-main'>{title}</p>
                    <p className='mt-1 text-xs text-subtle'>{description}</p>
                </div>
            </div>
        </div>
    );
}
