import {useEffect, useState} from 'react';

import type {ReadableAtom} from 'nanostores';

export function useStoreValue<T>(store: ReadableAtom<T>): T {
  const [value, setValue] = useState(store.get());

  useEffect(() => store.subscribe(setValue), [store]);

  return value;
}
