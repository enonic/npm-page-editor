import {type IncomingMessage, type OutgoingMessage, type PageDescriptor} from './messages';
import {type ComponentPath, fromString, root} from './path';

function asPath(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

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

  it('update-text-component carries path and html', () => {
    const msg: IncomingMessage = {type: 'update-text-component', path: root(), html: '<p>hi</p>'};

    if (msg.type === 'update-text-component') {
      expect(msg.path).toBe('/');
      expect(msg.html).toBe('<p>hi</p>');
    }
  });

  it('includes all 14 variants', () => {
    const types: IncomingMessage['type'][] = [
      'init',
      'select',
      'deselect',
      'load',
      'set-component-state',
      'page-state',
      'set-lock',
      'set-modify-allowed',
      'set-theme',
      'create-draggable',
      'destroy-draggable',
      'set-draggable-visible',
      'page-controllers',
      'update-text-component',
    ];
    expect(types).toHaveLength(14);
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

describe('PageDescriptor', () => {
  it('accepts optional type on entries', () => {
    const page: PageDescriptor = {
      components: {
        '/main/0': {type: 'part', descriptor: 'app:hello'},
        '/main/1': {type: 'layout', descriptor: 'app:two-col'},
        '/main/2': {type: 'fragment', fragment: 'abc123'},
        '/main/3': {type: 'text', name: 'caption'},
      },
    };

    expect(page.components['/main/0'].type).toBe('part');
    expect(page.components['/main/1'].type).toBe('layout');
  });

  it('accepts optional configHash on entries', () => {
    const page: PageDescriptor = {
      components: {
        '/main/0': {type: 'part', descriptor: 'app:hello', configHash: 'abc123'},
      },
    };

    expect(page.components['/main/0'].configHash).toBe('abc123');
  });

  it('accepts optional syncId on the page-descriptor', () => {
    const page: PageDescriptor = {components: {}, syncId: 42};

    expect(page.syncId).toBe(42);
  });
});

describe('syncId on outgoing mutations', () => {
  it('move / add / remove / drag-dropped carry optional syncId', () => {
    const move: OutgoingMessage = {type: 'move', from: root(), to: asPath('/main/0'), syncId: 1};
    const add: OutgoingMessage = {type: 'add', path: asPath('/main/0'), componentType: 'part', syncId: 2};
    const remove: OutgoingMessage = {type: 'remove', path: asPath('/main/0'), syncId: 3};
    const dropped: OutgoingMessage = {type: 'drag-dropped', from: root(), to: asPath('/main/0'), syncId: 4};

    if (move.type === 'move') expect(move.syncId).toBe(1);
    if (add.type === 'add') expect(add.syncId).toBe(2);
    if (remove.type === 'remove') expect(remove.syncId).toBe(3);
    if (dropped.type === 'drag-dropped') expect(dropped.syncId).toBe(4);
  });
});
