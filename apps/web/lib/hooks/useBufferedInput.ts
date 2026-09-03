"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook to provide instant local typing feedback for input/textarea controls
 * while debouncing expensive store commits (e.g. pushHistorySnapshot, database sync).
 *
 * Automatically flushes pending changes on blur or unmount.
 */
export function useBufferedInput<T>(
  externalValue: T,
  onCommit: (val: T) => void,
  delay = 300,
) {
  const [localValue, setLocalValue] = useState<T>(externalValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestValueRef = useRef<T>(localValue);
  latestValueRef.current = localValue;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Sync if external value changes (e.g. user selected another endpoint or undo/redo)
  const prevExternalRef = useRef<T>(externalValue);
  useEffect(() => {
    if (externalValue !== prevExternalRef.current) {
      prevExternalRef.current = externalValue;
      setLocalValue(externalValue);
    }
  }, [externalValue]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (latestValueRef.current !== prevExternalRef.current) {
      prevExternalRef.current = latestValueRef.current;
      onCommitRef.current(latestValueRef.current);
    }
  }, []);

  const handleChange = useCallback(
    (newVal: T) => {
      setLocalValue(newVal);
      latestValueRef.current = newVal;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (latestValueRef.current !== prevExternalRef.current) {
          prevExternalRef.current = latestValueRef.current;
          onCommitRef.current(latestValueRef.current);
        }
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        // Flush on unmount to never lose data
        onCommitRef.current(latestValueRef.current);
      }
    };
  }, []);

  return {
    value: localValue,
    setValue: setLocalValue,
    onChange: handleChange,
    flush,
  };
}
