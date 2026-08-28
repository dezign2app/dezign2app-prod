import React from "react";
import { Plus, Trash, Text, Braces, ListPlus } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import {
  Parameter,
  Schema,
  ProcessingStep,
  JSONValue,
  PROCESSING_STEP_OPERATIONS,
  PARAMETER_TYPES,
} from "@/types/canvas";
import { generateId } from "./utils";
import { LocalInput, LocalTextarea } from "./LocalInput";

// --- Processing Steps Editor ---

export const ProcessingStepsEditor = ({
  steps,
  onChange,
}: {
  steps: ProcessingStep[];
  onChange: (steps: ProcessingStep[]) => void;
}) => {
  const addStep = () => {
    onChange([
      ...steps,
      { id: generateId(), text: "", operation: "passthrough" },
    ]);
  };

  const updateStep = (id: string, text: string) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const updateOperation = (
    id: string,
    operation: ProcessingStep["operation"],
  ) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, operation } : s)));
  };

  const updateConfig = (id: string, raw: string) => {
    try {
      const config = raw.trim() ? JSON.parse(raw) : {};
      onChange(steps.map((s) => (s.id === id ? { ...s, config } : s)));
    } catch {
      // Keep the last valid config while the user is typing JSON.
    }
  };

  const removeStep = (id: string) => {
    onChange(steps.filter((s) => s.id !== id));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Processing Steps
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-[10px] gap-1 rounded-full px-3"
          onClick={addStep}
        >
          <Plus size={12} /> Add Step
        </Button>
      </div>

      <div className="flex flex-col gap-2.5 mt-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex flex-col gap-2 rounded-lg border bg-background/50 p-2.5 group/step transition-all hover:border-primary/30 hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                {index + 1}
              </div>
              <LocalInput
                className="h-7 text-xs flex-1 nodrag bg-background border-none shadow-none focus-visible:ring-1"
                placeholder="Describe this step..."
                value={step.text || ""}
                onBlur={(e) => updateStep(step.id, e.target.value)}
              />
              <Select
                value={step.operation || "passthrough"}
                onValueChange={(value) =>
                  updateOperation(step.id, value as ProcessingStep["operation"])
                }
              >
                <SelectTrigger className="h-7 w-[120px] text-xs nodrag bg-secondary/50 border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROCESSING_STEP_OPERATIONS.map((operation) => (
                    <SelectItem
                      key={operation}
                      value={operation}
                      className="text-xs"
                    >
                      {operation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover/step:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all rounded-full"
                onClick={() => removeStep(step.id)}
              >
                <Trash size={14} />
              </Button>
            </div>
            {step.operation && step.operation !== "passthrough" && (
              <div className="pl-7 pr-9">
                <LocalTextarea
                  className="min-h-[48px] text-[11px] p-2 nodrag bg-secondary/30 font-mono border-dashed border-secondary-foreground/20 focus-visible:ring-1 focus-visible:border-solid rounded-md resize-none"
                  placeholder={
                    'Config JSON, e.g. {"tableRef":"users-ref","where":{"id":"$request.params.userId"}}'
                  }
                  value={JSON.stringify(step.config || {}, null, 2)}
                  onBlur={(e) => updateConfig(step.id, e.target.value)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Parameter / Schema Editor ---

export const ParameterEditor = ({
  title,
  parameters,
  onChange,
  fieldOptions,
}: {
  title: string;
  parameters: Parameter[];
  onChange: (params: Parameter[]) => void;
  fieldOptions?: string[];
}) => {
  const addParam = () => {
    onChange([
      ...parameters,
      { id: generateId(), name: "", type: "string", required: true },
    ]);
  };

  const updateParam = (id: string, changes: Partial<Parameter>) => {
    onChange(parameters.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  };

  const removeParam = (id: string) => {
    onChange(parameters.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-[10px] gap-1 rounded-full px-3"
          onClick={addParam}
        >
          <Plus size={12} /> Add Field
        </Button>
      </div>

      <div className="flex flex-col gap-2.5 mt-1">
        {parameters.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-lg border bg-background/50 p-2.5 relative group/param transition-all hover:border-primary/30 hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              {fieldOptions ? (
                <Combobox
                  value={p.name || ""}
                  onValueChange={(value) => {
                    if (value !== null) updateParam(p.id, { name: value });
                  }}
                >
                  <ComboboxInput
                    className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1"
                    placeholder="Select table field"
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxEmpty className="bg-sidebar">
                        No fields found on the selected table.
                      </ComboboxEmpty>
                      {fieldOptions.map((field) => (
                        <ComboboxItem key={field} value={field}>
                          {field}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              ) : (
                <LocalInput
                  className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1 placeholder:font-sans"
                  placeholder="Field name"
                  value={p.name || ""}
                  onBlur={(e) => updateParam(p.id, { name: e.target.value })}
                />
              )}
              <Select
                value={p.type}
                onValueChange={(v) => updateParam(p.id, { type: v })}
              >
                <SelectTrigger className="h-7 w-[95px] text-xs py-0 nodrag bg-secondary/50 border-none font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARAMETER_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2.5 text-[10px] nodrag rounded-full transition-colors ${p.required ? "text-primary font-bold bg-primary/10 hover:bg-primary/20" : "text-muted-foreground bg-secondary/50 hover:bg-secondary"}`}
                onClick={() => updateParam(p.id, { required: !p.required })}
              >
                {p.required ? "REQUIRED" : "OPTIONAL"}
              </Button>
              {p.description === undefined && (
                <Button
                  size="icon"
                  variant="ghost"
                  title="Add Description"
                  className="h-7 w-7 opacity-0 group-hover/param:opacity-100 text-muted-foreground hover:bg-secondary shrink-0 transition-all rounded-full"
                  onClick={() => updateParam(p.id, { description: "" })}
                >
                  <Text size={14} />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover/param:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all rounded-full"
                onClick={() => removeParam(p.id)}
              >
                <Trash size={14} />
              </Button>
            </div>
            {p.description !== undefined && (
              <div className="relative w-full">
                <LocalInput
                  className="h-6 text-[10px] pl-2.5 pr-6 w-full nodrag bg-transparent border-none shadow-none text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:bg-secondary/30 rounded"
                  placeholder="Add a description..."
                  value={p.description || ""}
                  onBlur={(e) =>
                    updateParam(p.id, { description: e.target.value })
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 absolute right-0.5 top-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-all rounded"
                  onClick={() => updateParam(p.id, { description: undefined })}
                >
                  <Trash size={10} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export type SchemaEditorMode = "field_builder" | "raw_json";

export interface SchemaEditorProps {
  title?: string;
  schema?: Schema;
  onChange?: (schema: Schema) => void;
  fieldOptions?: string[];
  mode?: SchemaEditorMode;
  onModeChange?: (mode: SchemaEditorMode) => void;
  readOnly?: boolean;
  readOnlyMessage?: React.ReactNode;
  className?: string;
}

export const SchemaEditor = ({
  title = "Schema",
  schema,
  onChange,
  fieldOptions,
  mode,
  onModeChange,
  readOnly = false,
  readOnlyMessage,
  className,
}: SchemaEditorProps) => {
  const safeSchema: Schema = schema || { id: generateId() };
  const [internalMode, setInternalMode] = React.useState<SchemaEditorMode>(
    safeSchema.mode ??
      safeSchema.requestBodyMode ??
      (safeSchema.rawJson && (!safeSchema.fields || safeSchema.fields.length === 0)
        ? "raw_json"
        : "field_builder")
  );

  const resolvedMode: SchemaEditorMode =
    mode ??
    safeSchema.mode ??
    safeSchema.requestBodyMode ??
    internalMode;

  const fields: Parameter[] = (safeSchema.fields as Parameter[]) || [];

  const handleModeChange = (newMode: SchemaEditorMode) => {
    setInternalMode(newMode);
    if (onModeChange) {
      onModeChange(newMode);
    }
    if (onChange && !readOnly) {
      onChange({
        ...safeSchema,
        mode: newMode,
      });
    }
  };

  // ---- Field-builder helpers -------------------------------------------------
  const addField = () => {
    if (readOnly || !onChange) return;
    onChange({
      ...safeSchema,
      mode: resolvedMode,
      fields: [
        ...fields,
        { id: generateId(), name: "", type: "string", required: true },
      ],
    });
  };

  const updateField = (id: string, changes: Partial<Parameter>) => {
    if (readOnly || !onChange) return;
    onChange({
      ...safeSchema,
      mode: resolvedMode,
      fields: fields.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    });
  };

  const removeField = (id: string) => {
    if (readOnly || !onChange) return;
    onChange({
      ...safeSchema,
      mode: resolvedMode,
      fields: fields.filter((f) => f.id !== id),
    });
  };

  // ---- Raw-JSON helpers ------------------------------------------------------
  const [rawInput, setRawInput] = React.useState<string | undefined>(undefined);
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const handleRawChange = (val: string) => {
    if (readOnly || !onChange) return;
    setRawInput(val);
    onChange({ ...safeSchema, mode: resolvedMode, rawJson: val });
    if (!val.trim()) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : String(err));
    }
  };

  // Reset local raw state when schema changes externally (e.g. mode switch or live sync)
  const prevRawRef = React.useRef(schema?.rawJson);
  const prevModeRef = React.useRef(resolvedMode);
  if (prevModeRef.current !== resolvedMode || prevRawRef.current !== schema?.rawJson) {
    prevModeRef.current = resolvedMode;
    prevRawRef.current = schema?.rawJson;
    setRawInput(undefined);
    setJsonError(null);
  }

  // If in read-only mode and rawJson is empty but fields exist, format fields as pretty JSON for viewing
  const displayRawJson = React.useMemo(() => {
    if (rawInput !== undefined) return rawInput;
    if (safeSchema.rawJson) return safeSchema.rawJson;
    if (fields.length > 0) {
      const mockObj: Record<string, string> = {};
      fields.forEach((f) => {
        if (f.name) mockObj[f.name] = f.type || "string";
      });
      return JSON.stringify(mockObj, null, 2);
    }
    return "";
  }, [rawInput, safeSchema.rawJson, fields]);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {/* Header + mode tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {readOnly && (
            <span className="text-[9px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground border border-border/50">
              Read-Only
            </span>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 bg-background/60 p-0.5 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => handleModeChange("field_builder")}
            title="Field Builder"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              resolvedMode === "field_builder"
                ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <ListPlus size={12} />
            <span>Fields</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("raw_json")}
            title="Raw JSON"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              resolvedMode === "raw_json"
                ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Braces size={12} />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {readOnlyMessage && <div>{readOnlyMessage}</div>}

      {/* Mode 1: Field Builder */}
      {resolvedMode === "field_builder" && (
        <div className="flex flex-col gap-2">
          {fields.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70 italic py-1">
              {readOnly
                ? "No fields defined in this schema."
                : "No fields defined yet. Add one below or switch to JSON mode."}
            </p>
          )}

          {readOnly ? (
            // Read-Only field list
            <div className="flex flex-col gap-1.5">
              {fields.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-col gap-1 rounded-lg border bg-background/40 p-2.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {f.name || "unnamedField"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold bg-secondary/80 text-muted-foreground px-2 py-0.5 rounded border border-border/40">
                        {f.type || "string"}
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                          f.required
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground bg-secondary/50"
                        }`}
                      >
                        {f.required ? "REQUIRED" : "OPTIONAL"}
                      </span>
                    </div>
                  </div>
                  {f.description && (
                    <span className="text-[11px] text-muted-foreground/80 italic pl-1">
                      {f.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Editable field list
            <>
              {fields.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-col gap-1.5 rounded-lg border bg-background/50 p-2.5 group/f transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    {fieldOptions && fieldOptions.length > 0 ? (
                      <Combobox
                        value={f.name || ""}
                        onValueChange={(value) => {
                          if (value !== null) updateField(f.id, { name: value });
                        }}
                      >
                        <ComboboxInput
                          className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1"
                          placeholder="Select or enter field name"
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            <ComboboxEmpty className="bg-sidebar">
                              No matching fields found.
                            </ComboboxEmpty>
                            {fieldOptions.map((field) => (
                              <ComboboxItem key={field} value={field}>
                                {field}
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    ) : (
                      <LocalInput
                        className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1 placeholder:font-sans"
                        placeholder="fieldName"
                        value={f.name || ""}
                        onBlur={(e) => updateField(f.id, { name: e.target.value })}
                      />
                    )}
                    <Select
                      value={f.type}
                      onValueChange={(v) => updateField(f.id, { type: v })}
                    >
                      <SelectTrigger className="h-7 w-[95px] text-xs py-0 nodrag bg-secondary/50 border-none font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PARAMETER_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {t}
                          </SelectItem>
                        ))}
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
            </>
          )}
        </div>
      )}

      {/* Mode 2: Raw JSON */}
      {resolvedMode === "raw_json" && (
        <div className="flex flex-col gap-2">
          <LocalTextarea
            readOnly={readOnly}
            className={`min-h-[120px] text-xs font-mono resize-y bg-background focus-visible:ring-1 ${
              jsonError ? "border-destructive focus-visible:ring-destructive" : ""
            } ${readOnly ? "cursor-default opacity-90" : ""}`}
            placeholder={'{\n  "key": "value"\n}'}
            value={displayRawJson}
            onChange={(e) => handleRawChange(e.target.value)}
          />
          {jsonError && !readOnly && (
            <span className="text-[10px] text-destructive font-mono bg-destructive/10 px-2 py-1 rounded">
              Invalid JSON: {jsonError}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70">
            {readOnly
              ? "Viewing JSON representation of the schema (read-only)."
              : "Paste or type a JSON object describing the schema shape."}
          </span>
        </div>
      )}
    </div>
  );
};

export const JsonPayloadEditor = ({
  title = "Payload Editor",
  schema,
  value,
  onChange,
}: {
  title?: string;
  schema?: Schema;
  value: JSONValue | undefined;
  onChange: (value: JSONValue) => void;
}) => {
  const initialString =
    value !== undefined
      ? JSON.stringify(value, null, 2)
      : schema?.rawJson || "";
  const [rawInput, setRawInput] = React.useState<string | undefined>(undefined);
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const handleRawChange = (val: string) => {
    setRawInput(val);

    if (!val.trim()) {
      setJsonError(null);
      onChange({});
      return;
    }
    try {
      const parsed = JSON.parse(val);
      setJsonError(null);
      onChange(parsed as JSONValue);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : String(err));
    }
  };

  const generateMockFromSchema = () => {
    if (schema?.rawJson) {
      try {
        const parsed = JSON.parse(schema.rawJson);
        onChange(parsed);
        return;
      } catch {}
    }
  };

  return (
    <div className="flex flex-col gap-2 border p-3 rounded-lg bg-secondary/5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {schema && value === undefined && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 shadow-sm"
            onClick={generateMockFromSchema}
          >
            Infer Mock from Schema
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-1">
        <LocalTextarea
          className={`min-h-[120px] text-xs font-mono resize-y bg-background focus-visible:ring-1 ${jsonError ? "border-destructive focus-visible:ring-destructive" : ""}`}
          placeholder={'{\n  "key": "value"\n}'}
          value={rawInput !== undefined ? rawInput : initialString}
          onChange={(e) => handleRawChange(e.target.value)}
        />
        {jsonError && (
          <span className="text-[10px] text-destructive font-mono bg-destructive/10 px-2 py-1 rounded">
            Invalid JSON: {jsonError}
          </span>
        )}
      </div>
    </div>
  );
};
