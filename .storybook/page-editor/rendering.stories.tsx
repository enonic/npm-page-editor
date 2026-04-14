import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {CSSProperties} from 'preact';
import {useEffect, useRef} from 'preact/hooks';
import {createOverlayHost} from '../../src/main/resources/assets/js/v2/rendering/overlay-host';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/v2/rendering/placeholder-island';

//
// * Helpers
//

function PlaceholderIslandMount({children, style}: {children: preact.ComponentChildren; style?: CSSProperties}) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return undefined;

        const island = createPlaceholderIsland(containerRef.current, children);
        return () => island.unmount();
    }, [children]);

    return <div ref={containerRef} style={style} />;
}

function OverlayHostMount({children}: {children: preact.ComponentChildren}) {
    useEffect(() => {
        const overlay = createOverlayHost(children);
        return () => overlay.unmount();
    }, [children]);

    return (
        <div className='text-sm text-subtle'>
            Content is rendered in a fixed overlay shadow root. Inspect the DOM to verify.
        </div>
    );
}

function StyleSwatch({label, className}: {label: string; className: string}) {
    return (
        <div className='flex items-center gap-3'>
            <div className={`size-8 rounded ${className}`} />
            <span className='text-sm'>{label}</span>
        </div>
    );
}

function TokenGrid() {
    return (
        <div className='flex flex-col gap-4 p-4'>
            <p className='text-base font-semibold text-main'>Tailwind + Design Tokens</p>

            <div className='grid grid-cols-2 gap-3'>
                <StyleSwatch label='bg-info' className='bg-info' />
                <StyleSwatch label='bg-warn' className='bg-warn' />
                <StyleSwatch label='bg-success' className='bg-success' />
                <StyleSwatch label='bg-error' className='bg-error' />
                <StyleSwatch label='bg-surface-primary' className='bg-surface-primary' />
                <StyleSwatch label='bg-surface-selected' className='bg-surface-selected' />
            </div>

            <div className='flex gap-2'>
                <span className='rounded border border-bdr-soft px-2 py-1 text-xs'>border-bdr-soft</span>
                <span className='rounded border border-bdr-strong px-2 py-1 text-xs'>border-bdr-strong</span>
                <span className='rounded border border-bdr-subtle px-2 py-1 text-xs'>border-bdr-subtle</span>
            </div>

            <div className='flex gap-2'>
                <span className='rounded bg-surface-info px-2 py-1 text-xs text-info'>info text</span>
                <span className='rounded bg-surface-warn px-2 py-1 text-xs text-warn'>warn text</span>
                <span className='rounded bg-surface-error px-2 py-1 text-xs text-error'>error text</span>
            </div>

            <p className='text-xs text-subtle'>
                If colors render correctly, design tokens are working inside shadow DOM.
            </p>
        </div>
    );
}

//
// * Meta
//

const meta = {
    title: 'Page Editor/Rendering',
    parameters: {layout: 'centered'},
    tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const PlaceholderIsland: Story = {
    name: 'Examples / Placeholder Island',
    render: () => (
        <PlaceholderIslandMount style={{width: '360px'}}>
            <TokenGrid />
        </PlaceholderIslandMount>
    ),
};

export const OverlayHost: Story = {
    name: 'Examples / Overlay Host',
    render: () => (
        <OverlayHostMount>
            <div style={{position: 'fixed', top: '80px', right: '24px', pointerEvents: 'auto'}}>
                <div className='w-72 rounded-lg border border-bdr-soft bg-surface-neutral p-4 shadow-lg'>
                    <p className='mb-2 text-sm font-semibold text-main'>Overlay Panel</p>
                    <p className='text-xs text-subtle'>
                        This panel lives in the overlay shadow root with fixed positioning.
                    </p>
                    <div className='mt-3 flex gap-2'>
                        <div className='size-4 rounded-full bg-info' />
                        <div className='size-4 rounded-full bg-success' />
                        <div className='size-4 rounded-full bg-warn' />
                        <div className='size-4 rounded-full bg-error' />
                    </div>
                </div>
            </div>
        </OverlayHostMount>
    ),
};

//
// * Features
//

export const StyleIsolation: Story = {
    name: 'Features / Style Isolation',
    render: () => (
        <div>
            {/* Customer page styles that should NOT leak into shadow DOM */}
            <style>{`
                .isolation-test p { color: red !important; font-size: 32px !important; }
                .isolation-test span { background: magenta !important; }
            `}</style>
            <div className='isolation-test' style={{display: 'flex', gap: '24px'}}>
                <div style={{width: '240px'}}>
                    <p style={{margin: '0 0 8px', fontSize: '13px', fontWeight: 600}}>Outside shadow DOM</p>
                    <p>This text should be red and large.</p>
                    <span>This should have magenta background.</span>
                </div>
                <PlaceholderIslandMount style={{width: '240px'}}>
                    <div className='p-4'>
                        <p className='mb-2 text-sm font-semibold'>Inside shadow DOM</p>
                        <p className='text-sm'>This text should NOT be red or large.</p>
                        <span className='text-xs'>This should NOT have magenta background.</span>
                    </div>
                </PlaceholderIslandMount>
            </div>
        </div>
    ),
};
