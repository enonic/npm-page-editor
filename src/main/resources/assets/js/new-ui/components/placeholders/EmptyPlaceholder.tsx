import type {JSX} from 'preact';

interface EmptyPlaceholderProps {
    name: string;
}

export function EmptyPlaceholder({name}: EmptyPlaceholderProps): JSX.Element {
    return (
        <div className='pe-shell rounded-lg border border-bdr-soft px-6 py-10 text-center'>
            <p className='text-lg text-subtle'>{name}</p>
        </div>
    );
}
