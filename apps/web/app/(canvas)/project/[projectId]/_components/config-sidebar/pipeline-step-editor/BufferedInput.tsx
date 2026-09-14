"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

export interface BufferedInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value?: string | number;
  onCommit: (val: string) => void;
  debounceMs?: number;
  transformValue?: (val: string) => string;
}

export const BufferedInput = React.forwardRef<HTMLInputElement, BufferedInputProps>(
  (
    {
      value,
      onCommit,
      debounceMs = 300,
      transformValue,
      onFocus,
      onBlur,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const [localValue, setLocalValue] = useState<string>(
      value !== undefined && value !== null ? String(value) : "",
    );
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const onCommitRef = useRef(onCommit);
    onCommitRef.current = onCommit;
    const latestValueRef = useRef(localValue);
    latestValueRef.current = localValue;
    const lastCommittedRef = useRef(
      value !== undefined && value !== null ? String(value) : "",
    );
    const isFocusedRef = useRef(false);

    useEffect(() => {
      const incoming = value !== undefined && value !== null ? String(value) : "";
      if (!isFocusedRef.current && incoming !== lastCommittedRef.current) {
        lastCommittedRef.current = incoming;
        setLocalValue(incoming);
      }
    }, [value]);

    const flush = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (latestValueRef.current !== lastCommittedRef.current) {
        lastCommittedRef.current = latestValueRef.current;
        onCommitRef.current(latestValueRef.current);
      }
    }, []);

    // Flush pending changes on unmount so no input is lost
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
          if (latestValueRef.current !== lastCommittedRef.current) {
            onCommitRef.current(latestValueRef.current);
          }
        }
      };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let next = e.target.value;
      if (transformValue) {
        next = transformValue(next);
      }
      setLocalValue(next);
      latestValueRef.current = next;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (latestValueRef.current !== lastCommittedRef.current) {
          lastCommittedRef.current = latestValueRef.current;
          onCommitRef.current(latestValueRef.current);
        }
      }, debounceMs);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      flush();
      onBlur?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        flush();
      }
      onKeyDown?.(e);
    };

    return (
      <Input
        ref={ref}
        {...props}
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  },
);
BufferedInput.displayName = "BufferedInput";

export interface BufferedTextareaProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value?: string;
  onCommit: (val: string) => void;
  debounceMs?: number;
}

export const BufferedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  BufferedTextareaProps
>(({ value, onCommit, debounceMs = 300, onFocus, onBlur, ...props }, ref) => {
  const [localValue, setLocalValue] = useState<string>(value || "");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const latestValueRef = useRef(localValue);
  latestValueRef.current = localValue;
  const lastCommittedRef = useRef(value || "");
  const isFocusedRef = useRef(false);

  useEffect(() => {
    const incoming = value || "";
    if (!isFocusedRef.current && incoming !== lastCommittedRef.current) {
      lastCommittedRef.current = incoming;
      setLocalValue(incoming);
    }
  }, [value]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (latestValueRef.current !== lastCommittedRef.current) {
      lastCommittedRef.current = latestValueRef.current;
      onCommitRef.current(latestValueRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        if (latestValueRef.current !== lastCommittedRef.current) {
          onCommitRef.current(latestValueRef.current);
        }
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setLocalValue(next);
    latestValueRef.current = next;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (latestValueRef.current !== lastCommittedRef.current) {
        lastCommittedRef.current = latestValueRef.current;
        onCommitRef.current(latestValueRef.current);
      }
    }, debounceMs);
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    isFocusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    isFocusedRef.current = false;
    flush();
    onBlur?.(e);
  };

  return (
    <Textarea
      ref={ref}
      {...props}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
});
BufferedTextarea.displayName = "BufferedTextarea";
