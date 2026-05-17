export type PersistStorage = {
  load<T>(): Promise<T | null>;
  save(value: unknown): Promise<void>;
  remove(): Promise<void>;
};

export type PersistBackend = "indexedDB" | "localStorage";

export type PersistStorageOptions = {
  onFallback?: (message: string) => void;
};
