import {Event} from '@enonic/lib-admin-ui/event/Event';

export enum EditorEvents {
    ComponentLoadRequest = 'component:load:request',
    ComponentLoadStarted = 'component:load:started',
    ComponentLoaded = 'component:loaded',
    ComponentLoadFailed = 'component:load:failed',
    PageReloadRequest = 'page:reload:request',
}

export class EditorEvent<D extends object = object>
    extends Event {

    private data: D | undefined;

    constructor(type: EditorEvents, data?: D) {
        super(type);
        this.data = data;
    }

    setData(data: D) {
        this.data = data;
        return this;
    }

    getData(): D | undefined {
        return this.data;
    }
}
