import React from "react";
import { Plus, Trash, Braces, ListPlus, Text, Code } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { PARAMETER_TYPES, Schema, Parameter, BackendNode } from "@/types/canvas";
import { generateId, LocalInput, LocalTextarea } from "../backend-nodes/graph-nodes/common";

export type ResponseBodyMode = "field_builder" | "raw_json" | "custom_expression";

interface ResponseBodyEditorProps {
  mode?: ResponseBodyMode;
  onModeChange: (mode: ResponseBodyMode) => void;
  schema?: Schema;
  onSchemaChange: (schema: Schema) => void;
  expression?: string;
  onExpressionChange?: (expr: string) => void;
  availableTableNodes?: { id: string; label: string }[];
  allNodes?: BackendNode[];
}

/**
 * Unified editor for the response body schema, matching the RequestBodyEditor design.
 *
 * Modes:
 * - field_builder: structured field rows (name + type + required toggle + optional DB entity types).
 * - raw_json: raw JSON textarea for quick JSON payloads.
 * - custom_expression: custom variable or JS object expression (e.g. `dbResult`, `createdUser`).
 */
export const ResponseBodyEditor: React.FC<ResponseBodyEditorProps> = ({
  mode = "field_builder",
  onModeChange,
  schema,
  onSchemaChange,
  expression = "",
  onExpressionChange,
  availableTableNodes = [],
}) => {
  // ---- shared helpers --------------------------------------------------------
  const safeSchema: Schema = schema || { id: generateId() };
  const fields: Parameter[] = (safeSchema.fields as Parameter[]) || [];

  // ---- field-builder helpers -------------------------------------------------
  const addField = () => {
    onSchemaChange({
      ...safeSchema,
      fields: [
        ...fields,
        { id: generateId(), name: "", type: "string", required: true },
      ],
    });
  };

  const updateField = (id: string, changes: Partial<Parameter>) => {
    onSchemaChange({
      ...safeSchema,
      fields: fields.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    });
  };

  const removeField = (id: string) => {
    onSchemaChange({
      ...safeSchema,
      fields: fields.filter((f) => f.id !== id),
    });
  };

  // ---- raw-json helpers ------------------------------------------------------
  const [rawInput, setRawInput] = React.useState<string | undefined>(undefined);
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const handleRawChange = (val: string) => {
    setRawInput(val);
    onSchemaChange({ ...safeSchema, rawJson: val });
    if (!val.trim()) { setJsonError(null); return; }
    try { JSON.parse(val); setJsonError(null); }
    catch (err) { setJsonError(err instanceof Error ? err.message : String(err)); }
  };

  // Reset local raw state when mode changes
  const prevModeRef = React.useRef(mode);
  if (prevModeRef.current !== mode) {
    prevModeRef.current = mode;
    setRawInput(undefined);
    setJsonError(null);
  }

  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      {/* Header + mode tabs */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Response Body Schema
        </span>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 bg-background/60 p-0.5 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => onModeChange("field_builder")}
            title="Field Builder"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              mode === "field_builder"
                ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <ListPlus size={12} />
            <span>Fields</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("raw_json")}
            title="Raw JSON"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              mode === "raw_json"
                ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Braces size={12} />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("custom_expression")}
            title="Custom Expression"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              mode === "custom_expression"
                ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Code size={12} />
            <span>Expression</span>
          </button>
        </div>
      </div>

      {/* ---- Mode 1: Field Builder ---------------------------------------- */}
      {mode === "field_builder" && (
        <div className="flex flex-col gap-2">
          {fields.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70 italic">
              No response fields defined. Add one below.
            </p>
          )}
          {fields.map((f) => (
            <div
              key={f.id}
              className="flex flex-col gap-1.5 rounded-lg border bg-background/50 p-2.5 group/f transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <LocalInput
                  className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1 placeholder:font-sans"
                  placeholder="fieldName (e.g. data)"
                  value={f.name || ""}
                  onBlur={(e) => updateField(f.id, { name: e.target.value })}
                />
                <Select
                  value={f.type}
                  onValueChange={(v) => updateField(f.id, { type: v })}
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs py-0 nodrag bg-secondary/50 border-none font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Primitives
                    </div>
                    {PARAMETER_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs font-mono">
                        {t}
                      </SelectItem>
                    ))}
                    {availableTableNodes.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold text-primary uppercase tracking-wider border-t border-border/40 mt-1">
                          Database Entities
                        </div>
                        {availableTableNodes.map((tbl) => (
                          <React.Fragment key={tbl.id}>
                            <SelectItem value={`db:${tbl.id}:single`} className="text-xs font-mono">
                              DB: {tbl.label}
                            </SelectItem>
                            <SelectItem value={`db:${tbl.id}:array`} className="text-xs font-mono">
                              DB: {tbl.label}[]
                            </SelectItem>
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2.5 text-[10px] nodrag rounded-full transition-colors ${
                    f.required
                      ? "text-primary font-bold bg-primary/10 hover:bg-primary/20"
                      : "text-muted-foreground bg-secondary/50 hover:bg-secondary"
                  }`}
                  onClick={() => updateField(f.id, { required: !f.required })}
                >
                  {f.required ? "REQUIRED" : "OPTIONAL"}
                </Button>
                {f.description === undefined && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Add description"
                    className="h-7 w-7 opacity-0 group-hover/f:opacity-100 text-muted-foreground hover:bg-secondary shrink-0 transition-all rounded-full"
                    onClick={() => updateField(f.id, { description: "" })}
                  >
                    <Text size={13} />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover/f:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all rounded-full"
                  onClick={() => removeField(f.id)}
                >
                  <Trash size={14} />
                </Button>
              </div>
              {f.description !== undefined && (
                <div className="relative w-full">
                  <LocalInput
                    className="h-6 text-[10px] pl-2.5 pr-6 w-full nodrag bg-transparent border-none shadow-none text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:bg-secondary/30 rounded"
                    placeholder="Add a description..."
                    value={f.description || ""}
                    onBlur={(e) => updateField(f.id, { description: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 absolute right-0.5 top-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-all rounded"
                    onClick={() => updateField(f.id, { description: undefined })}
                  >
                    <Trash size={10} />
                  </Button>
                </div>
              )}
            </div>
          ))}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-[10px] gap-1 rounded-full px-3 self-start mt-0.5"
            onClick={addField}
          >
            <Plus size={12} /> Add Field
          </Button>
        </div>
      )}

      {/* ---- Mode 2: Raw JSON --------------------------------------------- */}
      {mode === "raw_json" && (
        <div className="flex flex-col gap-2">
          <LocalTextarea
            className={`min-h-[120px] text-xs font-mono resize-y bg-background focus-visible:ring-1 ${
              jsonError ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
            placeholder={'{ "success": true, "data": {} }'}
            value={rawInput !== undefined ? rawInput : safeSchema.rawJson || ""}
            onChange={(e) => handleRawChange(e.target.value)}
          />
          {jsonError && (
            <span className="text-[10px] text-destructive font-mono bg-destructive/10 px-2 py-1 rounded">
              Invalid JSON: {jsonError}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70">
            Type or paste a JSON object describing the response body structure.
          </span>
        </div>
      )}

      {/* ---- Mode 3: Custom Expression ------------------------------------ */}
      {mode === "custom_expression" && (
        <div className="flex flex-col gap-2">
          <Label className="text-[11px] font-semibold text-muted-foreground">
            Custom Variable / Expression
          </Label>
          <Input
            className="bg-background font-mono text-xs"
            placeholder="e.g. result, dbData, or { success: true, user }"
            value={expression}
            onChange={(e) => onExpressionChange?.(e.target.value)}
          />
          <span className="text-[10px] text-muted-foreground/70">
            Specify a custom variable or JS object expression to return directly in <code>res.json(...)</code>.
          </span>
        </div>
      )}
    </div>
  );
};
