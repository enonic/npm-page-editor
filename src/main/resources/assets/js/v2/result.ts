export type OkResult<T> = {ok: true; value: T};
export type ErrResult<E = string> = {ok: false; error: E};
export type Result<T, E = string> = OkResult<T> | ErrResult<E>;

export function ok<T>(value: T): Result<T, never> {
  return {ok: true, value};
}

export function err<E = string>(error: E): Result<never, E> {
  return {ok: false, error};
}

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return !result.ok;
}
