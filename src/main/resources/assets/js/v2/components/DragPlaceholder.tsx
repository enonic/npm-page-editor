import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

export type DragPlaceholderProps = {
  itemLabel: string;
  dropAllowed: boolean;
  message?: string;
};

const DRAG_PLACEHOLDER_NAME = 'DragPlaceholder';

export const DragPlaceholder = ({dropAllowed, message}: DragPlaceholderProps): JSX.Element => {
  const text = dropAllowed ? 'Release here...' : (message ?? 'Cannot drop this component here.');

  const dashClass = dropAllowed ? 'pe-dash-info' : 'pe-dash-error';
  const bgClass = dropAllowed ? 'bg-info/8' : 'bg-error/8';
  const textClass = dropAllowed ? 'text-info' : 'text-error';

  return (
    <div
      data-component={DRAG_PLACEHOLDER_NAME}
      className={cn(
        'pe-shell pe-dash flex min-h-full items-center justify-center rounded-lg px-6 py-10',
        dashClass,
        bgClass,
      )}
    >
      <p className={cn('text-base italic', textClass)}>{text}</p>
    </div>
  );
};

DragPlaceholder.displayName = DRAG_PLACEHOLDER_NAME;
