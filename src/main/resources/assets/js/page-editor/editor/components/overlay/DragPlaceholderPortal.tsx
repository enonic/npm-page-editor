import {useEffect} from 'preact/hooks';
import {useStoreValue} from '../../hooks/use-store-value';
import {createPlaceholderIsland} from '../../rendering/placeholder-island';
import {$dragState} from '../../stores/registry';
import {DragPlaceholder} from '../placeholders/DragPlaceholder';

export function DragPlaceholderPortal(): null {
    const dragState = useStoreValue($dragState);

    useEffect(() => {
        if (!dragState?.placeholderElement || !dragState.targetPath) {
            return undefined;
        }

        const island = createPlaceholderIsland(
            dragState.placeholderElement,
            <DragPlaceholder
                itemLabel={dragState.itemLabel}
                dropAllowed={dragState.dropAllowed}
                message={dragState.message}
            />,
        );

        return () => island.unmount();
    }, [
        dragState?.placeholderElement,
        dragState?.targetPath,
        dragState?.itemLabel,
        dragState?.dropAllowed,
        dragState?.message,
    ]);

    return null;
}
