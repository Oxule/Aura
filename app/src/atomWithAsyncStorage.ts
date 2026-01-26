import AsyncStorage from '@react-native-async-storage/async-storage';
import { atom } from 'jotai';
import type { WritableAtom } from 'jotai';

export function atomWithAsyncStorage<T>(
    key: string,
    initialValue: T
): WritableAtom<T, [T | ((prev: T) => T)], Promise<void>> {
    const baseAtom = atom<T>(initialValue);

    baseAtom.onMount = (setAtom) => {
        let cancelled = false;
        AsyncStorage.getItem(key).then(stored => {
            if (!cancelled && stored !== null) {
                try {
                    const parsed = JSON.parse(stored);
                    setAtom(parsed);
                } catch (e) {
                    console.error("Failed to parse storage", e);
                }
            }
        });
        return () => { cancelled = true; };
    };

    const derivedAtom = atom(
        (get) => get(baseAtom),
        async (get, set, update: T | ((prev: T) => T)) => {
            const prev = get(baseAtom) as T;
            const next: T =
                typeof update === 'function' ? (update as (p: T) => T)(prev) : (update as T);

            set(baseAtom, next);

            try {
                await AsyncStorage.setItem(key, JSON.stringify(next));
            } catch (e) {
                console.error(`[atomWithAsyncStorage] write error for "${key}":`, e);
            }
        }
    );

    return derivedAtom as unknown as WritableAtom<
        T,
        [T | ((prev: T) => T)],
        Promise<void>
    >;
}
