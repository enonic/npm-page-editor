import {cn, Skeleton} from '@enonic/ui';

import type {JSX} from 'preact';

export type LoadingOverlayPlaceholderProps = {
    className?: string;
};

const LOADING_OVERLAY_PLACEHOLDER_NAME = 'LoadingOverlayPlaceholder';

export const LoadingOverlayPlaceholder = ({className}: LoadingOverlayPlaceholderProps): JSX.Element => (
    <div
        data-component={LOADING_OVERLAY_PLACEHOLDER_NAME}
        data-loading=''
        className={cn('pe-shell pointer-events-none h-full w-full select-none', className)}
    >
        <Skeleton className='h-full w-full rounded-none bg-decorative/50' />
    </div>
);

LoadingOverlayPlaceholder.displayName = LOADING_OVERLAY_PLACEHOLDER_NAME;
