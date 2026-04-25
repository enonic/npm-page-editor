import editorUiCss from './editor-ui.css?inline';

export function injectEditorStyles(shadowRoot: ShadowRoot): void {
    if (shadowRoot.querySelector('style[data-page-editor-ui]')) {
        return;
    }

    const style = document.createElement('style');
    style.dataset.pageEditorUi = 'true';
    style.textContent = editorUiCss;
    shadowRoot.prepend(style);
}
