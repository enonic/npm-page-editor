import type {ComponentPath} from '../protocol';
import type {ActionContext} from './resolve';

import {fromString} from '../protocol';
import {resolveActions} from './resolve';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeContext(overrides?: Partial<ActionContext>): ActionContext {
  return {
    type: 'part',
    path: path('/main/0'),
    empty: false,
    error: false,
    locked: false,
    modifyAllowed: true,
    fragment: false,
    fragmentAllowed: true,
    resetEnabled: true,
    pageTemplate: false,
    hasParentLayout: false,
    isTopFragment: false,
    ...overrides,
  };
}

function actionIds(context: ActionContext): string[] {
  return resolveActions(context).map(a => a.id);
}

function childIds(context: ActionContext, parentId: string): string[] {
  const action = resolveActions(context).find(a => a.id === parentId);
  return action?.children?.map(c => c.id) ?? [];
}

describe('resolveActions', () => {
  //
  // * Locked page
  //

  describe('locked page', () => {
    it('returns only page-settings', () => {
      const ctx = makeContext({type: 'page', path: path('/'), locked: true});
      expect(actionIds(ctx)).toEqual(['page-settings']);
    });
  });

  //
  // * Page
  //

  describe('page', () => {
    it('returns inspect, reset, save-as-template', () => {
      const ctx = makeContext({type: 'page', path: path('/'), resetEnabled: true, pageTemplate: false});
      expect(actionIds(ctx)).toEqual(['inspect', 'reset', 'save-as-template']);
    });

    it('omits reset when resetEnabled is false', () => {
      const ctx = makeContext({type: 'page', path: path('/'), resetEnabled: false});
      expect(actionIds(ctx)).not.toContain('reset');
    });

    it('omits save-as-template when pageTemplate is true', () => {
      const ctx = makeContext({type: 'page', path: path('/'), pageTemplate: true});
      expect(actionIds(ctx)).not.toContain('save-as-template');
    });
  });

  //
  // * Region
  //

  describe('region', () => {
    it('returns select-parent, insert, reset', () => {
      const ctx = makeContext({type: 'region', path: path('/main')});
      expect(actionIds(ctx)).toEqual(['select-parent', 'insert', 'reset']);
    });

    it('omits reset when empty', () => {
      const ctx = makeContext({type: 'region', path: path('/main'), empty: true});
      expect(actionIds(ctx)).not.toContain('reset');
    });

    it('includes all insert children by default', () => {
      const ctx = makeContext({type: 'region', path: path('/main')});
      expect(childIds(ctx, 'insert')).toEqual(['insert-part', 'insert-layout', 'insert-text', 'insert-fragment']);
    });

    it('omits insert-layout when hasParentLayout', () => {
      const ctx = makeContext({type: 'region', path: path('/main'), hasParentLayout: true});
      expect(childIds(ctx, 'insert')).not.toContain('insert-layout');
    });
  });

  //
  // * Component
  //

  describe('component (part)', () => {
    it('returns full action list', () => {
      const ctx = makeContext();
      expect(actionIds(ctx)).toEqual([
        'select-parent',
        'insert',
        'inspect',
        'reset',
        'remove',
        'duplicate',
        'create-fragment',
      ]);
    });

    it('omits reset when empty', () => {
      const ctx = makeContext({empty: true});
      expect(actionIds(ctx)).not.toContain('reset');
    });

    it('omits remove when isTopFragment', () => {
      const ctx = makeContext({isTopFragment: true});
      expect(actionIds(ctx)).not.toContain('remove');
    });

    it('omits create-fragment when fragmentAllowed is false', () => {
      const ctx = makeContext({fragmentAllowed: false});
      expect(actionIds(ctx)).not.toContain('create-fragment');
    });

    it('omits create-fragment when hasParentLayout', () => {
      const ctx = makeContext({hasParentLayout: true});
      expect(actionIds(ctx)).not.toContain('create-fragment');
    });

    it('omits insert-layout from submenu when hasParentLayout', () => {
      const ctx = makeContext({hasParentLayout: true});
      expect(childIds(ctx, 'insert')).not.toContain('insert-layout');
    });
  });

  describe('component (layout)', () => {
    it('returns expected actions for layout', () => {
      const ctx = makeContext({type: 'layout'});
      expect(actionIds(ctx)).toContain('inspect');
      expect(actionIds(ctx)).toContain('duplicate');
    });
  });

  describe('component (text)', () => {
    it('returns expected actions for text', () => {
      const ctx = makeContext({type: 'text'});
      expect(actionIds(ctx)).toContain('inspect');
      expect(actionIds(ctx)).toContain('remove');
    });
  });

  describe('component (fragment)', () => {
    it('returns expected actions for fragment', () => {
      const ctx = makeContext({type: 'fragment'});
      expect(actionIds(ctx)).toContain('select-parent');
      expect(actionIds(ctx)).toContain('inspect');
    });
  });

  //
  // * Sort order
  //

  describe('sort order', () => {
    it('actions are in ascending sortOrder', () => {
      const ctx = makeContext();
      const actions = resolveActions(ctx);
      const orders = actions.map(a => a.sortOrder);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    });

    it('insert submenu children are in ascending sortOrder', () => {
      const ctx = makeContext();
      const insert = resolveActions(ctx).find(a => a.id === 'insert');
      const orders = insert?.children?.map(c => c.sortOrder) ?? [];
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    });
  });
});
