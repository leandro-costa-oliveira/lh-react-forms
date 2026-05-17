import "fake-indexeddb/auto";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const INDEXED_DB_NAME = "lh-react-forms";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(async () => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  await deleteDatabase(INDEXED_DB_NAME);
  vi.restoreAllMocks();
});

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete IndexedDB database: ${name}`));
    request.onblocked = () => resolve();
  });
}
