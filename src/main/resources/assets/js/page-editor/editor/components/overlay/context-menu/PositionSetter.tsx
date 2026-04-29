import {useContextMenu} from '@enonic/ui';
import {useLayoutEffect} from 'preact/hooks';

import type {RefObject} from 'preact';

export type PositionSetterProps = {
    x: number;
    y: number;
    /** When true, `x` is the menu's horizontal center; we shift left by half the measured width. */
    centerX?: boolean;
    /** Ref to the rendered menu Content; required when `centerX` is true. */
    contentRef?: RefObject<HTMLDivElement>;
};

export const PositionSetter = ({x, y, centerX, contentRef}: PositionSetterProps): null => {
    const {setPosition} = useContextMenu();

    useLayoutEffect(() => {
        if (centerX && contentRef?.current) {
            const halfWidth = contentRef.current.offsetWidth / 2;
            setPosition({x: x - halfWidth, y});
            return;
        }
        setPosition({x, y});
    }, [setPosition, x, y, centerX, contentRef]);

    return null;
};
