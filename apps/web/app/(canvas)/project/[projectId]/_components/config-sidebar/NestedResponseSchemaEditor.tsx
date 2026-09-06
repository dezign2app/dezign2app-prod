"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Braces,
  ListPlus,
  AlertTriangle,
  Check,
  Copy,
  Search,
  Sparkles,
  Plus,
  Trash,
  Code2,
  ChevronRight,
  ChevronDown,
  Layers,
  X,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Schema, Parameter } from "@/types/canvas";
import { TypeCombobox } from "./TypeCombobox";
import {
  extractNestedPaths,
  parseRawJsonSafe,
  formatJsonPretty,
  isOutputSchemaMissing,
  ExtractedPathItem,
} from "@/lib/utils/nestedJsonSchema";
import { generateId, LocalInput, LocalTextarea } from "../backend-nodes/graph-nodes/common";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

export type OutputSchemaMode = "field_builder" | "raw_json";

interface NestedResponseSchemaEditorProps {
  title?: string;
  subtitle?: string;
  isExternal?: boolean;
  mode?: OutputSchemaMode;
  onModeChange: (mode: OutputSchemaMode) => void;
  schema?: Schema;
  onSchemaChange: (schema: Schema) => void;
}

const PRESET_EXAMPLES: Record<string, { label: string; json: string }> = {
  stripeCharge: {
    label: "Stripe Charge Response",
    json: JSON.stringify(
      {
        id: "ch_3MtwBwLkdIwHu7ix0snN00x5",
        object: "charge",
        amount: 2000,
        amount_captured: 2000,
        currency: "usd",
        status: "succeeded",
        paid: true,
        billing_details: {
          address: {
            city: "San Francisco",
            country: "US",
            line1: "510 Townsend St",
            postal_code: "94103",
            state: "CA",
          },
          email: "customer@example.com",
          name: "Jane Doe",
          phone: "+15555555555",
        },
        payment_method_details: {
          type: "card",
          card: {
            brand: "visa",
            country: "US",
            exp_month: 8,
            exp_year: 2028,
            last4: "4242",
          },
        },
        metadata: {
          order_id: "ord_987654",
        },
      },
      null,
      2,
    ),
  },
  paginatedList: {
    label: "Paginated List (items, total, page)",
    json: JSON.stringify(
      {
        page: 1,
        limit: 20,
        total: 142,
        has_more: true,
        data: [
          {
            id: "usr_101",
            name: "Alex Smith",
            email: "alex@example.com",
            role: "admin",
            tags: ["active", "verified"],
            settings: {
              theme: "dark",
              notifications: { email: true, sms: false },
            },
          },
        ],
      },
      null,
      2,
    ),
  },
  genericSuccess: {
    label: "Simple Success ({ success, data })",
    json: JSON.stringify(
      {
        success: true,
        message: "Operation completed successfully",
        data: {
          id: "res_abc123",
          created_at: 1700000000,
        },
      },
      null,
      2,
    ),
  },
  standardError: {
    label: "Standard Error ({ error, message, statusCode })",
    json: JSON.stringify(
      {
        error: "Bad Request",
        message: "Invalid or missing parameters",
        statusCode: 400,
        timestamp: "2026-09-04T12:00:00Z",
      },
      null,
      2,
    ),
  },
  validationError: {
    label: "Validation Error ({ message, errors[] })",
    json: JSON.stringify(
      {
        error: "Validation Failed",
        message: "Field validation errors occurred",
        statusCode: 422,
        errors: [
          { field: "email", message: "Invalid email address" },
          { field: "amount", message: "Must be greater than 0" },
        ],
      },
      null,
      2,
    ),
  },
};

import { useBufferedInput } from "@/lib/hooks/useBufferedInput";

export const NestedResponseSchemaEditor: React.FC<
  NestedResponseSchemaEditorProps
> = ({
  title = "Output / Response Schema",
  subtitle = "External APIs return complex data. Define the output structure so callers can bind to its properties.",
  isExternal = true,
  mode = "field_builder",
  onModeChange,
  schema,
  onSchemaChange,
}) => {
  const safeSchema: Schema = schema || { id: generateId() };
  const rawFields = safeSchema.fields || [];

  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [pathSearch, setPathSearch] = useState("");
  const [showExplorer, setShowExplorer] = useState(true);

  const commitRawJson = useCallback(
    (val: string) => {
      const { parsed, error } = parseRawJsonSafe(val);
      if (!error && parsed !== null) {
        const derivedFields: Parameter[] = [];
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          Object.entries(parsed as Record<string, unknown>).forEach(
            ([key, value]) => {
              derivedFields.push({
                id: generateId(),
                name: key,
                type: Array.isArray(value)
                  ? "array"
                  : typeof value === "object" && value !== null
                  ? "object"
                  : typeof value,
                required: true,
              });
            },
          );
        }
        onSchemaChange({
          ...safeSchema,
          rawJson: val,
          fields: derivedFields.length > 0 ? derivedFields : safeSchema.fields,
        });
      } else {
        onSchemaChange({
          ...safeSchema,
          rawJson: val,
        });
      }
    },
    [safeSchema, onSchemaChange],
  );

  const rawBuffer = useBufferedInput(
    safeSchema.rawJson || "",
    commitRawJson,
    250,
  );

  const currentJsonString = rawBuffer.value;

  const { parsed: parsedJson, error: jsonError } = useMemo(
    () => parseRawJsonSafe(currentJsonString),
    [currentJsonString],
  );

  // Extract nested paths from the active source (JSON or fields)
  const extractedPaths: ExtractedPathItem[] = useMemo(() => {
    if (mode === "raw_json") {
      if (!parsedJson) return [];
      return extractNestedPaths(parsedJson);
    }
    // Field builder mode: synthesize paths
    return rawFields.map((f) => ({
      path: f.name || "field",
      type: `${f.type || "string"}${f.isArray ? "[]" : ""}`,
      sample: f.defaultValue || (f.required ? "required" : "optional"),
      isLeaf: true,
    }));
  }, [mode, parsedJson, rawFields]);

  const filteredPaths = useMemo(() => {
    if (!pathSearch.trim()) return extractedPaths;
    const q = pathSearch.toLowerCase();
    return extractedPaths.filter(
      (p) =>
        p.path.toLowerCase().includes(q) || p.type.toLowerCase().includes(q),
    );
  }, [extractedPaths, pathSearch]);

  const isMissing = isOutputSchemaMissing({
    responseBody: safeSchema,
    responseMode: mode,
  });

  const handleFormatJson = () => {
    if (!currentJsonString.trim()) return;
    const formatted = formatJsonPretty(currentJsonString);
    rawBuffer.setValue(formatted);
    commitRawJson(formatted);
    toast.success("JSON formatted");
  };

  const handleApplyPreset = (key: string) => {
    const preset = PRESET_EXAMPLES[key];
    if (preset) {
      rawBuffer.setValue(preset.json);
      commitRawJson(preset.json);
      onModeChange("raw_json");
      toast.success(`Applied ${preset.label}`);
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1800);
    toast.info(`Copied "${path}" to clipboard`);
  };

  // Field builder actions
  const addField = () => {
    const newFields = [
      ...rawFields,
      { id: generateId(), name: "", type: "string", required: true },
    ];
    onSchemaChange({
      ...safeSchema,
      fields: newFields,
    });
  };

  const updateField = (id: string, changes: Partial<Parameter>) => {
    const newFields = rawFields.map((f) =>
      f.id === id ? { ...f, ...changes } : f,
    );
    onSchemaChange({
      ...safeSchema,
      fields: newFields,
    });
  };

  const removeField = (id: string) => {
    const newFields = rawFields.filter((f) => f.id !== id);
    onSchemaChange({
      ...safeSchema,
      fields: newFields,
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 shadow-sm backdrop-blur-sm transition-all",
        isMissing && isExternal
          ? "border-amber-500/40 bg-amber-500/[0.04] ring-1 ring-amber-500/20"
          : "border-border bg-card/50",
      )}
    >
      {/* Header + Mode Switcher */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              {title}
            </span>
            {isMissing && isExternal && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <AlertTriangle size={10} />
                Required
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground leading-relaxed">
            {subtitle}
          </span>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 bg-background/80 p-0.5 rounded-lg border border-border shrink-0">
          <button
            type="button"
            onClick={() => onModeChange("field_builder")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
              mode === "field_builder"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
            title="Structured field builder"
          >
            <ListPlus size={12} />
            <span>Field Builder</span>
          </button>
                    <button
            type="button"
            onClick={() => onModeChange("raw_json")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
              mode === "raw_json"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
            title="Paste example or arbitrary nested JSON payload"
          >
            <Braces size={12} />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Enforcement Alert if schema is missing */}
      {isMissing && isExternal && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs leading-relaxed">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-[11px]">
              Output Schema Required
            </span>
            <span className="text-[10px] opacity-90">
              External endpoints must declare their return structure so that
              microservices and pipeline steps can bind to its response fields.
              Paste an example JSON response below or add fields.
            </span>
          </div>
        </div>
      )}

      {/* Mode 1: Example / Raw JSON */}
      {mode === "raw_json" && (
        <div className="flex flex-col gap-2.5">
          {/* Quick presets toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Sparkles size={12} className="text-amber-500" />
              <span className="text-[10px]">Load template:</span>
              <div className="flex items-center gap-1">
                {Object.entries(PRESET_EXAMPLES).map(([k, p]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleApplyPreset(k)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground border border-border/60 transition-colors"
                  >
                    {p.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 gap-1 rounded"
              onClick={handleFormatJson}
              disabled={!currentJsonString.trim() || Boolean(jsonError)}
            >
              <Code2 size={11} /> Format JSON
            </Button>
          </div>

          <LocalTextarea
            className={cn(
              "min-h-[160px] text-xs font-mono resize-y bg-background focus-visible:ring-1 p-3 leading-relaxed",
              jsonError
                ? "border-destructive focus-visible:ring-destructive"
                : "border-border",
            )}
            placeholder={
              '{\n  "id": "item_123",\n  "status": "active",\n  "user": {\n    "name": "Jane",\n    "email": "jane@example.com"\n  },\n  "items": [\n    { "id": "prod_1", "amount": 100 }\n  ]\n}'
            }
            value={rawBuffer.value}
            onChange={(e) => rawBuffer.onChange(e.target.value)}
            onBlur={rawBuffer.flush}
          />

          {jsonError && (
            <span className="text-[10px] text-destructive font-mono bg-destructive/10 px-2 py-1.5 rounded border border-destructive/20">
              Invalid JSON: {jsonError}
            </span>
          )}
        </div>
      )}

      {/* Mode 2: Field Builder */}
      {mode === "field_builder" && (
        <div className="flex flex-col gap-2">
          {rawFields.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70 italic p-2">
              No fields defined. Click "Add Field" below to declare top-level
              fields.
            </p>
          )}

          {rawFields.map((f, idx) => (
            <div
              key={f.id || `field_${idx}_${f.name}`}
              className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2 group/f transition-all hover:border-primary/40"
            >
              <div className="flex items-center gap-2">
                <LocalInput
                  className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1"
                  placeholder="fieldName (e.g. data.id or token)"
                  value={f.name || ""}
                  onBlur={(e) => updateField(f.id, { name: e.target.value })}
                />

                <TypeCombobox
                  value={f.type || "string"}
                  onValueChange={(v) => {
                    const updates: Partial<Parameter> = { type: v };
                    if (v === "enum" && (!f.enumValues || f.enumValues.length === 0)) {
                      updates.enumValues = [];
                    }
                    updateField(f.id, updates);
                  }}
                  className="w-[125px]"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title={
                    f.isArray
                      ? "Array type active (click to make single)"
                      : "Single type (click to make array [])"
                  }
                  className={cn(
                    "h-7 px-2 font-mono text-xs font-bold nodrag rounded transition-all cursor-pointer",
                    f.isArray
                      ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 ring-1 ring-primary/30"
                      : "bg-secondary/60 text-muted-foreground/80 hover:bg-secondary hover:text-foreground border border-border/40",
                  )}
                  onClick={() => updateField(f.id, { isArray: !f.isArray })}
                >
                  []
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-[10px] rounded-full transition-colors",
                    f.required
                      ? "text-primary font-bold bg-primary/10 hover:bg-primary/20"
                      : "text-muted-foreground bg-secondary/50 hover:bg-secondary",
                  )}
                  onClick={() => updateField(f.id, { required: !f.required })}
                >
                  {f.required ? "REQ" : "OPT"}
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover/f:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all rounded-full"
                  onClick={() => removeField(f.id)}
                >
                  <Trash size={13} />
                </Button>
              </div>

              {/* Inline enum values manager if type === 'enum' */}
              {f.type === "enum" && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-md bg-secondary/30 border border-border/40 text-xs">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Values:</span>
                  {(f.enumValues || []).map((val, valIdx) => (
                    <span
                      key={valIdx}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary font-mono text-[11px] border border-border/50"
                    >
                      {val}
                      <button
                        type="button"
                        className="hover:text-destructive text-muted-foreground transition-colors"
                        onClick={() => {
                          const next = (f.enumValues || []).filter((_, i) => i !== valIdx);
                          updateField(f.id, { enumValues: next });
                        }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <Input
                    placeholder="Add value (press Enter)..."
                    className="h-6 w-36 text-xs bg-background/80"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim().replace(/^["']|["']$/g, "");
                        if (val && !(f.enumValues || []).includes(val)) {
                          updateField(f.id, {
                            enumValues: [...(f.enumValues || []), val],
                          });
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ))}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-[10px] gap-1 rounded-full px-3 self-start mt-1"
            onClick={addField}
          >
            <Plus size={12} /> Add Field
          </Button>
        </div>
      )}

      {/* Live Nested Property Explorer */}
      {extractedPaths.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-border/50">
          <button
            type="button"
            onClick={() => setShowExplorer(!showExplorer)}
            className="flex items-center justify-between text-left hover:text-foreground transition-colors group/exp"
          >
            <div className="flex items-center gap-1.5">
              <Layers size={13} className="text-primary" />
              <span className="text-[11px] font-semibold text-foreground/90">
                Extracted Output Paths
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                {extractedPaths.length} path
                {extractedPaths.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-0.5 rounded text-muted-foreground">
              {showExplorer ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}
            </div>
          </button>

          {showExplorer && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-2.5 text-muted-foreground/60"
                />
                <Input
                  className="h-7 text-xs pl-7 bg-background/60"
                  placeholder="Filter extracted paths (e.g. email, amount, id)..."
                  value={pathSearch}
                  onChange={(e) => setPathSearch(e.target.value)}
                />
              </div>

              <div className="max-h-[220px] overflow-y-auto flex flex-col gap-1 pr-1 border border-border/50 rounded-lg p-2 bg-background/30">
                {filteredPaths.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground italic p-1">
                    No matching paths found.
                  </span>
                ) : (
                  filteredPaths.map((item, idx) => (
                    <div
                      key={`${item.path}-${idx}`}
                      className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-muted/40 transition-colors group/p text-[11px]"
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                          {item.type}
                        </span>
                        <span
                          className="font-mono text-[11px] text-foreground font-medium truncate"
                          title={item.path}
                        >
                          {item.path}
                        </span>
                        {item.sample && (
                          <span
                            className="text-[9px] text-muted-foreground/60 truncate font-mono hidden sm:inline"
                            title={item.sample}
                          >
                            = {item.sample}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyPath(item.path)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group-hover/p:opacity-100 transition-all shrink-0"
                        title="Copy dot-notation path"
                      >
                        {copiedPath === item.path ? (
                          <Check size={11} className="text-emerald-500" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                {isExternal ? (
                  <>
                    Downstream pipeline steps can reference these exact paths via{" "}
                    <code className="bg-secondary px-1 py-0.5 rounded text-[9px] font-mono">
                      step.result.&lt;path&gt;
                    </code>
                    .
                  </>
                ) : (
                  <>Callers and frontend components can reference these response fields during API invocation.</>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
