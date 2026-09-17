import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

export interface ParamFieldEditorProps {
  param: { name: string; type: string; required?: boolean };
  value: unknown;
  onCommit: (val: unknown) => void;
  label: string;
}

export const ParamFieldEditor: React.FC<ParamFieldEditorProps> = React.memo(
  ({ param, value, onCommit, label }) => {
    const isJsonType =
      param.type.includes("Record") ||
      param.type.includes("object") ||
      (typeof value === "object" && value !== null);

    const formatInitial = (val: unknown) => {
      if (typeof val === "object" && val !== null) {
        try {
          return JSON.stringify(val, null, 2);
        } catch {
          return "{}";
        }
      }
      return val !== undefined ? String(val) : "";
    };

    const [text, setText] = useState<string>(() => formatInitial(value));
    const isFocusedRef = useRef(false);
    const commitTimerRef = useRef<NodeJS.Timeout | null>(null);
    const latestTextRef = useRef(text);
    latestTextRef.current = text;
    const onCommitRef = useRef(onCommit);
    onCommitRef.current = onCommit;

    // Sync from parent only when not actively focused / typing
    useEffect(() => {
      if (!isFocusedRef.current) {
        const nextVal = formatInitial(value);
        setText(nextVal);
        latestTextRef.current = nextVal;
      }
    }, [value]);

    const commit = useCallback(
      (currentText: string) => {
        if (isJsonType) {
          try {
            const parsed = JSON.parse(currentText);
            onCommitRef.current(parsed);
          } catch {
            onCommitRef.current(currentText);
          }
        } else if (param.type === "number") {
          const n = Number(currentText);
          onCommitRef.current(isNaN(n) ? 0 : n);
        } else {
          onCommitRef.current(currentText);
        }
      },
      [isJsonType, param.type],
    );

    // Flush on unmount so no parameter values are lost
    useEffect(() => {
      return () => {
        if (commitTimerRef.current) {
          clearTimeout(commitTimerRef.current);
          commitTimerRef.current = null;
          commit(latestTextRef.current);
        }
      };
    }, [commit]);

    const handleChange = (newText: string) => {
      setText(newText);
      latestTextRef.current = newText;
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
      }
      commitTimerRef.current = setTimeout(() => {
        commit(newText);
      }, 350);
    };

    const handleBlur = () => {
      isFocusedRef.current = false;
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      commit(text);
    };

    const handlePrettify = () => {
      try {
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, 2);
        setText(formatted);
        latestTextRef.current = formatted;
        onCommitRef.current(parsed);
      } catch {}
    };

    return (
      <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/20 border border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-foreground">
              {param.name}
            </span>
            {param.required && <span className="text-red-500 text-xs">*</span>}
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
              {param.type || "string"}
            </Badge>
          </div>
          {isJsonType && (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handlePrettify}
            >
              <Sparkles size={10} /> Prettify JSON
            </Button>
          )}
        </div>

        {isJsonType ? (
          <Textarea
            value={text}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={handleBlur}
            onChange={(e) => handleChange(e.target.value)}
            rows={4}
            className="font-mono text-xs bg-background/80 resize-y"
            placeholder='{"key": "value"}'
          />
        ) : param.type === "number" ? (
          <Input
            type="number"
            value={text}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={handleBlur}
            onChange={(e) => handleChange(e.target.value)}
            className="h-8 font-mono text-xs bg-background/80"
          />
        ) : (
          <Input
            value={text}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={handleBlur}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`e.g. ${param.name === "key" ? `${label.toLowerCase()}:1001` : "value"}`}
            className="h-8 font-mono text-xs bg-background/80"
          />
        )}
      </div>
    );
  },
);

ParamFieldEditor.displayName = "ParamFieldEditor";
