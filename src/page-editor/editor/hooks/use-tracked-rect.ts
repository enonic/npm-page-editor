import {useEffect, useState} from 'preact/hooks';

import {trackElementResize} from '../geometry/resize-tracker';
import {registerConsumer} from '../geometry/scheduler';
import {getRecord} from '../stores/registry';

export function useTrackedRect(path: string | undefined): DOMRect | undefined {
    const [rect, setRect] = useState<DOMRect | undefined>(undefined);

    useEffect(() => {
        if (!path) {
            setRect(undefined);
            return undefined;
        }

        return registerConsumer({
            targetPath: path,
            callback: setRect,
        });
    }, [path]);

    useEffect(() => {
        if (!path) {
            return undefined;
        }

        const element = getRecord(path)?.element;
        if (!element) {
            return undefined;
        }

        return trackElementResize(element);
    }, [path]);

    return rect;
}
