import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

export type DragPlaceholderProps = {
    className?: string;
};

const DRAG_PLACEHOLDER_NAME = 'DragPlaceholder';

export const DragPlaceholder = ({className}: DragPlaceholderProps): JSX.Element => {
    return (
        <div data-component={DRAG_PLACEHOLDER_NAME} className={cn('pe-shell select-none p-2.5', className)}>
            <div className="pe-dash pe-dash-select flex min-h-25 items-center justify-center bg-bdr-select/8 px-4 py-2.5">
                {/* Invisible copy of the idle prompt: reserves the same intrinsic width as
                    RegionPlaceholder so a shrink-to-fit host region cannot squash the empty
                    dropzone to its bare padding. pe-shell on the root gives it the matching font. */}
                <p aria-hidden="true" className="invisible text-center text-subtle italic">
                    {'Drop components here...'}
                </p>
            </div>
        </div>
    );
};

DragPlaceholder.displayName = DRAG_PLACEHOLDER_NAME;
