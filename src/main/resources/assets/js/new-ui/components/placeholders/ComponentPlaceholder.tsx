import type {JSX} from 'preact';
import type {ComponentRecordType} from '../../types';

interface ComponentPlaceholderProps {
    type: ComponentRecordType;
    descriptor?: string;
    error: boolean;
}

//
// * Icons
//

const typeIcons: Partial<Record<ComponentRecordType, JSX.Element>> = {
    text: (
        <svg className='size-full' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M13 21h8' />
            <path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' />
        </svg>
    ),
    part: (
        <svg className='size-full' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z' />
            <path d='m3.3 7 8.7 5 8.7-5' />
            <path d='M12 22V12' />
        </svg>
    ),
    layout: (
        <svg className='size-full' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <rect width='18' height='18' x='3' y='3' rx='2' />
            <path d='M12 3v18' />
        </svg>
    ),
    fragment: (
        <svg className='size-full' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z' />
        </svg>
    ),
};

//
// * Wireframe
//

const WIREFRAME_WIDTHS = ['100%', '85%', '65%'];

function WireframeLines(): JSX.Element {
    return (
        <div className='flex min-w-0 flex-1 flex-col gap-2.5'>
            {WIREFRAME_WIDTHS.map((width) => (
                <div
                    key={width}
                    className='h-2.5 rounded bg-main/15'
                    style={{width}}
                />
            ))}
        </div>
    );
}

//
// * Component
//

export function ComponentPlaceholder({type, descriptor, error}: ComponentPlaceholderProps): JSX.Element {
    if (error) {
        return (
            <div className='pe-shell rounded-lg border-2 border-error/60 px-6 py-10 text-center'>
                <p className='text-base italic text-error'>
                    {descriptor || 'This component could not be rendered.'}
                </p>
            </div>
        );
    }

    const icon = typeIcons[type];

    return (
        <div className='pe-shell rounded-lg border border-bdr-soft bg-surface-primary p-5'>
            <div className='flex items-center gap-4'>
                {icon ? <div className='size-12 shrink-0 text-subtle/50'>{icon}</div> : null}
                <WireframeLines />
            </div>
        </div>
    );
}
