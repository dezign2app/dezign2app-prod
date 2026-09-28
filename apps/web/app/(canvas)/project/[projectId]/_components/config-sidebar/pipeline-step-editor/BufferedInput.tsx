"use client";

import React from "react";
import {
  LocalInput,
  LocalTextarea,
  LocalInputProps,
  LocalTextareaProps,
} from "../../backend-nodes/graph-nodes/shared";

export { LocalInput, LocalTextarea };
export type { LocalInputProps, LocalTextareaProps };

export interface BufferedInputProps
  extends Omit<LocalInputProps, "value" | "onChange"> {
  value?: string | number;
  onCommit?: (val: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  debounceMs?: number;
  transformValue?: (val: string) => string;
}

export const BufferedInput = React.forwardRef<HTMLInputElement, BufferedInputProps>(
  (
    {
      value,
      onCommit,
      onChange,
      debounceMs = 150,
      transformValue,
      ...props
    },
    ref,
  ) => {
    return (
      <LocalInput
        ref={ref}
        {...props}
        value={value !== undefined && value !== null ? String(value) : ""}
        debounceMs={debounceMs}
        onChange={(e) => {
          let next = e.target.value;
          if (transformValue) {
            next = transformValue(next);
          }
          if (onCommit) {
            onCommit(next);
          }
          if (onChange) {
            onChange(e);
          }
        }}
      />
    );
  },
);
BufferedInput.displayName = "BufferedInput";

export interface BufferedTextareaProps
  extends Omit<LocalTextareaProps, "value" | "onChange"> {
  value?: string;
  onCommit?: (val: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  debounceMs?: number;
}

export const BufferedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  BufferedTextareaProps
>(({ value, onCommit, onChange, debounceMs = 200, ...props }, ref) => {
  return (
    <LocalTextarea
      ref={ref}
      {...props}
      value={value || ""}
      debounceMs={debounceMs}
      onChange={(e) => {
        if (onCommit) {
          onCommit(e.target.value);
        }
        if (onChange) {
          onChange(e);
        }
      }}
    />
  );
});
BufferedTextarea.displayName = "BufferedTextarea";
