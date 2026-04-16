import {getPathForElement, isDragging, setHoveredPath} from '../state';
import {getTrackedTarget} from './guards';

export function initHoverDetection(): () => void {
  const handleMouseOver = (event: MouseEvent): void => {
    if (isDragging()) {
      setHoveredPath(undefined);
      return;
    }

    const target = getTrackedTarget(event.target);
    if (target == null) return;

    setHoveredPath(getPathForElement(target));
  };

  const handleMouseOut = (event: MouseEvent): void => {
    if (isDragging()) {
      setHoveredPath(undefined);
      return;
    }

    const relatedTarget = getTrackedTarget(event.relatedTarget);
    if (relatedTarget == null) {
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
