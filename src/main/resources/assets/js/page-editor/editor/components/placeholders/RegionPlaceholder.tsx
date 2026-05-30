import type {JSX} from 'preact';

export type RegionPlaceholderProps = {
    path: string;
    regionName: string;
};

const REGION_PLACEHOLDER_NAME = 'RegionPlaceholder';

export const RegionPlaceholder = (_props: RegionPlaceholderProps): JSX.Element => {
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
