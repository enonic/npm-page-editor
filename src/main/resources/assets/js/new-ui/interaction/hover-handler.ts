import {elementIndex} from '../stores/element-index';
import {$dragState, $textEditing, setHoveredPath} from '../stores/registry';
import {getTrackedTarget} from './click-guard';

export function initHoverDetection(): () => void {
    const handleMouseOver = (event: MouseEvent) => {
        if ($textEditing.get() || $dragState.get()) {
            setHoveredPath(undefined);
            return;
        }

        const target = getTrackedTarget(event.target);
        if (!target) {
            return;
        }

        setHoveredPath(elementIndex.get(target));
    };

    const handleMouseOut = (event: MouseEvent) => {
        if ($textEditing.get() || $dragState.get()) {
            setHoveredPath(undefined);
            return;
        }

        const relatedTarget = getTrackedTarget(event.relatedTarget);
        if (!relatedTarget) {
            setHoveredPath(undefined);
        }
    };

    document.addEventListener('mouseover', handleMouseOver, {passive: true});
    document.addEventListener('mouseout', handleMouseOut, {passive: true});

    return () => {
        document.removeEventListener('mouseover', handleMouseOver);
        document.removeEventListener('mouseout', handleMouseOut);
    };
}
