const STYLE_ID = 'pe-drag-cursor-style';
const BODY_CLASS = 'pe-is-dragging';

const STYLE_TEXT = `body.${BODY_CLASS}, body.${BODY_CLASS} * { cursor: grabbing !important; }`;

export function installDragCursorStyle(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (style == null) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
  }

  return () => {
    document.body.classList.remove(BODY_CLASS);
    document.getElementById(STYLE_ID)?.remove();
  };
}

export function setDragCursor(active: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle(BODY_CLASS, active);
}
