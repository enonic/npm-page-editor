import type {ComponentPath} from '../protocol';

import {fromString} from '../protocol';
import {
  $registry,
  findRecordsByDescriptor,
  getRecord,
  removeRecord,
  setRegistry,
  updateRecord,
  type ComponentRecord,
} from './registry';

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
    fragmentContentId: undefined,
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

  describe('findRecordsByDescriptor', () => {
    it('returns empty array when registry is empty', () => {
      expect(findRecordsByDescriptor('my.app:widget')).toEqual([]);
    });

    it('returns the single matching record', () => {
      const p = path('/main/0');
      setRegistry({[p]: makeRecord(p, {descriptor: 'my.app:widget'})});

      const found = findRecordsByDescriptor('my.app:widget');

      expect(found).toHaveLength(1);
      expect(found[0]?.path).toBe(p);
    });

    it('returns all records sharing a descriptor', () => {
      const p1 = path('/main/0');
      const p2 = path('/main/1');
      const p3 = path('/main/2');
      setRegistry({
        [p1]: makeRecord(p1, {descriptor: 'my.app:widget'}),
        [p2]: makeRecord(p2, {descriptor: 'my.app:widget'}),
        [p3]: makeRecord(p3, {descriptor: 'my.app:other'}),
      });

      const found = findRecordsByDescriptor('my.app:widget');
      const paths = found.map(r => r.path).sort();

      expect(paths).toEqual([p1, p2].sort());
    });

    it('returns empty array when no record matches the descriptor', () => {
      const p = path('/main/0');
      setRegistry({[p]: makeRecord(p, {descriptor: 'my.app:widget'})});

      expect(findRecordsByDescriptor('my.app:missing')).toEqual([]);
    });

    it('skips records with undefined descriptor', () => {
      const p1 = path('/main/0');
      const p2 = path('/main/1');
      setRegistry({
        [p1]: makeRecord(p1, {descriptor: undefined}),
        [p2]: makeRecord(p2, {descriptor: 'my.app:widget'}),
      });

      const found = findRecordsByDescriptor('my.app:widget');

      expect(found).toHaveLength(1);
      expect(found[0]?.path).toBe(p2);
    });
  });
});
