import {useContextMenu} from '@enonic/ui';
import {useLayoutEffect} from 'preact/hooks';

export type PositionSetterProps = {
    x: number;
    y: number;
};

export const PositionSetter = ({x, y}: PositionSetterProps): null => {
    const {setPosition} = useContextMenu();

    useLayoutEffect(() => {
        setPosition({x, y});
    }, [setPosition, x, y]);

    return null;
};
