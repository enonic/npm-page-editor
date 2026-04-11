import type {JSX} from 'preact';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {DeselectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/DeselectComponentEvent';
import {SelectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent';
import {useStoreValue} from '../../hooks/use-store-value';
import {
    $contextMenuState,
    $dragState,
    $locked,
    $modifyAllowed,
    $selectedPath,
    closeContextMenu,
    openContextMenu,
    setSelectedPath,
} from '../../stores/registry';
import {deselectLegacyItemView, selectLegacyItemView} from '../../bridge';

export function Shader(): JSX.Element | null {
    const locked = useStoreValue($locked);
    const dragState = useStoreValue($dragState);
    const modifyAllowed = useStoreValue($modifyAllowed);
    const selectedPath = useStoreValue($selectedPath);
    const contextMenuState = useStoreValue($contextMenuState);

    if (dragState || !locked) {
        return null;
    }

    const pagePath = ComponentPath.root().toString();

    const toggleLockedMenu = (x: number, y: number) => {
        if (contextMenuState?.kind === 'locked-page') {
            closeContextMenu();
            return;
        }

        const pagePath = ComponentPath.root().toString();

        openContextMenu({
            kind: 'locked-page',
            path: pagePath,
            x,
            y,
        });
    };

    const handleSelectionFallback = (x: number, y: number, rightClicked: boolean) => {
        closeContextMenu();

        if (selectedPath !== pagePath || rightClicked) {
            setSelectedPath(pagePath);
            selectLegacyItemView(pagePath);

            new SelectComponentEvent({
                path: ComponentPath.root(),
                position: {x, y},
                rightClicked,
            }).fire();
            return;
        }

        deselectLegacyItemView(pagePath);
        setSelectedPath(undefined);
        new DeselectComponentEvent(ComponentPath.root()).fire();
    };

    return (
        <div
            className='pointer-events-auto fixed inset-0 bg-black/18'
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (modifyAllowed) {
                    toggleLockedMenu(event.pageX, event.pageY);
                    return;
                }

                handleSelectionFallback(event.pageX, event.pageY, false);
            }}
            onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (modifyAllowed) {
                    toggleLockedMenu(event.pageX, event.pageY);
                    return;
                }

                handleSelectionFallback(event.pageX, event.pageY, true);
            }}
        />
    );
}
