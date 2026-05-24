import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {ComponentChildren} from 'preact';
import {useEffect, useRef} from 'preact/hooks';
import {ComponentPlaceholder} from '../../src/main/resources/assets/js/page-editor/editor/components/placeholders/ComponentPlaceholder';
import {EmptyPlaceholder} from '../../src/main/resources/assets/js/page-editor/editor/components/placeholders/EmptyPlaceholder';
import {LoadingOverlayPlaceholder} from '../../src/main/resources/assets/js/page-editor/editor/components/placeholders/LoadingOverlayPlaceholder';
import {LoadingPlaceholder} from '../../src/main/resources/assets/js/page-editor/editor/components/placeholders/LoadingPlaceholder';
import {RegionPlaceholder} from '../../src/main/resources/assets/js/page-editor/editor/components/placeholders/RegionPlaceholder';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/page-editor/editor/rendering/placeholder-island';

//
// * Helpers
//

interface IslandMountProps {
    children: ComponentChildren;
    className?: string;
    overlay?: boolean;
    underlay?: ComponentChildren;
}

function IslandMount({children, className, overlay, underlay}: IslandMountProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return undefined;
        }

        const island = createPlaceholderIsland(containerRef.current, children, {overlay});
        return () => island.unmount();
    }, [children, overlay]);

    return <div ref={containerRef} className={className}>{underlay}</div>;
}

//
// * Meta
//

const meta = {
    title: 'Page Editor/Placeholders',
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

//
// * Dropzone
//

export const DropzoneDefault: Story = {
    name: 'Dropzone / Default',
    render: () => (
        <IslandMount className='w-160'>
            <RegionPlaceholder path='/main' regionName='main' />
        </IslandMount>
    ),
};

//
// * Placeholder
//

export const PlaceholderStates: Story = {
    name: 'Placeholder / States',
    render: () => (
        <div className='flex items-start gap-6'>
            <IslandMount className='w-70'>
                <ComponentPlaceholder type='part' error={false} />
            </IslandMount>
            <div className='w-70 ring-[3px] ring-blue-500'>
                <IslandMount>
                    <ComponentPlaceholder type='part' error={false} />
                </IslandMount>
            </div>
            <div className='w-70 ring-[1.5px] ring-blue-500/70'>
                <IslandMount>
                    <ComponentPlaceholder type='part' error={false} />
                </IslandMount>
            </div>
        </div>
    ),
};

export const PlaceholderVariants: Story = {
    name: 'Placeholder / Variants',
    render: () => (
        <div className='grid w-100 gap-4 rounded-lg border-2 border-dashed border-violet-500/50 p-4'>
            <IslandMount>
                <ComponentPlaceholder type='text' error={false} />
            </IslandMount>
            <IslandMount>
                <ComponentPlaceholder type='part' error={false} />
            </IslandMount>
            <IslandMount>
                <ComponentPlaceholder type='layout' error={false} />
            </IslandMount>
            <IslandMount>
                <ComponentPlaceholder type='fragment' error={false} />
            </IslandMount>
        </div>
    ),
};

//
// * States
//

export const ErrorBlock: Story = {
    name: 'States / Error',
    render: () => (
        <IslandMount className='w-160'>
            <ComponentPlaceholder
                type='part'
                descriptor='This is a message that describes the error'
                error={true}
            />
        </IslandMount>
    ),
};

export const EmptyBlock: Story = {
    name: 'States / Empty',
    render: () => (
        <IslandMount className='w-160'>
            <EmptyPlaceholder name='Hero Banner' />
        </IslandMount>
    ),
};

export const LoadingBlock: Story = {
    name: 'States / Loading',
    render: () => (
        <IslandMount className='w-160'>
            <LoadingPlaceholder />
        </IslandMount>
    ),
};

export const LoadingOverlay: Story = {
    name: 'States / Loading Overlay',
    render: () => (
        <div className='flex flex-col items-center gap-y-3 p-4'>
            <div className='max-w-120 text-sm text-subtle'>
                Shown over a non-empty part while it is being reloaded — keeps the existing rendered
                content visible behind a transparent shimmer until the new HTML arrives.
            </div>
            <IslandMount
                className='w-160 rounded border border-decorative bg-surface-neutral p-6'
                overlay
                underlay={(
                    <article>
                        <h1 className='text-xl font-semibold'>Hero Banner</h1>
                        <p className='mt-2 text-sm'>
                            Existing rendered content stays visible underneath the shimmer overlay
                            while the part configuration is being applied.
                        </p>
                    </article>
                )}
            >
                <LoadingOverlayPlaceholder />
            </IslandMount>
        </div>
    ),
};
