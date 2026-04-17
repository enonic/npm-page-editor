import {isEditorInjectedElement, isNodeEmpty} from './emptiness';

describe('isNodeEmpty', () => {
  it('ignores editor-injected placeholder hosts', () => {
    const container = document.createElement('div');
    const host = document.createElement('div');
    host.setAttribute('data-pe-placeholder-host', 'true');
    container.appendChild(host);

    expect(isNodeEmpty(container)).toBe(true);
  });

  it('ignores the shared overlay host', () => {
    const container = document.createElement('div');
    const overlay = document.createElement('div');
    overlay.id = 'pe-overlay-host';
    container.appendChild(overlay);

    expect(isNodeEmpty(container)).toBe(true);
  });

  it('ignores drag anchor elements', () => {
    const container = document.createElement('div');
    const anchor = document.createElement('div');
    anchor.setAttribute('data-pe-drag-anchor', 'true');
    container.appendChild(anchor);

    expect(isNodeEmpty(container)).toBe(true);
  });

  it('treats text content as non-empty', () => {
    const container = document.createElement('div');
    container.textContent = 'Hello';

    expect(isNodeEmpty(container)).toBe(false);
  });

  it('returns false when a non-injected child element exists', () => {
    const container = document.createElement('div');
    container.appendChild(document.createElement('span'));

    expect(isNodeEmpty(container)).toBe(false);
  });

  it('returns true for a completely empty element', () => {
    const container = document.createElement('div');

    expect(isNodeEmpty(container)).toBe(true);
  });

  it('returns true when only whitespace text content exists', () => {
    const container = document.createElement('div');
    container.textContent = '   ';

    expect(isNodeEmpty(container)).toBe(true);
  });
});

describe('isEditorInjectedElement', () => {
  it('returns false for a plain element', () => {
    expect(isEditorInjectedElement(document.createElement('div'))).toBe(false);
  });
});
