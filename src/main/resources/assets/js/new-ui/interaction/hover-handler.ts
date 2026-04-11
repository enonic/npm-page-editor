import {elementIndex} from '../stores/element-index';
import {setHoveredPath} from '../stores/registry';
import {getTrackedTarget} from './click-guard';

export function initHoverDetection(): () => void {
    const handleMouseOver = (event: MouseEvent) => {
        const target = getTrackedTarget(event.target);
        if (!target) {
            return;
        }

        setHoveredPath(elementIndex.get(target));
    };

    const handleMouseOut = (event: MouseEvent) => {
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
