import React from "react";
import { Plus, X, Braces, ListPlus, Text } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { PARAMETER_TYPES, Schema, Parameter } from "@/types/canvas";
import { generateId, LocalInput, LocalTextarea } from "../backend-nodes/graph-nodes/common";

export type RequestBodyMode = "field_builder" | "raw_json";

interface RequestBodyEditorProps {
  title?: string;
  subtitle?: string;
  mode: RequestBodyMode;
  onModeChange: (mode: RequestBodyMode) => void;
  schema?: Schema;
  onSchemaChange: (schema: Schema) => void;
}

/**
 * Dual-mode editor for the request body schema or any object schema.
 *
 * - field_builder: structured field rows (name + type + required toggle), same
 *   look as ParameterEditor. Persists to schema.fields[].
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
}) => {
  // ---- shared helpers --------------------------------------------------------
  const safeSchema: Schema = schema || { id: generateId() };
  const rawFields = safeSchema.fields || [];
  const fields: Parameter[] = React.useMemo(() => {
    return rawFields.map((f, idx) => ({
      ...f,
      id: f.id || `f_${idx}_${f.name || generateId()}`,
    }));
  }, [rawFields]);


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

  // Reset local raw state when schema changes externally (e.g. mode switch or live sync)
  const prevRawRef = React.useRef(schema?.rawJson);
  const prevModeRef = React.useRef(mode);
  if (prevModeRef.current !== mode || prevRawRef.current !== schema?.rawJson) {
    prevModeRef.current = mode;
    prevRawRef.current = schema?.rawJson;
    setRawInput(undefined);
    setJsonError(null);
  }

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
          {fields.map((f, idx) => (
            <div
              key={f.id || `field_${idx}_${f.name}`}
              className="flex flex-col gap-1.5 rounded-lg border bg-background/50 p-2.5 group/f transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <LocalInput
                  className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1 placeholder:font-sans"
                  placeholder="fieldName"
                  value={f.name || ""}
                  onBlur={(e) => updateField(f.id, { name: e.target.value })}
                />

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
                  <X size={14} />
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
                    <X size={10} />
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
            placeholder={'{ "email": "string", "password": "string" }'}
            value={rawInput !== undefined ? rawInput : safeSchema.rawJson || ""}
            onChange={(e) => handleRawChange(e.target.value)}
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
