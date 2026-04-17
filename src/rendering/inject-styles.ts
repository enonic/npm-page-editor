import editorUiCss from './editor-ui.css?inline';

let sheet: CSSStyleSheet | undefined;

export function injectStyles(shadowRoot: ShadowRoot): void {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(editorUiCss);
  }
  shadowRoot.adoptedStyleSheets = [sheet];
}
