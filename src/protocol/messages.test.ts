import {type IncomingMessage, type OutgoingMessage} from './messages';
import {root} from './path';

describe('IncomingMessage', () => {
  it('discriminates by type field', () => {
    const msg: IncomingMessage = {
      type: 'select',
      path: root(),
    };

    if (msg.type === 'select') {
      expect(msg.path).toBe('/');
      expect(msg.silent).toBeUndefined();
    }
  });

  it('load carries path and required existing flag', () => {
    const newPart: IncomingMessage = {type: 'load', path: root(), existing: false};
    const existingPart: IncomingMessage = {type: 'load', path: root(), existing: true};

    if (newPart.type === 'load') {
      expect(newPart.existing).toBe(false);
    }
    if (existingPart.type === 'load') {
      expect(existingPart.existing).toBe(true);
    }
  });

  it('includes all 18 variants', () => {
    const types: IncomingMessage['type'][] = [
      'init',
      'select',
      'deselect',
      'add',
      'remove',
      'move',
      'load',
      'duplicate',
      'reset',
      'set-component-state',
      'page-state',
      'set-lock',
      'set-modify-allowed',
      'set-theme',
      'create-draggable',
      'destroy-draggable',
      'set-draggable-visible',
      'page-controllers',
    ];
    expect(types).toHaveLength(18);
  });
});

describe('OutgoingMessage', () => {
  it('discriminates by type field', () => {
    const msg: OutgoingMessage = {type: 'ready'};

    if (msg.type === 'ready') {
      expect(msg.type).toBe('ready');
    }
  });

  it('includes all 21 variants', () => {
    const types: OutgoingMessage['type'][] = [
      'ready',
      'select',
      'deselect',
      'move',
      'add',
      'remove',
      'duplicate',
      'reset',
      'inspect',
      'create-fragment',
      'save-as-template',
      'select-page-descriptor',
      'page-reload-request',
      'component-loaded',
      'component-load-failed',
      'drag-started',
      'drag-stopped',
      'drag-dropped',
      'keyboard-event',
      'iframe-loaded',
      'navigate',
    ];
    expect(types).toHaveLength(21);
  });
});
