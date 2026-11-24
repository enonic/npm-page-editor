import {isOverlayChromeEvent} from '../common/click-guard';

export function initNavigationGuard(): () => void {
    const handleClick = (event: MouseEvent): void => {
        if (isOverlayChromeEvent(event)) {
            return;
        }

        if (event.composedPath().some(value => value instanceof Element && value.localName === 'a')) {
            event.preventDefault();
        }
    };

    const handleSubmit = (event: SubmitEvent): void => {
        if (isOverlayChromeEvent(event)) {
            return;
        }

        event.preventDefault();
    };

    document.addEventListener('click', handleClick, {capture: true});
    document.addEventListener('auxclick', handleClick, {capture: true});
    document.addEventListener('submit', handleSubmit, {capture: true});

    return () => {
        document.removeEventListener('click', handleClick, {capture: true});
        document.removeEventListener('auxclick', handleClick, {capture: true});
        document.removeEventListener('submit', handleSubmit, {capture: true});
    };
}
