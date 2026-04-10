import type {JSX} from 'preact';

import {useStoreValue} from '../../hooks/use-store-value';
import {$dragState} from '../../stores/registry';

export type RegionPlaceholderProps = {
    path: string;
    regionName: string;
};

const REGION_PLACEHOLDER_NAME = 'RegionPlaceholder';

export const RegionPlaceholder = ({path}: RegionPlaceholderProps): JSX.Element | null => {
    const dragState = useStoreValue($dragState);

    if (dragState?.targetPath === path) return null;

    return (
        <div
            data-component={REGION_PLACEHOLDER_NAME}
            className='pe-shell h-full overflow-hidden bg-surface-neutral select-none'
        >
            <div className='h-full p-2.5'>
                <div className='pe-dash flex h-full min-h-25 items-center justify-center px-4 py-2.5'>
                    <p className='text-center text-subtle italic'>Drop components here..</p>
                </div>
            </div>
        </div>
    );
};

RegionPlaceholder.displayName = REGION_PLACEHOLDER_NAME;
