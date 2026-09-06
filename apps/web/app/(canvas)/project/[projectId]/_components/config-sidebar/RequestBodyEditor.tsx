import React from "react";
import { Plus, Trash, Braces, ListPlus, Text, X } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { Schema, Parameter, BackendNode } from "@/types/canvas";
import { generateId, LocalInput, LocalTextarea } from "../backend-nodes/graph-nodes/common";
import { useBufferedInput } from "@/lib/hooks/useBufferedInput";
import { parseRelaxedJson } from "@/lib/compiler/generators/routeGenerator/jsonInterpolation";
import { TypeCombobox } from "./TypeCombobox";

export type RequestBodyMode = "field_builder" | "raw_json";

interface RequestBodyEditorProps {
  title?: string;
  subtitle?: string;
  mode: RequestBodyMode;
  onModeChange: (mode: RequestBodyMode) => void;
  schema?: Schema;
  onSchemaChange: (schema: Schema) => void;
  allNodes?: BackendNode[];
}

/**
 * Dual-mode editor for the request body schema or any object schema.
 *
 * - field_builder: structured field rows (name + searchable type combobox with
 *   primitives, custom types, and package types + required toggle + [] array toggle + enum values editor).
 * - raw_json: a JSON textarea escape hatch for complex / nested shapes.
 *   Persists to schema.rawJson.
 */
export const RequestBodyEditor: React.FC<RequestBodyEditorProps> = ({
  title = "Request Body Schema",
  subtitle,
  mode,
  onModeChange,
  schema,
  onSchemaChange,
  allNodes,
}) => {
  const safeSchema: Schema = React.useMemo(() => schema || { id: generateId() }, [schema]);
  const fields: Parameter[] = React.useMemo(() => {
    const rawFields = safeSchema.fields || [];
    return rawFields.map((f, idx) => ({
      ...f,
      id: f.id || `f_${idx}_${f.name || generateId()}`,
    }));
  }, [safeSchema]);

  // Local draft state for adding enum values per field
  const [enumInputs, setEnumInputs] = React.useState<Record<string, string>>({});

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

  const toggleArray = (field: Parameter) => {
    const isArr = Boolean(field.isArray || field.type?.endsWith("[]"));
    const base = (field.type || "string").replace(/\[\]$/, "");
    if (isArr) {
      updateField(field.id, { type: base, isArray: false });
    } else {
      updateField(field.id, { type: `${base}[]`, isArray: true });
    }
  };

  const handleTypeChange = (field: Parameter, selectedBase: string) => {
    const isArr = Boolean(field.isArray || field.type?.endsWith("[]"));
    const cleanBase = selectedBase.replace(/\[\]$/, "");
    const newType = isArr ? `${cleanBase}[]` : cleanBase;
    updateField(field.id, {
      type: newType,
      isArray: isArr,
      ...(cleanBase === "enum" && (!field.enumValues || field.enumValues.length === 0)
        ? { enumValues: [] }
        : {}),
    });
  };

  const handleAddEnumValue = (fieldId: string) => {
    const input = (enumInputs[fieldId] || "").trim();
    if (!input) return;
    const parts = input
      .split(",")
      .map((p) => p.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    if (parts.length === 0) return;

    const targetField = fields.find((f) => f.id === fieldId);
    const currentValues = targetField?.enumValues || [];
    const uniqueNew = parts.filter((p) => !currentValues.includes(p));
    if (uniqueNew.length > 0) {
      updateField(fieldId, { enumValues: [...currentValues, ...uniqueNew] });
    }
    setEnumInputs((prev) => ({ ...prev, [fieldId]: "" }));
  };

  const handleDeleteEnumValue = (fieldId: string, idx: number) => {
    const targetField = fields.find((f) => f.id === fieldId);
    const updated = (targetField?.enumValues || []).filter((_, i) => i !== idx);
    updateField(fieldId, { enumValues: updated });
  };

  // ---- raw-json helpers ------------------------------------------------------
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const commitRawJson = React.useCallback(
    (val: string) => {
      onSchemaChange({ ...safeSchema, rawJson: val });
      if (!val.trim()) {
        setJsonError(null);
        return;
      }
      const { error } = parseRelaxedJson(val);
      setJsonError(error);
    },
    [safeSchema, onSchemaChange],
  );

  const rawBuffer = useBufferedInput(
    safeSchema.rawJson || "",
    commitRawJson,
    250,
  );

  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      {/* Header + mode tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] text-muted-foreground/70">
              {subtitle}
            </span>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 bg-background/60 p-0.5 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => onModeChange("field_builder")}
            title="Field Builder"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
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
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
              mode === "raw_json"
                ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Braces size={12} />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* ---- Mode 1: Field Builder ---------------------------------------- */}
      {mode === "field_builder" && (
        <div className="flex flex-col gap-2">
          {fields.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70 italic">
              No fields yet. Add one below.
            </p>
          )}
          {fields.map((f, idx) => {
            const isFieldArray = Boolean(f.isArray || f.type?.endsWith("[]"));
            const baseType = (f.type || "string").replace(/\[\]$/, "");

            return (
              <div
                key={f.id || `field_${idx}_${f.name}`}
                className="flex flex-col gap-2 rounded-lg border bg-background/50 p-2.5 group/f transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <LocalInput
                    className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1 placeholder:font-sans"
                    placeholder="fieldName"
                    value={f.name || ""}
                    onBlur={(e) => updateField(f.id, { name: e.target.value })}
                  />

                  {/* Searchable Combobox for Primitives + Custom Types + Package Types */}
                  <TypeCombobox
                    value={baseType}
                    onValueChange={(newBase) => handleTypeChange(f, newBase)}
                    allNodes={allNodes}
                  />

                  {/* Array [] toggle button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title={
                      isFieldArray
                        ? "Array active (click to make single)"
                        : "Single type (click to make array [])"
                    }
                    className={cn(
                      "h-7 px-2.5 font-mono text-xs font-bold nodrag rounded-full transition-all cursor-pointer",
                      isFieldArray
                        ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 ring-1 ring-primary/30"
                        : "bg-secondary/60 text-muted-foreground/80 hover:bg-secondary hover:text-foreground border border-border/40",
                    )}
                    onClick={() => toggleArray(f)}
                  >
                    []
                  </Button>

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

                  {/* toggle description */}
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
                    className="h-7 w-7 opacity-0 group-hover/f:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all rounded-full cursor-pointer"
                    onClick={() => removeField(f.id)}
                  >
                    <Trash size={14} />
                  </Button>
                </div>

                {/* Inline Enum Values Editor if primitive enum is selected */}
                {baseType === "enum" && (
                  <div className="flex flex-col gap-1.5 px-2.5 py-2 rounded-lg bg-purple-500/5 border border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider">
                        Allowed Enum Values:
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {(f.enumValues || []).length} values
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <LocalInput
                        className="h-6 text-xs flex-1 nodrag bg-background font-mono border border-purple-500/30 text-foreground placeholder:text-muted-foreground/50 placeholder:font-sans focus-visible:ring-1 focus-visible:ring-purple-500/30"
                        placeholder="Add value (e.g. ACTIVE, PENDING) and press Enter..."
                        value={enumInputs[f.id] || ""}
                        onChange={(e) =>
                          setEnumInputs((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddEnumValue(f.id);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 cursor-pointer"
                        disabled={!(enumInputs[f.id] || "").trim()}
                        onClick={() => handleAddEnumValue(f.id)}
                      >
                        <Plus size={12} />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 min-h-[22px] pt-0.5">
                      {(f.enumValues || []).map((v, idx) => (
                        <span
                          key={`${v}-${idx}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary border border-border/60 text-[11px] font-mono font-medium text-foreground transition-all"
                        >
                          <span>{v}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteEnumValue(f.id, idx)}
                            className="text-muted-foreground/60 hover:text-destructive p-0.5 rounded transition-colors cursor-pointer"
                            title={`Remove "${v}"`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      {(!f.enumValues || f.enumValues.length === 0) && (
                        <span className="text-[10px] text-muted-foreground/50 italic">
                          No enum values yet. Enter values above.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Optional description field */}
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
                      className="h-5 w-5 absolute right-0.5 top-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-all rounded cursor-pointer"
                      onClick={() => updateField(f.id, { description: undefined })}
                    >
                      <Trash size={10} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-[10px] gap-1 rounded-full px-3 self-start mt-0.5 cursor-pointer"
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
            placeholder={'{ "email": "string", "password": "string" }'}
            value={rawBuffer.value}
            onChange={(e) => rawBuffer.onChange(e.target.value)}
            onBlur={rawBuffer.flush}
          />
          {jsonError && (
            <span className="text-[10px] text-destructive font-mono bg-destructive/10 px-2 py-1 rounded">
              Invalid JSON: {jsonError}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70">
            Paste or type a JSON object describing the request body shape.
          </span>
        </div>
      )}
    </div>
  );
};
