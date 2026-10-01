import React, { useState, useMemo, useCallback } from "react";
import {
  FileJson,
  Settings,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { Button } from "@workspace/ui/components/button";
import { LocalInput } from "../../../../../common";
import {
  RequestBodyEditor,
  RequestBodyMode,
} from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/RequestBodyEditor";
import { parseRelaxedJson } from "@/lib/compiler/generators/routeGenerator/jsonInterpolation";
import type { LangGraphAgentResponseFormatConfig } from "../../../types";
import type { Schema, Parameter } from "@/types/canvas";
import { RESPONSE_FORMAT_PRESETS } from "../../../constants";

function schemaFieldsToJsonSchema(fields: Parameter[]): string {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const f of fields) {
    if (!f.name?.trim()) continue;
    const name = f.name.trim();
    const isArr = Boolean(f.isArray || f.type?.endsWith("[]"));
    const baseType = (f.type || "string").replace(/\[\]$/, "").toLowerCase();

    let jsonType = "string";
    if (baseType === "number" || baseType === "integer" || baseType === "float") {
      jsonType = "number";
    } else if (baseType === "boolean" || baseType === "bool") {
      jsonType = "boolean";
    } else if (baseType === "object" || baseType === "json" || baseType === "record") {
      jsonType = "object";
    }

    const propDef: Record<string, unknown> = isArr
      ? { type: "array", items: { type: jsonType } }
      : { type: jsonType };

    if (f.description && f.description.trim()) {
      propDef.description = f.description.trim();
    }
    if (baseType === "enum" && f.enumValues && f.enumValues.length > 0) {
      if (isArr) {
        propDef.items = { type: "string", enum: f.enumValues };
      } else {
        propDef.enum = f.enumValues;
      }
    }

    properties[name] = propDef;
    if (f.required !== false) {
      required.push(name);
    }
  }

  return JSON.stringify(
    {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
    null,
    2,
  );
}

function parseSchemaJsonToFields(schemaJson?: string): {
  fields: Parameter[];
  rawText: string;
} {
  if (!schemaJson || !schemaJson.trim()) {
    return { fields: [], rawText: "" };
  }
  const clean = schemaJson.trim();
  try {
    const { parsed } = parseRelaxedJson(clean);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { fields: [], rawText: clean };
    }
    const obj = parsed as Record<string, unknown>;

    // Case 1: Standard JSON Schema with properties
    if (obj.properties && typeof obj.properties === "object") {
      const props = obj.properties as Record<string, Record<string, unknown>>;
      const requiredList = Array.isArray(obj.required) ? (obj.required as string[]) : [];
      const fields: Parameter[] = Object.entries(props).map(([key, def], idx) => {
        const isArray = def.type === "array";
        const baseType = isArray
          ? (typeof def.items === "object" && def.items && "type" in def.items
              ? String((def.items as Record<string, unknown>).type)
              : "string")
          : String(def.type || "string");
        return {
          id: `f_${idx}_${key}`,
          name: key,
          type: isArray ? `${baseType}[]` : baseType,
          isArray,
          required: requiredList.includes(key),
          description: typeof def.description === "string" ? def.description : undefined,
          enumValues: Array.isArray(def.enum) ? (def.enum as string[]) : undefined,
        };
      });
      return { fields, rawText: clean };
    }

    // Case 2: Relaxed/shorthand key-value map, e.g. { "aiResponse": "string" }
    const fields: Parameter[] = Object.entries(obj).map(([key, val], idx) => {
      const valStr = typeof val === "string" ? val.toLowerCase() : "string";
      const isArray = valStr.endsWith("[]");
      const baseType = isArray ? valStr.slice(0, -2) : valStr;
      return {
        id: `f_${idx}_${key}`,
        name: key,
        type: isArray ? `${baseType}[]` : baseType,
        isArray,
        required: true,
      };
    });
    return { fields, rawText: clean };
  } catch {
    return { fields: [], rawText: clean };
  }
}

function normalizeRelaxedOrShorthandJson(raw: string): string {
  if (!raw.trim()) return "";
  try {
    const { parsed, error } = parseRelaxedJson(raw);
    if (error || !parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return raw;
    }
    const obj = parsed as Record<string, unknown>;
    // If it's already a full JSON Schema with properties
    if (obj.properties && typeof obj.properties === "object") {
      return JSON.stringify(obj, null, 2);
    }
    // If it's shorthand key-value: e.g. { "aiResponse": "string" }
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const typeStr = typeof v === "string" ? v.toLowerCase() : "string";
      const isArr = typeStr.endsWith("[]");
      const baseType = isArr ? typeStr.slice(0, -2) : typeStr;
      let jsonType = "string";
      if (baseType === "number" || baseType === "integer" || baseType === "float") jsonType = "number";
      else if (baseType === "boolean" || baseType === "bool") jsonType = "boolean";
      else if (baseType === "object" || baseType === "json" || baseType === "record") jsonType = "object";

      properties[k] = isArr ? { type: "array", items: { type: jsonType } } : { type: jsonType };
      required.push(k);
    }
    return JSON.stringify(
      {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
      null,
      2,
    );
  } catch {
    return raw;
  }
}

interface AgentStructuredOutputSectionProps {
  rfConfig: LangGraphAgentResponseFormatConfig;
  updateResponseFormat: (
    changes: Partial<LangGraphAgentResponseFormatConfig>,
  ) => void;
}

export function AgentStructuredOutputSection({
  rfConfig,
  updateResponseFormat,
}: AgentStructuredOutputSectionProps) {
  const [editorMode, setEditorMode] = useState<RequestBodyMode>("field_builder");

  // Keep local draft fields so newly added rows (where name is still empty) persist in the UI
  const [localFields, setLocalFields] = useState<Parameter[]>(() => {
    return parseSchemaJsonToFields(rfConfig.schemaJson).fields;
  });

  const lastSyncedJsonRef = React.useRef(rfConfig.schemaJson || "");

  // Sync from external changes (e.g. Presets dropdown or Clear button)
  React.useEffect(() => {
    if (rfConfig.schemaJson !== lastSyncedJsonRef.current) {
      lastSyncedJsonRef.current = rfConfig.schemaJson || "";
      const parsed = parseSchemaJsonToFields(rfConfig.schemaJson);
      setLocalFields(parsed.fields);
    }
  }, [rfConfig.schemaJson]);

  const currentSchema: Schema = useMemo(() => {
    return {
      id: "agent_response_schema",
      fields: localFields,
      rawJson: rfConfig.schemaJson || "",
      mode: editorMode,
    };
  }, [localFields, rfConfig.schemaJson, editorMode]);

  const handleSchemaChange = useCallback(
    (newSchema: Schema) => {
      if (editorMode === "field_builder") {
        const updatedFields = newSchema.fields || [];
        setLocalFields(updatedFields);

        // Compile only fields with names to valid JSON Schema
        const compiledJson = schemaFieldsToJsonSchema(updatedFields);
        lastSyncedJsonRef.current = compiledJson;
        updateResponseFormat({ schemaJson: compiledJson });
      } else {
        const raw = newSchema.rawJson || "";
        const normalized = normalizeRelaxedOrShorthandJson(raw);
        lastSyncedJsonRef.current = normalized;
        updateResponseFormat({ schemaJson: normalized });
      }
    },
    [editorMode, updateResponseFormat],
  );

  const handleModeChange = useCallback(
    (newMode: RequestBodyMode) => {
      setEditorMode(newMode);
      if (newMode === "raw_json") {
        if (localFields.length > 0) {
          const compiled = schemaFieldsToJsonSchema(localFields);
          lastSyncedJsonRef.current = compiled;
          updateResponseFormat({ schemaJson: compiled });
        }
      } else {
        const parsed = parseSchemaJsonToFields(rfConfig.schemaJson);
        setLocalFields(parsed.fields);
      }
    },
    [localFields, rfConfig.schemaJson, updateResponseFormat],
  );

  return (
    <div className="flex flex-col gap-4 p-3 bg-secondary/10 rounded-xl border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-md border ${
              rfConfig.enabled
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary/30 border-border text-muted-foreground"
            }`}
          >
            <FileJson className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              Structured Output
            </h3>
            <p className="text-[10px] font-mono text-muted-foreground">
              createAgent({`{ responseFormat: ... }`})
            </p>
          </div>
        </div>

        <Switch
          checked={Boolean(rfConfig.enabled)}
          onCheckedChange={(enabled) => updateResponseFormat({ enabled })}
        />
      </div>

      {rfConfig.enabled && (
        <div className="flex flex-col gap-4 pt-2 border-t border-border/50">
          {/* Strategy Choice: Provider vs Tool vs Auto */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
              Response Strategy
            </Label>
            <Select
              value={rfConfig.strategy || "auto"}
              onValueChange={(val: "auto" | "provider" | "tool") =>
                updateResponseFormat({ strategy: val })
              }
            >
              <SelectTrigger className="h-7 text-xs bg-background font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="provider">Provider Strategy</SelectItem>
                <SelectItem value="tool">Tool Strategy</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {rfConfig.strategy === "provider"
                ? "Uses native model provider API (OpenAI, Gemini, Claude, Grok). High reliability."
                : rfConfig.strategy === "tool"
                  ? "Emulates structured response via tool calling and state validation."
                  : "Automatically selects providerStrategy if model supports native output, fallback to toolStrategy."}
            </p>
          </div>

          {/* Visual Schema Builder using RequestBodyEditor */}
          <div className="flex flex-col gap-2">
            <RequestBodyEditor
              title="Schema Fields"
              subtitle="Add fields visually or edit raw JSON"
              mode={editorMode}
              onModeChange={handleModeChange}
              schema={currentSchema}
              onSchemaChange={handleSchemaChange}
              headerActions={
                <div className="flex items-center gap-1">
                  <Select
                    value=""
                    onValueChange={(presetId) => {
                      const found = RESPONSE_FORMAT_PRESETS.find(
                        (p) => p.id === presetId,
                      );
                      if (found?.jsonSchema) {
                        updateResponseFormat({ schemaJson: found.jsonSchema });
                      }
                    }}
                  >
                    <SelectTrigger className="h-6 text-[10px] px-2 font-mono bg-background/80 border-border/50">
                      <SelectValue placeholder="Presets" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESPONSE_FORMAT_PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {rfConfig.schemaJson && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Clear schema"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => updateResponseFormat({ schemaJson: "" })}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              }
            />
          </div>

          {/* Tool Strategy Specific Options */}
          {(rfConfig.strategy === "tool" ||
            rfConfig.strategy === "auto" ||
            !rfConfig.strategy) && (
            <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Tool Calling Strategy Options
              </span>

              {/* Custom Tool Message Content */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  Custom Tool Message Content
                </Label>
                <LocalInput
                  value={rfConfig.toolMessageContent || ""}
                  onChange={(e) =>
                    updateResponseFormat({ toolMessageContent: e.target.value })
                  }
                  className="h-7 text-xs font-mono bg-background"
                  placeholder="Action item captured and added to state!"
                />
                <p className="text-[9px] text-muted-foreground">
                  Custom message in conversation history when structured output
                  is generated.
                </p>
              </div>

              {/* Error Handling Strategy */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                  Schema Error Handling
                </Label>
                <Select
                  value={rfConfig.handleErrorMode || "default"}
                  onValueChange={(
                    val: "default" | "custom_message" | "disabled",
                  ) => updateResponseFormat({ handleErrorMode: val })}
                >
                  <SelectTrigger className="h-7 text-xs bg-background font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Auto-Retry</SelectItem>
                    <SelectItem value="custom_message">
                      Custom Error Prompt
                    </SelectItem>
                    <SelectItem value="disabled">Disable Retry</SelectItem>
                  </SelectContent>
                </Select>

                {rfConfig.handleErrorMode === "custom_message" && (
                  <LocalInput
                    value={rfConfig.customErrorMessage || ""}
                    onChange={(e) =>
                      updateResponseFormat({
                        customErrorMessage: e.target.value,
                      })
                    }
                    className="h-7 text-xs font-mono bg-background mt-1"
                    placeholder="Please provide valid rating between 1-5..."
                  />
                )}
              </div>
            </div>
          )}

          <div className="p-2 rounded bg-secondary/20 border border-border/50 text-[10px] font-mono text-muted-foreground">
            Output will be captured in{" "}
            <code className="text-foreground">result.structuredResponse</code>{" "}
            channel of agent state.
          </div>
        </div>
      )}
    </div>
  );
}
