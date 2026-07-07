import {useEffect, useRef, useState} from 'preact/hooks';

import type {Meta, StoryObj} from '@storybook/preact-vite';

import {
    calcEdgeIntensity,
    createEdgeAutoScroll,
    HOT_ZONE_PX,
} from '../../src/page-editor/editor/interaction/drag/edge-auto-scroll';

//
// * Helpers
//

interface EdgeIntensities {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

function calcIntensities(pointerX: number, pointerY: number, width: number, height: number): EdgeIntensities {
    return {
        top: calcEdgeIntensity(pointerY),
        bottom: calcEdgeIntensity(height - pointerY),
        left: calcEdgeIntensity(pointerX),
        right: calcEdgeIntensity(width - pointerX),
    };
}

function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

//
// * Meta
//

const meta = {
    title: 'Page Editor/Drag Auto-Scroll',
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

//
// * Demo Component
//

interface AutoScrollDemoProps {
    width?: number;
    height?: number;
    contentWidth?: number;
    contentHeight?: number;
}

function AutoScrollDemo({width = 480, height = 360, contentWidth = 480, contentHeight = 2400}: AutoScrollDemoProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [pointer, setPointer] = useState<{x: number; y: number} | undefined>(undefined);
    const [scroll, setScroll] = useState({top: 0, left: 0});

    useEffect(() => {
        if (!dragging || !scrollerRef.current) return undefined;

        const scroller = scrollerRef.current;
        const edgeScroll = createEdgeAutoScroll({
            getScroller: () => scroller,
            onScrolled: () => setScroll({top: scroller.scrollTop, left: scroller.scrollLeft}),
        });

        const handleMouseMove = (event: MouseEvent): void => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (rect) {
                setPointer({x: event.clientX - rect.left, y: event.clientY - rect.top});
            }
            edgeScroll.update(event.clientX, event.clientY);
        };

        const handleMouseUp = (): void => {
            edgeScroll.stop();
            setDragging(false);
            setPointer(undefined);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            edgeScroll.stop();
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging]);

    const handleDragStart = (event: MouseEvent): void => {
        event.preventDefault();
        setDragging(true);
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (rect) {
            setPointer({x: event.clientX - rect.left, y: event.clientY - rect.top});
        }
    };

    const horizontal = contentWidth > width;
    const intensities = pointer ? calcIntensities(pointer.x, pointer.y, width, height) : undefined;

    return (
        <div className='flex flex-col gap-y-4 p-6'>
            <div className='max-w-200 text-sm text-subtle'>
                Press and hold <span className='font-medium'>Drag me</span>, then move the pointer toward any edge of
                the scroll container. Auto-scroll uses a cubic ease-in curve. Hot-zone shading and the intensity readout
                reflect the current curve value (the actual velocity is <code>MIN + (MAX - MIN) * intensity</code>).
                {horizontal && ' This demo also scrolls horizontally.'} Release to stop.
            </div>

            <div className='flex items-start gap-4'>
                <button
                    type='button'
                    onMouseDown={handleDragStart}
                    className='px-3 py-2 rounded-sm bg-blue-600 text-white cursor-grab select-none shadow-xs whitespace-nowrap'
                >
                    Drag me
                </button>

                <div ref={wrapperRef} className='relative shrink-0' style={{width, height}}>
                    <div
                        ref={scrollerRef}
                        className='absolute inset-0 overflow-auto border border-default rounded-md bg-surface-subtle'
                    >
                        <div className='relative' style={{width: contentWidth, height: contentHeight}}>
                            {Array.from({length: Math.ceil(contentHeight / 100)}, (_, idx) => (
                                <div
                                    key={idx}
                                    className='m-2 h-20 rounded-sm bg-white shadow-xs flex items-center justify-center text-sm text-subtle'
                                    style={{width: contentWidth - 16}}
                                >
                                    Block {idx + 1}
                                </div>
                            ))}
                        </div>
                    </div>

                    {dragging && (
                        <>
                            <div
                                className='pointer-events-none absolute left-0 right-0 top-0 border-2 border-dashed border-rose-400/70 bg-rose-500'
                                style={{height: HOT_ZONE_PX, opacity: 0.1 + (intensities?.top ?? 0) * 0.45}}
                            />
                            <div
                                className='pointer-events-none absolute left-0 right-0 bottom-0 border-2 border-dashed border-rose-400/70 bg-rose-500'
                                style={{height: HOT_ZONE_PX, opacity: 0.1 + (intensities?.bottom ?? 0) * 0.45}}
                            />
                            {horizontal && (
                                <>
                                    <div
                                        className='pointer-events-none absolute top-0 bottom-0 left-0 border-2 border-dashed border-rose-400/70 bg-rose-500'
                                        style={{width: HOT_ZONE_PX, opacity: 0.1 + (intensities?.left ?? 0) * 0.45}}
                                    />
                                    <div
                                        className='pointer-events-none absolute top-0 bottom-0 right-0 border-2 border-dashed border-rose-400/70 bg-rose-500'
                                        style={{width: HOT_ZONE_PX, opacity: 0.1 + (intensities?.right ?? 0) * 0.45}}
                                    />
                                </>
                            )}
                        </>
                    )}

                    {pointer && (
                        <div
                            className='pointer-events-none absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 border-2 border-white shadow'
                            style={{left: pointer.x, top: pointer.y}}
                        />
                    )}
                </div>

                <div className='font-mono text-xs text-subtle leading-relaxed min-w-32'>
                    <div className='text-default font-medium mb-1'>scroll</div>
                    <div>top: {Math.round(scroll.top)}px</div>
                    <div>left: {Math.round(scroll.left)}px</div>
                    {intensities && (
                        <>
                            <div className='text-default font-medium mt-3 mb-1'>intensity</div>
                            <div className={intensities.top > 0 ? 'text-rose-600' : ''}>
                                top: {formatPercent(intensities.top)}
                            </div>
                            <div className={intensities.bottom > 0 ? 'text-rose-600' : ''}>
                                bot: {formatPercent(intensities.bottom)}
                            </div>
                            {horizontal && (
                                <>
                                    <div className={intensities.left > 0 ? 'text-rose-600' : ''}>
                                        left: {formatPercent(intensities.left)}
                                    </div>
                                    <div className={intensities.right > 0 ? 'text-rose-600' : ''}>
                                        right: {formatPercent(intensities.right)}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

//
// * Examples
//

export const Vertical: Story = {
    name: 'Examples / Vertical Scroll',
    render: () => <AutoScrollDemo />,
};

export const TwoAxis: Story = {
    name: 'Examples / Two-Axis Scroll',
    render: () => <AutoScrollDemo width={480} height={360} contentWidth={1400} contentHeight={2000} />,
};
