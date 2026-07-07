import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

export type LoadingOverlayPlaceholderProps = {
    className?: string;
};

const LOADING_OVERLAY_PLACEHOLDER_NAME = 'LoadingOverlayPlaceholder';

export const LoadingOverlayPlaceholder = ({className}: LoadingOverlayPlaceholderProps): JSX.Element => (
    <div
        data-component={LOADING_OVERLAY_PLACEHOLDER_NAME}
        data-loading=''
        className={cn(
            'pe-shell relative h-full w-full cursor-wait select-none overflow-hidden bg-decorative/15 backdrop-blur-[2px]',
            className,
        )}
    >
        <div className='absolute inset-0 animate-[pe-shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent' />
    </div>
);

LoadingOverlayPlaceholder.displayName = LOADING_OVERLAY_PLACEHOLDER_NAME;
