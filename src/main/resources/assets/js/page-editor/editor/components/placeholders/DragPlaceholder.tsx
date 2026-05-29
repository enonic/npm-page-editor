import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

export type DragPlaceholderProps = {
    className?: string;
};

const DRAG_PLACEHOLDER_NAME = 'DragPlaceholder';

export const DragPlaceholder = ({className}: DragPlaceholderProps): JSX.Element => {
    return (
        <div data-component={DRAG_PLACEHOLDER_NAME} className={cn('p-2.5', className)}>
            <div className='pe-dash pe-dash-select min-h-25 bg-bdr-select/8' />
        </div>
    );
};

DragPlaceholder.displayName = DRAG_PLACEHOLDER_NAME;
