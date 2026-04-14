import type {ComponentPath} from '../protocol';

import {fromString} from '../protocol';
import {$registry, getRecord, removeRecord, setRegistry, updateRecord, type ComponentRecord} from './registry';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeRecord(p: ComponentPath, overrides?: Partial<ComponentRecord>): ComponentRecord {
  return {
    path: p,
    type: 'part',
    element: undefined,
    parentPath: undefined,
    children: [],
    empty: false,
    error: false,
    descriptor: undefined,
    loading: false,
    ...overrides,
  };
}

describe('registry', () => {
  beforeEach(() => {
    $registry.set({});
  });

  describe('setRegistry / getRecord', () => {
    it('sets all records and retrieves them', () => {
      const p = path('/main/0');
      const record = makeRecord(p);

      setRegistry({[p]: record});

      expect(getRecord(p)).toBe(record);
    });

    it('returns undefined for unknown path', () => {
      expect(getRecord(path('/main/0'))).toBeUndefined();
    });
  });

  describe('updateRecord', () => {
    it('merges partial fields into existing record', () => {
      const p = path('/main/0');
      setRegistry({[p]: makeRecord(p)});

      updateRecord(p, {loading: true, descriptor: 'my.app:widget'});

      const updated = getRecord(p);
      expect(updated?.loading).toBe(true);
      expect(updated?.descriptor).toBe('my.app:widget');
      expect(updated?.empty).toBe(false);
    });

    it('is no-op for unknown path', () => {
      const p = path('/main/0');
      updateRecord(p, {loading: true});

      expect(getRecord(p)).toBeUndefined();
    });
  });

  describe('removeRecord', () => {
    it('deletes record from registry', () => {
      const p1 = path('/main/0');
      const p2 = path('/main/1');
      setRegistry({[p1]: makeRecord(p1), [p2]: makeRecord(p2)});

      removeRecord(p1);

      expect(getRecord(p1)).toBeUndefined();
      expect(getRecord(p2)).toBeDefined();
    });

    it('is no-op for unknown path', () => {
      const p = path('/main/0');
      setRegistry({[p]: makeRecord(p)});

      removeRecord(path('/main/1'));

      expect(getRecord(p)).toBeDefined();
    });
  });
});
