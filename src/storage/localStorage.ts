export function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function localStorageGet<T>(key: string): T | null {
  const cachedData = window.localStorage.getItem(key);
  return cachedData ? (JSON.parse(cachedData) as T) : null;
}

export function localStorageSet(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function localStorageRemove(key: string): void {
  window.localStorage.removeItem(key);
}
