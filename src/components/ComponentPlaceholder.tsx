import {cn, Skeleton} from '@enonic/ui';
import {Box, Columns2, FileChartPie, PenLine} from 'lucide-preact';

import type {ComponentType} from '../protocol';
import type {LucideIcon} from 'lucide-preact';
import type {JSX} from 'preact';

export type ComponentPlaceholderProps = {
  type: ComponentType;
  className?: string;
};

const COMPONENT_PLACEHOLDER_NAME = 'ComponentPlaceholder';

const TYPE_ICONS: Partial<Record<ComponentType, LucideIcon>> = {
  text: PenLine,
  part: Box,
  layout: Columns2,
  fragment: FileChartPie,
};

//
// * Wireframe
//

type WireframeLinesProps = {
  className?: string;
};

const WireframeLines = ({className}: WireframeLinesProps): JSX.Element => (
  <div className={cn('flex max-w-48 min-w-0 flex-1 flex-col gap-1.5', className)}>
    <Skeleton animated={false} className='h-1.5 w-full bg-decorative' />
    <Skeleton animated={false} className='h-1.5 w-full bg-decorative' />
    <Skeleton animated={false} className='h-1.5 w-[75%] bg-decorative' />
  </div>
);

//
// * Component
//

export const ComponentPlaceholder = ({type, className}: ComponentPlaceholderProps): JSX.Element => {
  const Icon = TYPE_ICONS[type];

  return (
    <div
      data-component={COMPONENT_PLACEHOLDER_NAME}
      className={cn('pe-shell @container overflow-hidden bg-surface-neutral', className)}
    >
      <div className='p-2.5'>
        <div className='flex items-center justify-center border border-decorative p-2 @[12rem]:gap-4 @[12rem]:px-4 @[12rem]:py-2.5'>
          {Icon != null ? (
            <div className='size-8 shrink-0 text-decorative @[12rem]:size-16'>
              <Icon className='size-full' strokeWidth={1.5} />
            </div>
          ) : null}
          <WireframeLines className='hidden @[12rem]:flex' />
        </div>
      </div>
    </div>
  );
};

ComponentPlaceholder.displayName = COMPONENT_PLACEHOLDER_NAME;
