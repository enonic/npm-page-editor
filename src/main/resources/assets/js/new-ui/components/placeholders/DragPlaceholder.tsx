import type {JSX} from 'preact';

interface DragPlaceholderProps {
    itemLabel: string;
    dropAllowed: boolean;
    message?: string;
}

export function DragPlaceholder({dropAllowed, message}: DragPlaceholderProps): JSX.Element {
    const text = dropAllowed
        ? 'Release here...'
        : message || 'Cannot drop this component here.';
    const dashClass = dropAllowed ? 'pe-dash-info' : 'pe-dash-error';
    const bgClass = dropAllowed ? 'bg-info/8' : 'bg-error/8';
    const textClass = dropAllowed ? 'text-info' : 'text-error';

    return (
        <div className={`pe-shell pe-dash ${dashClass} ${bgClass} flex min-h-full items-center justify-center rounded-lg px-6 py-10`}>
            <p className={`text-base italic ${textClass}`}>{text}</p>
        </div>
    );
}
