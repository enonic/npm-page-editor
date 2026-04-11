import type {JSX} from 'preact';
import type {ComponentRecordType} from '../../types';

interface ComponentPlaceholderProps {
    type: ComponentRecordType;
    descriptor?: string;
    error: boolean;
}

const labels: Record<ComponentRecordType, {badge: string; title: string}> = {
    page: {badge: 'Pg', title: 'Page'},
    region: {badge: 'Rg', title: 'Region'},
    text: {badge: 'Tx', title: 'Text'},
    part: {badge: 'Pt', title: 'Part'},
    layout: {badge: 'Ly', title: 'Layout'},
    fragment: {badge: 'Fg', title: 'Fragment'},
};

export function ComponentPlaceholder({type, descriptor, error}: ComponentPlaceholderProps): JSX.Element {
    const info = labels[type];
    const tone = error ? 'border-error/35 bg-error/8' : 'border-bdr-soft bg-surface-primary';

    return (
        <div className={`pe-shell pe-card-shadow animate-in fade-in-50 rounded-[20px] border px-4 py-4 ${tone}`}>
            <div className='flex items-start gap-3'>
                <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-info/20 bg-info/10 text-xs font-semibold uppercase tracking-[0.2em] text-info'>
                    {error ? 'Er' : info.badge}
                </div>
                <div className='min-w-0'>
                    <p className='text-sm font-semibold text-main'>
                        {error ? 'Rendering error' : `${info.title} component`}
                    </p>
                    <p className='mt-1 text-xs text-subtle'>
                        {error
                            ? 'The editor could not render this component state.'
                            : descriptor || 'This slot is ready for content.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
