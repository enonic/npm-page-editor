import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

export type EmptyPlaceholderProps = {
    name: string;
    className?: string;
};

const EMPTY_PLACEHOLDER_NAME = 'EmptyPlaceholder';

export const EmptyPlaceholder = ({name, className}: EmptyPlaceholderProps): JSX.Element => (
    <div
        data-component={EMPTY_PLACEHOLDER_NAME}
        className={cn('pe-shell overflow-hidden bg-surface-neutral select-none', className)}
    >
        <div className='h-full p-2.5'>
            <div className='flex min-h-25 items-center justify-center border border-bdr-soft px-4 py-2.5'>
                <p className='text-subtle'>{name}</p>
            </div>
        </div>
    </div>
);

EmptyPlaceholder.displayName = EMPTY_PLACEHOLDER_NAME;
