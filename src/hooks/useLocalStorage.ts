import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Get from local storage then
  // parse stored json or if none return initialValue
  const lastSerializedRef = useRef<string | null>(null);
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      lastSerializedRef.current = item;
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setStoredValue((current) => {
          const valueToStore =
            value instanceof Function ? value(current) : value;
          if (Object.is(valueToStore, current)) {
            return current;
          }
          return valueToStore;
        });
      } catch (error) {
        console.log(error);
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const serialized = JSON.stringify(storedValue);
      if (serialized === lastSerializedRef.current) {
        return;
      }

      window.localStorage.setItem(key, serialized);
      lastSerializedRef.current = serialized;
      window.dispatchEvent(
        new CustomEvent("local-storage-update", { detail: { key } }),
      );
      window.dispatchEvent(new Event("local-storage"));
    } catch (error) {
      console.log(error);
    }
  }, [key, storedValue]);

  useEffect(() => {
    const handleStorageChange = (event: Event) => {
      if (
        event.type === "local-storage-update" &&
        (event as CustomEvent).detail?.key !== key
      ) {
        return;
      }
      try {
        const item = window.localStorage.getItem(key);
        if (item === lastSerializedRef.current) {
          return;
        }
        lastSerializedRef.current = item;
        setStoredValue(item ? JSON.parse(item) : initialValue);
      } catch (error) {
        console.log(error);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("local-storage-update", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("local-storage-update", handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue] as const;
}
