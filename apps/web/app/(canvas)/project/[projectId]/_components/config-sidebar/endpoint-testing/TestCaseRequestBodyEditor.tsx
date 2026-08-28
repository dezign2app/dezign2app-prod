"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash, Braces, ListPlus, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { Endpoint, Parameter, JSONValue, JSONObject } from "@/types/canvas";
import { generateId } from "./utils";
import { cn } from "@workspace/ui/lib/utils";

interface FieldItem {
  id: string;
  name: string;
  type: string;
  value: string;
}

interface TestCaseRequestBodyEditorProps {
  endpoint: Endpoint;
  body: JSONValue | undefined;
  onChange: (newBody: JSONValue | undefined) => void;
}

export const TestCaseRequestBodyEditor: React.FC<TestCaseRequestBodyEditorProps> = ({
  endpoint,
  body,
  onChange,
}) => {
  const [mode, setMode] = useState<"fields" | "json">("fields");
  const [jsonString, setJsonString] = useState<string>(() => {
    if (body !== undefined && body !== null) {
      return typeof body === "string" ? body : JSON.stringify(body, null, 2);
    }
    return "{}";
  });
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Convert current body object into field rows
  const [fields, setFields] = useState<FieldItem[]>(() => {
    const list: FieldItem[] = [];
    const bodyObj: JSONObject =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as JSONObject)
        : {};

    // 1. First include all schema fields defined on the endpoint
    if (endpoint.requestBody?.fields && endpoint.requestBody.fields.length > 0) {
      endpoint.requestBody.fields.forEach((f) => {
        const fieldName = f.name || f.key;
        if (!fieldName) return;
        const val = bodyObj[fieldName];
        list.push({
          id: `f-${fieldName}`,
          name: fieldName,
          type: f.type || "string",
          value:
            val !== undefined && val !== null
              ? typeof val === "object"
                ? JSON.stringify(val)
                : String(val)
              : f.defaultValue || "",
        });
      });
    }

    // 2. Add any extra keys in body that weren't in endpoint schema
    Object.entries(bodyObj).forEach(([k, v]) => {
      if (!list.some((item) => item.name === k)) {
        list.push({
          id: `f-extra-${k}`,
          name: k,
          type: typeof v,
          value:
            v !== undefined && v !== null
              ? typeof v === "object"
                ? JSON.stringify(v)
                : String(v)
              : "",
        });
      }
    });

    return list;
  });

  // Sync json string when body prop changes externally
  useEffect(() => {
    if (body !== undefined && body !== null) {
      try {
        const formatted = typeof body === "string" ? body : JSON.stringify(body, null, 2);
        setJsonString(formatted);
      } catch {}
    }
  }, [body]);

  // Synchronize fields changes to parent body
  const notifyFieldsChange = (newFields: FieldItem[]) => {
    setFields(newFields);
    const newBodyObj: JSONObject = {};
    newFields.forEach((f) => {
      if (!f.name.trim()) return;
      const rawVal = f.value;
      const type = (f.type || "string").toLowerCase();

      if (type === "number" || type === "int" || type === "integer" || type === "float") {
        const num = Number(rawVal);
        newBodyObj[f.name.trim()] = isNaN(num) ? rawVal : num;
      } else if (type === "boolean" || type === "bool") {
        newBodyObj[f.name.trim()] = rawVal === "true" || rawVal === "1";
      } else if (type === "array" || type === "object") {
        try {
          const parsed: JSONValue = JSON.parse(rawVal);
          newBodyObj[f.name.trim()] = parsed;
        } catch {
          newBodyObj[f.name.trim()] = rawVal;
        }
      } else {
        newBodyObj[f.name.trim()] = rawVal;
      }
    });

    onChange(newBodyObj);
    setJsonString(JSON.stringify(newBodyObj, null, 2));
    setJsonError(null);
  };

  // Add field row
  const handleAddField = () => {
    const newId = generateId();
    notifyFieldsChange([
      ...fields,
      {
        id: newId,
        name: `field_${fields.length + 1}`,
        type: "string",
        value: "test_value",
      },
    ]);
  };

  // Remove field row
  const handleRemoveField = (id: string) => {
    notifyFieldsChange(fields.filter((f) => f.id !== id));
  };

  // Update single field
  const handleUpdateField = (id: string, updates: Partial<FieldItem>) => {
    const updated = fields.map((f) => (f.id === id ? { ...f, ...updates } : f));
    notifyFieldsChange(updated);
  };

  // Raw JSON edit handler
  const handleJsonChange = (val: string) => {
    setJsonString(val);
    if (!val.trim()) {
      setJsonError(null);
      onChange({});
      return;
    }

    try {
      const parsed: JSONValue = JSON.parse(val);
      setJsonError(null);
      onChange(parsed);

      // Also reconstruct fields array if parsed is object
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const newFields: FieldItem[] = Object.entries(parsed).map(([k, v]) => ({
          id: `f-${k}`,
          name: k,
          type: typeof v,
          value: typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
        }));
        setFields(newFields);
      }
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      {/* Header + mode switcher */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Request Body
        </span>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 bg-background/60 p-0.5 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => setMode("fields")}
            title="Field Builder"
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
              mode === "fields"
                ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
            )}
          >
            <ListPlus size={12} />
            <span>Fields</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("json")}
            title="Raw JSON"
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
              mode === "json"
                ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
            )}
          >
            <Braces size={12} />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Fields Builder */}
      {mode === "fields" && (
        <div className="flex flex-col gap-2">
          {fields.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70 italic py-1">
              No body fields configured. Click "Add Field" to define test payload values.
            </p>
          )}

          {fields.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 group transition-all hover:border-primary/30 shadow-none"
            >
              {/* Field Name */}
              <Input
                value={f.name}
                onChange={(e) => handleUpdateField(f.id, { name: e.target.value })}
                placeholder="field_name"
                className="h-7 text-xs flex-1 bg-background font-mono border-border/60"
              />

              {/* Type tag */}
              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-secondary/80 text-muted-foreground border border-border/50 shrink-0">
                {f.type}
              </span>

              {/* Value Input */}
              <Input
                value={f.value}
                onChange={(e) => handleUpdateField(f.id, { value: e.target.value })}
                placeholder="Value..."
                className="h-7 text-xs flex-1 bg-background font-mono border-border/60"
              />

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded"
                onClick={() => handleRemoveField(f.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-[10px] gap-1 rounded-full px-3 self-start mt-0.5 bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50"
            onClick={handleAddField}
          >
            <Plus size={12} /> Add Field
          </Button>
        </div>
      )}

      {/* Mode 2: Raw JSON Textarea */}
      {mode === "json" && (
        <div className="flex flex-col gap-2">
          <Textarea
            className={cn(
              "min-h-[140px] text-xs font-mono resize-y bg-background focus-visible:ring-1 border-border/60",
              jsonError ? "border-destructive focus-visible:ring-destructive" : "",
            )}
            placeholder={'{\n  "name": "Sample Product",\n  "price": 49.99\n}'}
            value={jsonString}
            onChange={(e) => handleJsonChange(e.target.value)}
          />
          {jsonError && (
            <span className="text-[10px] text-destructive font-mono bg-destructive/10 px-2 py-1 rounded">
              Invalid JSON: {jsonError}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
