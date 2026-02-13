import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {DivEl} from '@enonic/lib-admin-ui/dom/DivEl';
import {ItemViewPlaceholder} from '../ItemViewPlaceholder';
import {type FragmentComponentView} from './FragmentComponentView';
import {ShowWarningLiveEditEvent} from '@enonic/lib-contentstudio/page-editor/event/ShowWarningLiveEditEvent';
import {LayoutItemType} from '../layout/LayoutItemType';
import {GetContentByIdRequest} from '@enonic/lib-contentstudio/app/resource/GetContentByIdRequest';
import {type Content} from '@enonic/lib-contentstudio/app/content/Content';
import {LayoutComponentType} from '@enonic/lib-contentstudio/app/page/region/LayoutComponentType';
import {SetFragmentComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/SetFragmentComponentEvent';
import {FragmentDropdown} from '@enonic/lib-contentstudio/app/wizard/page/contextwindow/inspect/region/FragmentDropdown';
import type Q from 'q';
import {type ContentSummary} from '@enonic/lib-contentstudio/app/content/ContentSummary';
import {type ContentId} from '@enonic/lib-contentstudio/app/content/ContentId';
import type {SelectionChange} from '@enonic/lib-admin-ui/util/SelectionChange';

export class FragmentPlaceholder
    extends ItemViewPlaceholder {

    private fragmentComponentView: FragmentComponentView;

    private fragmentDropdown: FragmentDropdown;

    private comboboxWrapper: DivEl;

    constructor() {
        super();

        this.initElements();
        this.initListeners();
    }

    protected initElements(): void {
        this.comboboxWrapper = new DivEl('rich-combobox-wrapper');
        this.fragmentDropdown = new FragmentDropdown();
    }

    protected initListeners(): void {
        this.fragmentDropdown.onSelectionChanged((selectionChange: SelectionChange<ContentSummary>) => {
            if (selectionChange.selected?.length > 0) {
                const contentId: ContentId = selectionChange.selected[0].getContentId();

                if (this.isInsideLayout()) {
                    new GetContentByIdRequest(contentId).sendAndParse().done((content: Content) => {
                        const fragmentComponent = content.getPage() ? content.getPage().getFragment() : null;

                        if (fragmentComponent && fragmentComponent.getType() instanceof LayoutComponentType) {
                            this.fragmentDropdown.setSelectedFragment(null);
                            new ShowWarningLiveEditEvent(i18n('notify.nestedLayouts')).fire();
                        } else {
                            new SetFragmentComponentEvent(this.fragmentComponentView.getPath(), contentId.toString()).fire();
                            this.fragmentComponentView.showLoadingSpinner();
                        }
                    });
                } else {
                    new SetFragmentComponentEvent(this.fragmentComponentView.getPath(), contentId.toString()).fire();
                    this.fragmentComponentView.showLoadingSpinner();
                }
            }
        });
    }

    private isInsideLayout(): boolean {
        const parentRegion = this.fragmentComponentView.getParentItemView();
        if (!parentRegion) {
            return false;
        }
        const parent = parentRegion.getParentItemView();
        if (!parent) {
            return false;
        }

        return parent.getType() instanceof LayoutItemType;
    }

    setComponentView(fragmentComponentView: FragmentComponentView): void {
        this.fragmentComponentView = fragmentComponentView;
        this.fragmentDropdown.setSitePath(this.fragmentComponentView.getLiveEditParams().sitePath);
    }

    doRender(): Q.Promise<boolean> {
        return super.doRender().then((rendered: boolean) => {
            this.addClass('icon-pie');
            this.addClassEx('fragment-placeholder');

            this.comboboxWrapper.appendChild(this.fragmentDropdown);
            this.appendChild(this.comboboxWrapper);

            return rendered;
        });
    }

    select() {
        if (!this.isRendered()) {
            this.whenRendered(() => this.select());
        } else {
            this.comboboxWrapper.show();
        }
    }

    deselect() {
        this.comboboxWrapper.hide();
    }

    focus(): void {
        if (!this.isRendered()) {
            this.whenRendered(() => this.focus());
        } else {
            this.fragmentDropdown.giveFocus();
        }
    }
}
