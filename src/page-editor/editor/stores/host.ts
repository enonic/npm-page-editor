import {atom} from 'nanostores';

import type {ContentInfo, ProjectInfo} from '../../protocol';

export type HostContext = {
    hostDomain?: string;
    content?: ContentInfo;
    project?: ProjectInfo;
    locale?: string;
};

export const $hostContext = atom<HostContext>({});

export function setHostContext(context: HostContext): void {
    $hostContext.set(context);
}

export function getHostContext(): HostContext {
    return $hostContext.get();
}
