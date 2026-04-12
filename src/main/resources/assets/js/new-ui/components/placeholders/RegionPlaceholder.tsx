import type {JSX} from 'preact';
import {useStoreValue} from '../../hooks/use-store-value';
import {$dragState} from '../../stores/registry';

interface RegionPlaceholderProps {
    path: string;
    regionName: string;
}

export function RegionPlaceholder({path}: RegionPlaceholderProps): JSX.Element | null {
    const dragState = useStoreValue($dragState);

    if (dragState?.targetPath === path) {
        return null;
    }

    return (
        <div className='pe-shell pe-dash flex min-h-full items-center justify-center rounded-lg px-6 py-10'>
            <p className='text-base italic text-subtle'>Drop components here..</p>
        </div>
    );
}
