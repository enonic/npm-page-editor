import type {JSX} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {ContentTypeName} from '@enonic/lib-admin-ui/schema/content/ContentTypeName';
import {SelectPageDescriptorEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/SelectPageDescriptorEvent';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {getCurrentPageView} from '../../bridge';
import {useStoreValue} from '../../hooks/use-store-value';
import {$modifyAllowed, $registry} from '../../stores/registry';
import {loadPagePlaceholderState, type PlaceholderState} from '../../page-placeholder/load-page-placeholder';

export function PagePlaceholderOverlay(): JSX.Element | null {
    const registry = useStoreValue($registry);
    const modifyAllowed = useStoreValue($modifyAllowed);
    const pageView = getCurrentPageView();
    const rootRecord = registry[ComponentPath.root().toString()];
    const isVisible = rootRecord?.type === 'page' && rootRecord.empty;
    const liveEditParams = pageView?.getLiveEditParams();
    const contentType = liveEditParams?.contentType;
    const isPageTemplate = contentType ? new ContentTypeName(contentType).isPageTemplate() : false;
    const [selectedKey, setSelectedKey] = useState('');
    const [state, setState] = useState<PlaceholderState>({
        loading: false,
        error: undefined,
        contentTypeDisplayName: undefined,
        options: [],
    });

    useEffect(() => {
        if (!isVisible) {
            setSelectedKey('');
            setState({
                loading: false,
                error: undefined,
                contentTypeDisplayName: undefined,
                options: [],
            });
            return;
        }

        let cancelled = false;

        setSelectedKey('');
        setState((current) => ({
            ...current,
            loading: true,
            error: undefined,
            contentTypeDisplayName: undefined,
            options: [],
        }));

        loadPagePlaceholderState(liveEditParams?.contentId, contentType, isPageTemplate)
            .then((nextState) => {
                if (!cancelled) {
                    setState(nextState);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setState({
                        loading: false,
                        error: 'The editor could not load available page controllers.',
                        contentTypeDisplayName: undefined,
                        options: [],
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [contentType, isPageTemplate, isVisible, liveEditParams?.contentId]);

    if (!isVisible) {
        return null;
    }

    const selectedOption = state.options.find((option) => option.key === selectedKey);

    return (
        <div className='pointer-events-auto fixed inset-0 flex items-center justify-center p-6'>
            <div className='pe-shell pe-card-shadow w-full max-w-[560px] rounded-[28px] border border-bdr-soft bg-surface-primary p-6'>
                <div className='flex items-start gap-4'>
                    <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-info/20 bg-info/10 text-xs font-semibold uppercase tracking-[0.24em] text-info'>
                        Pg
                    </div>
                    <div className='min-w-0 flex-1'>
                        <p className='text-sm font-semibold text-main'>
                            {state.options.length > 0 ? 'Select a controller' : 'No page controller selected'}
                        </p>
                        <p className='mt-1 text-sm text-subtle'>
                            {state.options.length > 0
                                ? 'Choose how this content should be rendered inside the page editor.'
                                : 'This page does not have a controller yet.'}
                        </p>
                    </div>
                </div>

                {state.loading ? (
                    <div className='mt-5 animate-pulse rounded-[20px] border border-bdr-soft bg-surface-secondary/60 px-4 py-5 text-sm text-subtle'>
                        Loading available controllers...
                    </div>
                ) : null}

                {state.error ? (
                    <div className='mt-5 rounded-[20px] border border-error/30 bg-error/8 px-4 py-4 text-sm text-main'>
                        {state.error}
                    </div>
                ) : null}

                {!state.loading && !state.error && state.options.length === 0 ? (
                    <div className='mt-5 rounded-[20px] border border-bdr-soft bg-surface-secondary/60 px-4 py-5 text-sm text-subtle'>
                        Install an application that contributes page controllers for this content type, then reload the editor.
                    </div>
                ) : null}

                {!state.loading && !state.error && state.options.length > 0 ? (
                    <div className='mt-5 space-y-3'>
                        <label
                            className='block text-xs font-semibold uppercase tracking-[0.18em] text-subtle'
                            htmlFor='pe-page-controller-select'
                        >
                            Page controller
                        </label>
                        <select
                            id='pe-page-controller-select'
                            className='block w-full rounded-[16px] border border-bdr-soft bg-surface-primary px-4 py-3 text-sm text-main outline-none focus:border-info'
                            disabled={!modifyAllowed}
                            value={selectedKey}
                            onChange={(event) => {
                                const nextKey = (event.currentTarget as HTMLSelectElement).value;
                                setSelectedKey(nextKey);

                                if (nextKey) {
                                    new SelectPageDescriptorEvent(nextKey).fire();
                                }
                            }}
                        >
                            <option value='' disabled>
                                {modifyAllowed ? 'Choose a controller' : 'You do not have permission to change the controller'}
                            </option>
                            {state.options.map((option) => (
                                <option key={option.key} value={option.key}>
                                    {option.displayName}
                                </option>
                            ))}
                        </select>

                        <div className='rounded-[20px] border border-bdr-soft bg-surface-secondary/60 px-4 py-4'>
                            <p className='text-sm text-main'>
                                {selectedOption?.description || 'Pick a controller to render the page with the selected application.'}
                            </p>
                            {state.contentTypeDisplayName ? (
                                <p className='mt-2 text-xs text-subtle'>
                                    No page template is assigned for {state.contentTypeDisplayName}, so the controller choice will define the rendering.
                                </p>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
