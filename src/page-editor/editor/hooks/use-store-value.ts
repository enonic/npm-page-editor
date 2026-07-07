import {useEffect, useState} from 'preact/hooks';

interface ReadableStore<T> {
    get(): T;
    subscribe(listener: (value: T) => void): () => void;
}

export function useStoreValue<T>(store: ReadableStore<T>): T {
    const [value, setValue] = useState(store.get());

    useEffect(() => store.subscribe(setValue), [store]);

    return value;
}
