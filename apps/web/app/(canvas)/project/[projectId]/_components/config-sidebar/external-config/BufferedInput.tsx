"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

interface BufferedInputProps
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
      debounceMs = 250,
      transformValue,
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

    useEffect(() => {
      const incoming = value !== undefined && value !== null ? String(value) : "";
      if (incoming !== lastCommittedRef.current) {
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

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
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
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  },
);
BufferedInput.displayName = "BufferedInput";

interface BufferedTextareaProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value?: string;
  onCommit: (val: string) => void;
  debounceMs?: number;
}

export const BufferedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  BufferedTextareaProps
>(({ value, onCommit, debounceMs = 250, onBlur, ...props }, ref) => {
  const [localValue, setLocalValue] = useState<string>(value || "");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const latestValueRef = useRef(localValue);
  latestValueRef.current = localValue;
  const lastCommittedRef = useRef(value || "");

  useEffect(() => {
    const incoming = value || "";
    if (incoming !== lastCommittedRef.current) {
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

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    flush();
    onBlur?.(e);
  };

  return (
    <Textarea
      ref={ref}
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
});
BufferedTextarea.displayName = "BufferedTextarea";
