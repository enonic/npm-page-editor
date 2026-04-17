import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

export type ComponentEmptyPlaceholderProps = {
  descriptor: string;
  className?: string;
};

const COMPONENT_EMPTY_PLACEHOLDER_NAME = 'ComponentEmptyPlaceholder';

export const ComponentEmptyPlaceholder = ({descriptor, className}: ComponentEmptyPlaceholderProps): JSX.Element => (
  <div
    data-component={COMPONENT_EMPTY_PLACEHOLDER_NAME}
    className={cn('pe-shell overflow-hidden bg-surface-neutral', className)}
  >
    <div className='h-full p-2.5'>
      <div className='flex min-h-25 items-center justify-center border border-decorative px-4 py-2.5'>
        <p className='text-subtle'>{descriptor}</p>
      </div>
    </div>
  </div>
);

ComponentEmptyPlaceholder.displayName = COMPONENT_EMPTY_PLACEHOLDER_NAME;
