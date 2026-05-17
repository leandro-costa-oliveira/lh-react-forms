import { ensureIndexedDbAvailable, hasIndexedDb, indexedDbGet, indexedDbRemove, indexedDbSet } from "./indexedDb";
import { hasLocalStorage, localStorageGet, localStorageRemove, localStorageSet } from "./localStorage";
import type { PersistBackend, PersistStorage, PersistStorageOptions } from "./types";

export function createPersistStorage(key: string, options: PersistStorageOptions = {}): PersistStorage {
  let activeBackend: PersistBackend | null = null;
  let backendPromise: Promise<PersistBackend> | null = null;
  let warnedFallback = false;
  let writeQueue = Promise.resolve();

  const warnFallback = (reason: unknown) => {
    if (warnedFallback) {
      return;
    }

    warnedFallback = true;
    options.onFallback?.(
      `IndexedDB indisponível para "${key}". Usando localStorage como fallback. ${stringifyError(reason)}`,
    );
  };

  const getBackend = async (): Promise<PersistBackend> => {
    if (activeBackend) {
      return activeBackend;
    }

    if (backendPromise) {
      return backendPromise;
    }

    backendPromise = (async () => {
      if (hasIndexedDb()) {
        try {
          await ensureIndexedDbAvailable();
          activeBackend = "indexedDB";
          return activeBackend;
        } catch (error) {
          if (hasLocalStorage()) {
            activeBackend = "localStorage";
            warnFallback(error);
            return activeBackend;
          }

          throw error;
        }
      }

      if (hasLocalStorage()) {
        activeBackend = "localStorage";
        warnFallback(new Error("IndexedDB não está disponível neste ambiente."));
        return activeBackend;
      }

      throw new Error("Nenhum mecanismo de persistência está disponível neste ambiente.");
    })();

    try {
      return await backendPromise;
    } finally {
      if (!activeBackend) {
        backendPromise = null;
      }
    }
  };

  const withFallback = async <T>(operation: (backend: PersistBackend) => Promise<T>): Promise<T> => {
    const backend = await getBackend();

    if (backend === "localStorage") {
      return operation(backend);
    }

    try {
      return await operation(backend);
    } catch (error) {
      if (!hasLocalStorage()) {
        throw error;
      }

      activeBackend = "localStorage";
      backendPromise = Promise.resolve(activeBackend);
      warnFallback(error);
      return operation(activeBackend);
    }
  };

  return {
    load: <T>() =>
      withFallback(async (backend) => {
        if (backend === "indexedDB") {
          return (await indexedDbGet<T>(key)) ?? null;
        }

        return localStorageGet<T>(key);
      }),
    save: (value: unknown) => {
      writeQueue = writeQueue.then(() =>
        withFallback(async (backend) => {
          if (backend === "indexedDB") {
            await indexedDbSet(key, value);
            return;
          }

          localStorageSet(key, value);
        }),
      );

      return writeQueue;
    },
    remove: () => {
      writeQueue = writeQueue.then(() =>
        withFallback(async (backend) => {
          if (backend === "indexedDB") {
            await indexedDbRemove(key);
            return;
          }

          localStorageRemove(key);
        }),
      );

      return writeQueue;
    },
  };
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
