import { BackendNode, CompiledFile, BrowserStorageKey } from "@workspace/canvas/types";

/**
 * Generates client-side browser storage helpers and React hooks for Next.js web applications.
 * Handles localStorage and sessionStorage with SSR safety, JSON parsing, and reactive updates.
 * Strictly adheres to typed definitions without any, unknown, or as type assertions.
 */
export function generateBrowserStorageHelper(
  storageNodes: BackendNode[],
): CompiledFile {
  const allDefinedKeys: Array<{
    storageName: string;
    engine: "localStorage" | "sessionStorage";
    namespace?: string;
    key: BrowserStorageKey;
  }> = [];

  storageNodes.forEach((node) => {
    const sName = node.data?.storageName || node.data?.label || "BrowserStorage";
    const engine: "localStorage" | "sessionStorage" =
      node.data?.storageEngine === "sessionStorage" ? "sessionStorage" : "localStorage";
    const namespace = node.data?.namespace || "";
    const keys: BrowserStorageKey[] = node.data?.keys || [];
    keys.forEach((k) => {
      allDefinedKeys.push({
        storageName: sName,
        engine,
        namespace,
        key: k,
      });
    });
  });

  const content = `"use client";

import { useState, useEffect, useCallback } from "react";

export type StorageEngine = "localStorage" | "sessionStorage";

export type StoragePrimitive = string | number | boolean | null;

export type StorageRecord = { [key: string]: StoragePrimitive | StoragePrimitive[] };

export type StorageValue =
  | StoragePrimitive
  | StoragePrimitive[]
  | StorageRecord;

export interface StorageDetail {
  engine: StorageEngine;
  key: string | null;
  value: StorageValue | null;
}

/** Custom event dispatched when browser storage is modified locally */
const STORAGE_CHANGE_EVENT = "dezign2app-browser-storage-change";

/**
 * Safely reads a raw string from localStorage or sessionStorage with SSR protection.
 */
export function getBrowserStorageItem(
  engine: StorageEngine,
  key: string,
  defaultValue?: string,
): string | null {
  if (typeof window === "undefined") return defaultValue ?? null;
  try {
    const storage = window[engine];
    if (!storage) return defaultValue ?? null;
    const raw = storage.getItem(key);
    if (raw === null) return defaultValue ?? null;
    return raw;
  } catch (err) {
    console.warn(\`[BrowserStorage] Error reading key "\${key}":\`, err);
    return defaultValue ?? null;
  }
}

/**
 * Safely reads and parses a JSON or primitive value from storage with SSR protection.
 */
export function getBrowserStorageJson(
  engine: StorageEngine,
  key: string,
  defaultValue: StorageValue = null,
): StorageValue {
  if (typeof window === "undefined") return defaultValue;
  try {
    const storage = window[engine];
    if (!storage) return defaultValue;
    const raw = storage.getItem(key);
    if (raw === null) return defaultValue;
    const parsed: StorageValue = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.warn(\`[BrowserStorage] Error parsing JSON for key "\${key}":\`, err);
    return defaultValue;
  }
}

/**
 * Safely writes a value to localStorage or sessionStorage and notifies active hooks.
 */
export function setBrowserStorageItem(
  engine: StorageEngine,
  key: string,
  value: StorageValue,
): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window[engine];
    if (!storage) return;
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    storage.setItem(key, serialized);
    const detail: StorageDetail = { engine, key, value };
    window.dispatchEvent(
      new CustomEvent(STORAGE_CHANGE_EVENT, { detail }),
    );
  } catch (err) {
    console.error(\`[BrowserStorage] Error setting key "\${key}":\`, err);
  }
}

/**
 * Safely removes a specific key from localStorage or sessionStorage.
 */
export function removeBrowserStorageItem(
  engine: StorageEngine,
  key: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window[engine];
    if (!storage) return;
    storage.removeItem(key);
    const detail: StorageDetail = { engine, key, value: null };
    window.dispatchEvent(
      new CustomEvent(STORAGE_CHANGE_EVENT, { detail }),
    );
  } catch (err) {
    console.error(\`[BrowserStorage] Error removing key "\${key}":\`, err);
  }
}

/**
 * Clears all keys from localStorage or sessionStorage.
 */
export function clearBrowserStorage(engine: StorageEngine): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window[engine];
    if (!storage) return;
    storage.clear();
    const detail: StorageDetail = { engine, key: null, value: null };
    window.dispatchEvent(
      new CustomEvent(STORAGE_CHANGE_EVENT, { detail }),
    );
  } catch (err) {
    console.error(\`[BrowserStorage] Error clearing storage:\`, err);
  }
}

/**
 * Toggles a boolean value in storage.
 */
export function toggleBrowserStorageItem(
  engine: StorageEngine,
  key: string,
  defaultCurrent = false,
): boolean {
  const current = getBrowserStorageItem(engine, key);
  const isCurrentTrue = current === null ? defaultCurrent : current === "true";
  const next = !isCurrentTrue;
  setBrowserStorageItem(engine, key, next ? "true" : "false");
  return next;
}

/**
 * Appends an item to an array stored in storage.
 */
export function appendBrowserStorageItem(
  engine: StorageEngine,
  key: string,
  item: StoragePrimitive,
): StoragePrimitive[] {
  const raw = getBrowserStorageItem(engine, key);
  let list: StoragePrimitive[] = [];
  if (raw !== null && raw.length > 0) {
    try {
      const parsed: StorageValue = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (elem): elem is StoragePrimitive =>
            typeof elem === "string" ||
            typeof elem === "number" ||
            typeof elem === "boolean" ||
            elem === null,
        );
      } else {
        list = [raw];
      }
    } catch {
      list = [raw];
    }
  }
  const nextList = [...list, item];
  setBrowserStorageItem(engine, key, JSON.stringify(nextList));
  return nextList;
}

type UpdaterFn<T> = (prev: T) => T;

function isUpdaterFunction<T>(
  valueOrFn: T | UpdaterFn<T>,
): valueOrFn is UpdaterFn<T> {
  return typeof valueOrFn === "function";
}

/**
 * Reactive React hook to observe and update a browser storage key.
 */
export function useBrowserStorage(
  engine: StorageEngine,
  key: string,
  initialValue: string = "",
): [string, (val: string | ((prev: string) => string)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<string>(() => {
    const item = getBrowserStorageItem(engine, key, initialValue);
    return item ?? initialValue;
  });

  useEffect(() => {
    const item = getBrowserStorageItem(engine, key, initialValue);
    setStoredValue(item ?? initialValue);

    const handleStorageChange = (e: Event) => {
      if (e instanceof CustomEvent) {
        const detail: StorageDetail = e.detail;
        if (
          detail &&
          detail.engine === engine &&
          (detail.key === key || detail.key === null)
        ) {
          const updated = getBrowserStorageItem(engine, key, initialValue);
          setStoredValue(updated ?? initialValue);
        }
      } else if (e instanceof StorageEvent) {
        const expectedArea =
          engine === "sessionStorage"
            ? window.sessionStorage
            : window.localStorage;
        if (e.key === key && e.storageArea === expectedArea) {
          const updated = getBrowserStorageItem(engine, key, initialValue);
          setStoredValue(updated ?? initialValue);
        }
      }
    };

    window.addEventListener(STORAGE_CHANGE_EVENT, handleStorageChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT, handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [engine, key, initialValue]);

  const setValue = useCallback(
    (valueOrFn: string | ((prev: string) => string)) => {
      setStoredValue((prev) => {
        const next = isUpdaterFunction(valueOrFn) ? valueOrFn(prev) : valueOrFn;
        setBrowserStorageItem(engine, key, next);
        return next;
      });
    },
    [engine, key],
  );

  const removeValue = useCallback(() => {
    removeBrowserStorageItem(engine, key);
    setStoredValue(initialValue);
  }, [engine, key, initialValue]);

  return [storedValue, setValue, removeValue];
}
`;

  return {
    filename: "lib/storage/browserStorage.ts",
    language: "typescript",
    content,
  };
}
