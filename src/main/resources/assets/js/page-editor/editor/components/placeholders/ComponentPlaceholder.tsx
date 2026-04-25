import {cn} from '@enonic/ui';
import {Box, Columns2, PenLine, Puzzle} from 'lucide-preact';

import type {ComponentRecordType} from '../../types';
import type {LucideIcon} from 'lucide-preact';
import type {JSX} from 'preact';

export type ComponentPlaceholderProps = {
    type: ComponentRecordType;
    descriptor?: string;
    error: boolean;
    className?: string;
};

const COMPONENT_PLACEHOLDER_NAME = 'ComponentPlaceholder';

const TYPE_ICONS: Partial<Record<ComponentRecordType, LucideIcon>> = {
    text: PenLine,
    part: Box,
    layout: Columns2,
    fragment: Puzzle,
};

//
// * Wireframe
//

type WireframeLinesProps = {
    className?: string;
};

const WireframeLines = ({className}: WireframeLinesProps): JSX.Element => (
    <div className={cn('flex max-w-48 min-w-0 flex-1 flex-col gap-1.5', className)}>
        <div className='h-1.5 w-full rounded-sm bg-decorative' />
        <div className='h-1.5 w-full rounded-sm bg-decorative' />
        <div className='h-1.5 w-[75%] rounded-sm bg-decorative' />
    </div>
);

//
// * Component
//

export const ComponentPlaceholder = ({type, descriptor, error, className}: ComponentPlaceholderProps): JSX.Element => {
    if (error) {
        return (
            <div
                data-component={COMPONENT_PLACEHOLDER_NAME}
                className={cn('pe-shell overflow-hidden bg-surface-neutral select-none', className)}
            >
                <div className='h-full p-2.5'>
                    <div className='flex min-h-25 items-center justify-center border border-error px-4 py-2.5'>
                        <p className='text-error'>
                            {descriptor || 'This component could not be rendered.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const Icon = TYPE_ICONS[type];

    return (
        <div
            data-component={COMPONENT_PLACEHOLDER_NAME}
            className={cn('pe-shell @container overflow-hidden bg-surface-neutral select-none', className)}
        >
            <div className='p-2.5'>
                <div className='flex min-h-25 items-center justify-center border border-decorative p-2 @[12rem]:gap-4 @[12rem]:px-4 @[12rem]:py-2.5'>
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
