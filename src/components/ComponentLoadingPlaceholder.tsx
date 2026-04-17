import {cn} from '@enonic/ui';
import {LoaderCircle} from 'lucide-preact';

import type {JSX} from 'preact';

export type ComponentLoadingPlaceholderProps = {
  className?: string;
};

const COMPONENT_LOADING_PLACEHOLDER_NAME = 'ComponentLoadingPlaceholder';

export const ComponentLoadingPlaceholder = ({className}: ComponentLoadingPlaceholderProps): JSX.Element => (
  <div
    data-component={COMPONENT_LOADING_PLACEHOLDER_NAME}
    className={cn('pe-shell @container overflow-hidden bg-surface-neutral', className)}
  >
    <div className='p-2.5'>
      <div className='flex items-center justify-center border border-decorative p-2 @[12rem]:px-4 @[12rem]:py-2.5'>
        <LoaderCircle className='size-8 shrink-0 animate-spin text-muted @[12rem]:size-16' strokeWidth={1.5} />
      </div>
    </div>
  </div>
);

ComponentLoadingPlaceholder.displayName = COMPONENT_LOADING_PLACEHOLDER_NAME;
