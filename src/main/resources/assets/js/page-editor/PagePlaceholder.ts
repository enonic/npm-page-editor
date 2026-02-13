import {StyleHelper} from '@enonic/lib-admin-ui/StyleHelper';
import {DefaultErrorHandler} from '@enonic/lib-admin-ui/DefaultErrorHandler';
import {DivEl} from '@enonic/lib-admin-ui/dom/DivEl';
import {PagePlaceholderInfoBlock} from './PagePlaceholderInfoBlock';
import {type PageView} from './PageView';
import {ItemViewPlaceholder} from './ItemViewPlaceholder';
import {ContentId} from '@enonic/lib-contentstudio/app/content/ContentId';
import {type ContentType} from '@enonic/lib-contentstudio/app/inputtype/schema/ContentType';
import {type Descriptor} from '@enonic/lib-contentstudio/app/page/Descriptor';
import {GetContentTypeByNameRequest} from '@enonic/lib-contentstudio/app/resource/GetContentTypeByNameRequest';
import {PageDescriptorDropdown} from '@enonic/lib-contentstudio/app/wizard/page/contextwindow/inspect/page/PageDescriptorDropdown';
import {type LoadedDataEvent} from '@enonic/lib-admin-ui/util/loader/event/LoadedDataEvent';
import {SelectPageDescriptorEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/SelectPageDescriptorEvent';
import {ContentTypeName} from '@enonic/lib-admin-ui/schema/content/ContentTypeName';
import type Q from 'q';
import type {SelectionChange} from '@enonic/lib-admin-ui/util/SelectionChange';

export class PagePlaceholder
    extends ItemViewPlaceholder {

    private pageDescriptorPlaceholder: DivEl;

    private infoBlock: PagePlaceholderInfoBlock;

    private controllerDropdown: PageDescriptorDropdown;

    private pageView: PageView;

    constructor(pageView: PageView) {
        super();

        this.pageView = pageView;

        this.initElements();
        this.initListeners();

        this.controllerDropdown.hide();
        this.controllerDropdown.load();
    }

    private initListeners() {
        this.controllerDropdown.onLoadedData(this.dataLoadedHandler);

        this.controllerDropdown.onClicked((event: MouseEvent) => {
            this.controllerDropdown.giveFocus();
            event.stopPropagation();
        });

        this.controllerDropdown.onSelectionChanged((selectionChange: SelectionChange<Descriptor>) => {
            if (selectionChange.selected?.length > 0) {
                const pageDescriptor: Descriptor = selectionChange.selected[0];
                new SelectPageDescriptorEvent(pageDescriptor.getKey().toString()).fire();
            }
        });
    }

    private initElements() {
        this.infoBlock = new PagePlaceholderInfoBlock();
        this.controllerDropdown = new PageDescriptorDropdown(new ContentId(this.pageView.getLiveEditParams().contentId));
        this.pageDescriptorPlaceholder = new DivEl('page-descriptor-placeholder', StyleHelper.getCurrentPrefix());
    }

    private dataLoadedHandler: (event: LoadedDataEvent<Descriptor>) => Q.Promise<void> = (event: LoadedDataEvent<Descriptor>) => {
        if (event.getData().length > 0) {
            this.controllerDropdown.show();
            const type = new ContentTypeName(this.pageView.getLiveEditParams().contentType);
            if (!type.isPageTemplate()) {
                return new GetContentTypeByNameRequest(type).sendAndParse().then((contentType: ContentType) => {
                    this.infoBlock.setTextForContent(contentType.getDisplayName());
                }).catch((reason) => {
                    this.infoBlock.setTextForContent(type.toString());
                    DefaultErrorHandler.handle(reason);
                });
            } else {
                this.infoBlock.toggleHeader(true);
            }
            this.infoBlock.removeClass('empty');
        } else {
            this.controllerDropdown.hide();
            this.infoBlock.setEmptyText();
            this.infoBlock.addClass('empty');
        }
    };

    remove() {
        this.controllerDropdown.unLoadedData(this.dataLoadedHandler);
        return super.remove();
    }

    doRender(): Q.Promise<boolean> {
        return super.doRender().then((rendered: boolean) => {
            this.addClassEx('page-placeholder');
            this.addClass('icon-insert-template');
            this.controllerDropdown.addClassEx('page-descriptor-dropdown');

            this.pageDescriptorPlaceholder.appendChild(this.infoBlock);
            this.pageDescriptorPlaceholder.appendChild(this.controllerDropdown);
            this.appendChild(this.pageDescriptorPlaceholder);

            return rendered;
        });
    }
}
