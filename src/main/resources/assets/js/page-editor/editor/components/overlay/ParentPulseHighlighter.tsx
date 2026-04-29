import type {JSX} from 'preact';

import {useStoreValue} from '../../hooks/use-store-value';
import {useTrackedRect} from '../../hooks/use-tracked-rect';
import {$dragState, $selectParentPulse} from '../../stores/registry';

const PARENT_PULSE_HIGHLIGHTER_NAME = 'ParentPulseHighlighter';

export const ParentPulseHighlighter = (): JSX.Element | null => {
    const pulse = useStoreValue($selectParentPulse);
    const dragState = useStoreValue($dragState);
    const rect = useTrackedRect(pulse?.path);

    if (dragState != null || pulse == null || rect == null) return null;

    const {top, left, width, height} = rect;

    return (
        <div
            data-component={PARENT_PULSE_HIGHLIGHTER_NAME}
            key={pulse.key}
            className='pe-parent-pulse pointer-events-none fixed z-30 rounded-xs'
            style={{top, left, width, height}}
        />
    );
};

ParentPulseHighlighter.displayName = PARENT_PULSE_HIGHLIGHTER_NAME;
