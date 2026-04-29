import type {JSX} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {ContentTypeName} from '@enonic/lib-admin-ui/schema/content/ContentTypeName';
import {DefaultErrorHandler} from '@enonic/lib-admin-ui/DefaultErrorHandler';
import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {getCurrentPageView} from '../../bridge';
import {useStoreValue} from '../../hooks/use-store-value';
import {$registry} from '../../stores/registry';
import {loadPagePlaceholderState, type PlaceholderState} from '../../page-placeholder/load-page-placeholder';

const INITIAL_STATE: PlaceholderState = {
    hasControllers: false,
    contentTypeDisplayName: undefined,
};

export interface PagePlaceholderCardProps {
    hasControllers: boolean;
    contentTypeDisplayName?: string;
}

export function PagePlaceholderCard({hasControllers, contentTypeDisplayName}: PagePlaceholderCardProps): JSX.Element {
    const headerKey = hasControllers ? 'text.selectcontroller' : 'text.nocontrollers';
    const subText = !hasControllers
        ? i18n('text.addapplications')
        : contentTypeDisplayName
            ? i18n('text.notemplates', contentTypeDisplayName)
            : undefined;

    return (
        <div className='pe-shell pointer-events-auto w-full max-w-[560px] rounded-md border-2 border-dashed border-violet-500/50 p-6 text-center'>
            <p className='text-xl font-semibold text-subtle'>{i18n(headerKey)}</p>
            {subText ? <p className='mt-1 text-lg text-subtle'>{subText}</p> : null}
        </div>
    );
}

export function PagePlaceholderOverlay(): JSX.Element | null {
    const registry = useStoreValue($registry);
    const pageView = getCurrentPageView();
    const rootRecord = registry[ComponentPath.root().toString()];
    const isVisible = rootRecord?.type === 'page' && (rootRecord.empty || rootRecord.error);
    const liveEditParams = pageView?.getLiveEditParams();
    const contentType = liveEditParams?.contentType;
    const isPageTemplate = contentType ? new ContentTypeName(contentType).isPageTemplate() : false;
    const [state, setState] = useState<PlaceholderState>(INITIAL_STATE);

    useEffect(() => {
        if (!isVisible) {
            setState(INITIAL_STATE);
            return;
        }

        let cancelled = false;
        setState(INITIAL_STATE);

        loadPagePlaceholderState(liveEditParams?.contentId, contentType, isPageTemplate)
            .then((nextState) => {
                if (!cancelled) {
                    setState(nextState);
                }
            })
            .catch((reason) => {
                if (!cancelled) {
                    DefaultErrorHandler.handle(reason);
                    setState(INITIAL_STATE);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [contentType, isPageTemplate, isVisible, liveEditParams?.contentId]);

    if (!isVisible) {
        return null;
    }

    return (
        <div className='pointer-events-none fixed inset-0 flex items-center justify-center p-6'>
            <PagePlaceholderCard
                hasControllers={state.hasControllers}
                contentTypeDisplayName={state.contentTypeDisplayName}
            />
        </div>
    );
}
