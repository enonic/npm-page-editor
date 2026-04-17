import {err, isErr, isOk, ok, type Result} from './result';

describe('Result', () => {
  describe('ok', () => {
    it('creates a success result', () => {
      const result = ok(42);
      expect(result).toEqual({ok: true, value: 42});
    });

    it('narrows to value in ok branch', () => {
      const result: Result<number> = ok(42);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('err', () => {
    it('creates a failure result', () => {
      const result = err('something went wrong');
      expect(result).toEqual({ok: false, error: 'something went wrong'});
    });

    it('narrows to error in err branch', () => {
      const result: Result<number> = err('fail');
      if (isErr(result)) {
        expect(result.error).toBe('fail');
      }
    });
  });

  describe('type narrowing', () => {
    it('discriminates via ok field', () => {
      function tryParse(input: string): Result<number> {
        const n = Number(input);
        if (Number.isNaN(n)) return err('not a number');
        return ok(n);
      }

      const success = tryParse('42');
      expect(success.ok).toBe(true);
      if (isOk(success)) expect(success.value).toBe(42);

      const failure = tryParse('abc');
      expect(failure.ok).toBe(false);
      if (isErr(failure)) expect(failure.error).toBe('not a number');
    });
  });
});
