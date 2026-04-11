import type {JSX} from 'preact';
import type {Action} from '@enonic/lib-admin-ui/ui/Action';
import {useStoreValue} from '../../hooks/use-store-value';
import {$contextMenuState, $dragState, closeContextMenu} from '../../stores/registry';
import {getActionsForPath, getLockedPageActions} from '../../bridge';

interface ActionListProps {
    actions: Action[];
    level?: number;
}

function sortActions(actions: Action[]): Action[] {
    return [...actions].sort((left, right) => left.getSortOrder() - right.getSortOrder());
}

function ActionList({actions, level = 0}: ActionListProps) {
    return (
        <>
            {sortActions(actions)
                .map((action) => {
                    if (action.hasChildActions()) {
                        return (
                            <div key={`${level}-${action.getLabel()}`} className='border-t border-bdr-soft/70 first:border-t-0'>
                                <div className='px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle'>
                                    {action.getLabel()}
                                </div>
                                <ActionList actions={action.getChildActions()} level={level + 1} />
                            </div>
                        );
                    }

                    return (
                        <button
                            key={`${level}-${action.getLabel()}`}
                            className='block w-full rounded-[10px] px-3 py-2 text-left text-sm text-main hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45'
                            disabled={!action.isEnabled()}
                            style={{paddingLeft: `${12 + level * 16}px`}}
                            onClick={() => {
                                action.execute();
                                closeContextMenu();
                            }}
                        >
                            {action.getLabel()}
                        </button>
                    );
                })}
        </>
    );
}

export function ContextMenu(): JSX.Element | null {
    const state = useStoreValue($contextMenuState);
    const dragState = useStoreValue($dragState);

    if (dragState || !state) {
        return null;
    }

    const actions = state.kind === 'locked-page' ? getLockedPageActions() : getActionsForPath(state.path);
    if (actions.length === 0) {
        return null;
    }

    return (
        <div
            className='pointer-events-auto fixed min-w-[220px] rounded-[18px] border border-bdr-soft bg-surface-primary p-2 pe-card-shadow'
            style={{top: `${state.y}px`, left: `${state.x}px`}}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
        >
            <ActionList actions={actions} />
        </div>
    );
}
