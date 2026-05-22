import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

export type DragPlaceholderProps = {
    className?: string;
};

const DRAG_PLACEHOLDER_NAME = 'DragPlaceholder';

export const DragPlaceholder = ({className}: DragPlaceholderProps): JSX.Element => {
    return <div data-component={DRAG_PLACEHOLDER_NAME} className={cn('min-h-30', className)} />;
};

DragPlaceholder.displayName = DRAG_PLACEHOLDER_NAME;
