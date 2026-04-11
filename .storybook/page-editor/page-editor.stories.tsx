import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {ComponentChildren} from 'preact';

import {ShadowHost} from './shadow-host.tsx';

interface StorySectionProps {
    title: string;
    description: string;
    children: ComponentChildren;
}

interface RegionBlockProps {
    title: string;
    hint?: string;
    tone?: 'default' | 'info' | 'danger';
    children?: ComponentChildren;
}

interface ComponentCardProps {
    title: string;
    eyebrow: string;
    tone?: 'default' | 'success' | 'danger' | 'muted';
    lines?: string[];
}

function StorySurface({title, description, children}: StorySectionProps) {
    return (
        <ShadowHost>
            <section className='pe-story-surface pe-card-shadow animate-in fade-in zoom-in-95 w-[min(92vw,76rem)] rounded-[28px] border border-bdr-soft p-6'>
                <header className='mb-6 flex flex-col gap-2 border-b border-bdr-soft pb-4'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-subtle'>Isolated Preact Lab</p>
                    <div className='flex flex-col gap-1 md:flex-row md:items-end md:justify-between'>
                        <div>
                            <h2 className='text-2xl font-semibold tracking-tight text-main'>{title}</h2>
                            <p className='max-w-3xl text-sm text-subtle'>{description}</p>
                        </div>
                        <div className='rounded-full border border-bdr-soft bg-surface-neutral px-3 py-1 text-xs text-subtle'>
                            Shadow root + Tailwind + Enonic UI tokens
                        </div>
                    </div>
                </header>
                {children}
            </section>
        </ShadowHost>
    );
}

function EditorFrame({children}: {children: ComponentChildren}) {
    return (
        <div className='pe-card-shadow overflow-hidden rounded-[24px] border border-bdr-soft bg-surface-neutral'>
            <div className='pe-toolbar-glow flex items-center justify-between border-b border-bdr-soft bg-surface-primary px-5 py-3'>
                <div className='flex items-center gap-3'>
                    <div className='h-3 w-3 rounded-full bg-info/60' />
                    <div className='h-3 w-3 rounded-full bg-warn/60' />
                    <div className='h-3 w-3 rounded-full bg-success/60' />
                    <span className='ml-2 text-sm font-medium text-main'>Live editor canvas</span>
                </div>
                <div className='rounded-full border border-bdr-soft bg-surface-neutral px-3 py-1 text-xs text-subtle'>
                    iframe overlay candidate
                </div>
            </div>
            <div className='pe-canvas-grid bg-surface-neutral p-6'>{children}</div>
        </div>
    );
}

function RegionBlock({title, hint, tone = 'default', children}: RegionBlockProps) {
    const toneClass = {
        default: 'border-info/30 bg-surface-neutral',
        info: 'border-info/30 bg-info/6',
        danger: 'border-error/30 bg-error/8',
    }[tone];

    return (
        <section className={`pe-dash rounded-[22px] border p-4 ${toneClass}`}>
            <header className='mb-4 flex items-start justify-between gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-main'>{title}</h3>
                    {hint ? <p className='text-xs text-subtle'>{hint}</p> : null}
                </div>
                <span className='rounded-full bg-surface-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle'>
                    Region
                </span>
            </header>
            <div className='flex flex-col gap-3'>{children}</div>
        </section>
    );
}

function PlaceholderBlock({
    title,
    description,
    badge,
}: {
    title: string;
    description: string;
    badge: string;
}) {
    return (
        <div className='animate-in fade-in-50 rounded-[20px] border border-bdr-soft bg-surface-primary px-5 py-8 text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-info/20 bg-info/10 text-lg font-semibold text-info'>
                {badge}
            </div>
            <h4 className='text-base font-semibold text-main'>{title}</h4>
            <p className='mx-auto mt-2 max-w-md text-sm text-subtle'>{description}</p>
        </div>
    );
}

function ComponentCard({title, eyebrow, tone = 'default', lines = []}: ComponentCardProps) {
    const toneClass = {
        default: 'border-bdr-soft bg-surface-neutral',
        success: 'border-success/30 bg-success/8',
        danger: 'border-error/30 bg-error/8',
        muted: 'border-bdr-soft bg-surface-primary',
    }[tone];

    return (
        <article className={`rounded-[20px] border p-4 ${toneClass}`}>
            <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle'>{eyebrow}</p>
            <h4 className='mt-1 text-sm font-semibold text-main'>{title}</h4>
            <div className='mt-3 flex flex-col gap-2'>
                {lines.map((line) => (
                    <div key={line} className='rounded-xl bg-surface-neutral/70 px-3 py-2 text-sm text-subtle'>
                        {line}
                    </div>
                ))}
            </div>
        </article>
    );
}

const meta = {
    title: 'Page Editor/Scenarios',
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Storybook lab for a page-editor migration. Each story renders inside a shadow root so Tailwind-based chrome can be evaluated without leaking into the edited page.',
            },
        },
    },
    tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PagePlaceholder: Story = {
    name: 'Separate / Page Placeholder',
    render: () => (
        <StorySurface
            title='Empty page placeholder'
            description='Represents the whole-page empty state. This is the highest-risk surface for style leakage because it renders directly over arbitrary site markup.'
        >
            <EditorFrame>
                <PlaceholderBlock
                    badge='Pg'
                    title='Select a page controller'
                    description='Use a shadow-root Preact host for this surface first. It is visually rich, mostly self-contained, and less risky than migrating drag/drop internals immediately.'
                />
            </EditorFrame>
        </StorySurface>
    ),
};

export const RegionPlaceholder: Story = {
    name: 'Separate / Region Placeholder',
    render: () => (
        <StorySurface
            title='Empty region placeholder'
            description='A narrower component-level target. This is a good first migration unit because its styling is self-contained and easy to compare against legacy behavior.'
        >
            <EditorFrame>
                <div className='mx-auto max-w-4xl'>
                    <RegionBlock title='main' hint='Drag components here or pick one from the insert menu' tone='info'>
                        <PlaceholderBlock
                            badge='Rg'
                            title='Drop zone is active'
                            description='The new styling can be fully isolated while legacy drag/drop logic still owns the actual region behavior behind the scenes.'
                        />
                    </RegionBlock>
                </div>
            </EditorFrame>
        </StorySurface>
    ),
};

export const ComponentStates: Story = {
    name: 'Groups / Component States',
    render: () => (
        <StorySurface
            title='Component state rack'
            description='Use grouped stories to compare empty, healthy, and broken variants side by side. This makes visual regressions obvious before wiring the states back into the live editor.'
        >
            <EditorFrame>
                <div className='grid gap-4 lg:grid-cols-3'>
                    <ComponentCard
                        eyebrow='Healthy'
                        title='Hero banner'
                        tone='success'
                        lines={['Responsive image renders', 'Toolbar anchor is stable', 'Selected outline stays inside bounds']}
                    />
                    <ComponentCard
                        eyebrow='Empty'
                        title='Text block'
                        tone='muted'
                        lines={['No data yet', 'Placeholder should stay centered', 'Menu affordance remains visible']}
                    />
                    <ComponentCard
                        eyebrow='Broken'
                        title='Promo grid'
                        tone='danger'
                        lines={['Site CSS overrides spacing', 'Badge wraps unexpectedly', 'Error action should stay readable']}
                    />
                </div>
            </EditorFrame>
        </StorySurface>
    ),
};

export const LayoutAudit: Story = {
    name: 'Groups / Layout Audit',
    render: () => (
        <StorySurface
            title='Composite layout audit'
            description='This grouped scenario is the handoff point from separate stories to realistic editor snapshots: multiple regions, mixed states, and a likely final testing target for visual diffing.'
        >
            <EditorFrame>
                <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]'>
                    <div className='flex flex-col gap-5'>
                        <RegionBlock title='hero' hint='Selected component with content'>
                            <ComponentCard
                                eyebrow='Selected'
                                title='Hero section'
                                lines={['Heading stays on baseline', 'Content actions align to the right', 'Selection ring does not shift layout']}
                            />
                        </RegionBlock>
                        <div className='grid gap-5 md:grid-cols-2'>
                            <RegionBlock title='left-column' hint='Healthy content'>
                                <ComponentCard
                                    eyebrow='Part'
                                    title='Article teaser'
                                    lines={['Card spacing is consistent', 'Text truncation remains stable']}
                                />
                                <ComponentCard
                                    eyebrow='Part'
                                    title='Quote block'
                                    tone='muted'
                                    lines={['Long content should not break the menu anchor']}
                                />
                            </RegionBlock>
                            <RegionBlock title='right-column' hint='One broken component and one empty slot' tone='danger'>
                                <ComponentCard
                                    eyebrow='Error'
                                    title='Event list'
                                    tone='danger'
                                    lines={['Dependency mismatch', 'Fallback CTA stays clickable']}
                                />
                                <PlaceholderBlock
                                    badge='+'
                                    title='Insert another component'
                                    description='Grouped stories should keep one empty slot around so spacing issues appear before runtime wiring.'
                                />
                            </RegionBlock>
                        </div>
                    </div>
                    <aside className='pe-card-shadow flex flex-col gap-4 rounded-[22px] border border-bdr-soft bg-surface-primary p-4'>
                        <div>
                            <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle'>Inspection rail</p>
                            <h3 className='mt-1 text-base font-semibold text-main'>Migration checkpoints</h3>
                        </div>
                        <div className='space-y-3 text-sm text-subtle'>
                            <div className='rounded-2xl bg-surface-neutral px-3 py-3'>
                                Keep drag/drop and event wiring legacy until the Preact shells are visually stable.
                            </div>
                            <div className='rounded-2xl bg-surface-neutral px-3 py-3'>
                                Render new chrome through a shadow host so Tailwind never touches the edited site.
                            </div>
                            <div className='rounded-2xl bg-surface-neutral px-3 py-3'>
                                Use visual stories for single states first, then matrix stories, then runtime integration.
                            </div>
                        </div>
                    </aside>
                </div>
            </EditorFrame>
        </StorySurface>
    ),
};
