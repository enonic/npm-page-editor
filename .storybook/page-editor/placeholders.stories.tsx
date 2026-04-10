import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {ComponentChildren, CSSProperties} from 'preact';
import {useEffect, useRef} from 'preact/hooks';
import {ComponentPlaceholder} from '../../src/main/resources/assets/js/editor/components/placeholders/ComponentPlaceholder';
import {DragPlaceholder} from '../../src/main/resources/assets/js/editor/components/placeholders/DragPlaceholder';
import {EmptyPlaceholder} from '../../src/main/resources/assets/js/editor/components/placeholders/EmptyPlaceholder';
import {RegionPlaceholder} from '../../src/main/resources/assets/js/editor/components/placeholders/RegionPlaceholder';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/editor/rendering/placeholder-island';

//
// * Helpers
//

interface IslandMountProps {
    children: ComponentChildren;
    className?: string;
    style?: CSSProperties;
}

function IslandMount({children, className, style}: IslandMountProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return undefined;
        }

        const island = createPlaceholderIsland(containerRef.current, children);
        return () => island.unmount();
    }, [children]);

    return <div ref={containerRef} className={className} style={style} />;
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
        <IslandMount style={{width: '640px'}}>
            <RegionPlaceholder path='/main' regionName='main' />
        </IslandMount>
    ),
};

export const DropzoneDragOver: Story = {
    name: 'Dropzone / Drag Over',
    render: () => (
        <IslandMount style={{width: '640px'}}>
            <DragPlaceholder itemLabel='Hero banner' dropAllowed={true} />
        </IslandMount>
    ),
};

export const DropzoneForbidden: Story = {
    name: 'Dropzone / Forbidden',
    render: () => (
        <IslandMount style={{width: '640px'}}>
            <DragPlaceholder
                itemLabel='Layout'
                dropAllowed={false}
                message='This is a message that describes the error'
            />
        </IslandMount>
    ),
};

//
// * Placeholder
//

export const PlaceholderStates: Story = {
    name: 'Placeholder / States',
    render: () => (
        <div style={{display: 'flex', gap: '24px', alignItems: 'start'}}>
            <IslandMount style={{width: '280px'}}>
                <ComponentPlaceholder type='part' error={false} />
            </IslandMount>
            <div style={{width: '280px', boxShadow: '0 0 0 3px rgb(59 130 246)'}}>
                <IslandMount>
                    <ComponentPlaceholder type='part' error={false} />
                </IslandMount>
            </div>
            <div style={{width: '280px', boxShadow: '0 0 0 1.5px rgb(59 130 246 / 0.7)'}}>
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
        <div style={{
            border: '2px dashed rgb(139 92 246 / 0.5)',
            borderRadius: '8px',
            padding: '16px',
            display: 'grid',
            gap: '16px',
            width: '400px',
        }}>
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
        <IslandMount style={{width: '640px'}}>
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
        <IslandMount style={{width: '640px'}}>
            <EmptyPlaceholder name='Hero Banner' />
        </IslandMount>
    ),
};
