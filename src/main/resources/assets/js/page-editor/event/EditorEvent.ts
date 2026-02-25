import {Event} from '@enonic/lib-admin-ui/event/Event';

export enum EditorEvents {
    ComponentLoadRequest = 'component:load:request',
    PageReloadRequest = 'page:reload:request',
    ComponentLoadFailed = 'component:load:failed',
    ComponentLoaded = 'component:loaded',
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
