import {cn, Skeleton} from '@enonic/ui';

import type {JSX} from 'preact';

export type LoadingPlaceholderProps = {
    className?: string;
};

const LOADING_PLACEHOLDER_NAME = 'LoadingPlaceholder';

export const LoadingPlaceholder = ({className}: LoadingPlaceholderProps): JSX.Element => (
    <div
        data-component={LOADING_PLACEHOLDER_NAME}
        data-loading=''
        className={cn('pe-shell @container overflow-hidden bg-surface-neutral select-none', className)}
    >
        <div className='p-2.5'>
            <div className='flex min-h-25 items-center justify-center border border-decorative p-2 @[12rem]:gap-4 @[12rem]:px-4 @[12rem]:py-2.5'>
                <div className='flex size-8 shrink-0 items-center justify-center @[12rem]:size-16'>
                    <Skeleton className='size-6 bg-decorative/80 @[12rem]:size-12' />
                </div>
                <div className='hidden max-w-48 min-w-0 flex-1 flex-col gap-1.5 @[12rem]:flex'>
                    <Skeleton className='h-1.5 w-full bg-decorative' />
                    <Skeleton className='h-1.5 w-full bg-decorative' />
                    <Skeleton className='h-1.5 w-[75%] bg-decorative' />
                </div>
            </div>
        </div>
    </div>
);

LoadingPlaceholder.displayName = LOADING_PLACEHOLDER_NAME;
