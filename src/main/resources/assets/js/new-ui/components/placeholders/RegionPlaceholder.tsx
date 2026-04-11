import type {JSX} from 'preact';

interface RegionPlaceholderProps {
    regionName: string;
}

export function RegionPlaceholder({regionName}: RegionPlaceholderProps): JSX.Element {
    return (
        <div className='pe-shell pe-card-shadow pe-dash animate-in fade-in-50 rounded-[20px] border border-info/30 bg-surface-primary px-4 py-5 text-center'>
            <div className='mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-info/20 bg-info/10 text-xs font-semibold uppercase tracking-[0.2em] text-info'>
                Rg
            </div>
            <p className='text-sm font-semibold text-main'>{regionName || 'Region'}</p>
            <p className='mt-1 text-xs text-subtle'>Drop components here or pick one from the insert menu.</p>
        </div>
    );
}
