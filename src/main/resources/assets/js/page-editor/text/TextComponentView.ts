import {LangDirection} from '@enonic/lib-admin-ui/dom/Element';
import {Locale} from '@enonic/lib-admin-ui/locale/Locale';
import {ObjectHelper} from '@enonic/lib-admin-ui/ObjectHelper';
import {HTMLAreaHelper} from '@enonic/lib-contentstudio/app/inputtype/ui/text/HTMLAreaHelper';
import {PageState} from '@enonic/lib-contentstudio/app/wizard/page/PageState';
import {ComponentView, ComponentViewBuilder} from '../ComponentView';
import {CreateTextComponentViewConfig} from '../CreateTextComponentViewConfig';
import {TextItemType} from './TextItemType';
import {StringHelper} from '@enonic/lib-admin-ui/util/StringHelper';
import {EditTextComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/EditTextComponentViewEvent';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {type ItemView} from '../ItemView';

export class TextComponentViewBuilder
    extends ComponentViewBuilder {

    text: string;

    constructor() {
        super();
        this.setType(TextItemType.get());
    }

    setText(value: string): this {
        this.text = value;
        return this;
    }

}

export class TextComponentView
    extends ComponentView {

    private value: string;

    private editAction: Action;

    constructor(builder: TextComponentViewBuilder) {
        super(builder);

        this.setText(this.normalizeInitialValue(builder.text));

        this.editAction = new Action(i18n('action.edit')).onExecuted(() => {
            new EditTextComponentViewEvent(this.getPath()).fire();
        });

        this.addClassEx('text-view');
        this.setTextDir();
        this.addEditActionToMenu(this.editAction);
    }

    private addEditActionToMenu(editAction: Action) {
        if (!this.isEmpty()) {
            this.addContextMenuActions([editAction]);
        }
    }

    private normalizeInitialValue(initialText?: string): string {
        if (ObjectHelper.isDefined(initialText)) {
            return initialText;
        } else {
            const isPageTemplateMode = !PageState.getState() || PageState.getState().hasTemplate();

            if (isPageTemplateMode) {
                // using html from live edit load if page is rendered using a template and no page object is present
                return this.getEl().getInnerHtml();
            } else {
                return this.liveEditParams.getTextComponentData(this.getPath().toString());
            }
        }
    }

    private setTextDir(): void {
        const contentsLangDirection: LangDirection = this.getLangDirection();

        if (contentsLangDirection === LangDirection.RTL) {
            this.setDir(LangDirection.RTL);
        }
    }

    refreshEmptyState(): ItemView {
        this.editAction?.setVisible(!this.isEmpty());
        return super.refreshEmptyState();
    }

    getText(): string {
        return this.value;
    }

    setText(text: string): void {
        this.value = text;
        const processedText = StringHelper.isBlank(text)
            ? ''
            : HTMLAreaHelper.convertRenderSrcToPreviewSrc(text, this.getLiveEditParams().contentId);
        this.setHtml(processedText, false);
        this.refreshEmptyState();
    }

    isEmpty(): boolean {
        return StringHelper.isBlank(this.value);
    }

    private getLangDirection(): LangDirection {
        const lang: string = this.getLiveEditParams().language;

        if (Locale.supportsRtl(lang)) {
            return LangDirection.RTL;
        }

        return LangDirection.AUTO;
    }

    reset(): void {
        this.setText('');
        this.hideContextMenu();
    }

    makeDuplicateConfig(): CreateTextComponentViewConfig {
        return super.makeDuplicateConfig(new CreateTextComponentViewConfig().setText(this.getText())) as CreateTextComponentViewConfig;
    }
}
