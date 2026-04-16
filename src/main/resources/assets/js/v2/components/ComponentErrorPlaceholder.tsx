import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

export type ComponentErrorPlaceholderProps = {
  descriptor?: string;
  className?: string;
};

const COMPONENT_ERROR_PLACEHOLDER_NAME = 'ComponentErrorPlaceholder';

export const ComponentErrorPlaceholder = ({descriptor, className}: ComponentErrorPlaceholderProps): JSX.Element => (
  <div
    data-component={COMPONENT_ERROR_PLACEHOLDER_NAME}
    className={cn('pe-shell overflow-hidden bg-surface-neutral', className)}
  >
    <div className='h-full p-2.5'>
      <div className='flex min-h-25 items-center justify-center border border-error px-4 py-2.5'>
        <p className='text-error'>{descriptor ?? 'This component could not be rendered.'}</p>
      </div>
    </div>
  </div>
);

ComponentErrorPlaceholder.displayName = COMPONENT_ERROR_PLACEHOLDER_NAME;
