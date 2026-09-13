import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash, Code2, Check, AlertCircle, Copy, Sparkles, Braces, Layers } from "lucide-react";
import { BackendNode, RedisHashField, isRedisHashFieldType } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { syncColumnsFromFields } from "../../constants";
import { parseRawJsonSafe, formatJsonPretty } from "@/lib/utils/nestedJsonSchema";
import { jsonToTypeScriptInterfaces } from "@/lib/compiler/redis/utils";
import { toast } from "sonner";

import {
  DEFAULT_CONVERSATION_SCHEMA,
  DEFAULT_OBJECT_SCHEMA,
} from "@workspace/canvas/constants";

export interface JsonStructureConfigProps {
  data: BackendNode["data"];
  hashFields: RedisHashField[];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const JsonStructureConfig: React.FC<JsonStructureConfigProps> = ({
  data,
  hashFields,
  updateData,
}) => {
  const isNested = Boolean(data.isNestedJsonSchema);
  const rawSchema = data.rawJsonSchema || "";
  const rootType = data.jsonRootType || "object";

  const [localRaw, setLocalRaw] = useState(rawSchema);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocalRaw(data.rawJsonSchema || "");
  }, [data.rawJsonSchema]);

  // Parse & Validate Raw JSON
  const validation = useMemo(() => {
    if (!localRaw.trim()) {
      return { isValid: false, error: "Empty schema", parsed: null, isArray: false };
    }
    const { parsed, error } = parseRawJsonSafe(localRaw);
    if (error || parsed === null) {
      return { isValid: false, error: error || "Invalid JSON syntax", parsed: null, isArray: false };
    }
    const isArray = Array.isArray(parsed);
    return { isValid: true, error: null, parsed, isArray };
  }, [localRaw]);

  // Derived TypeScript preview
  const generatedTypes = useMemo(() => {
    if (!validation.isValid || !validation.parsed) return null;
    return jsonToTypeScriptInterfaces(data.label || "Conversation", validation.parsed);
  }, [validation, data.label]);

  const commitRawSchema = (content: string) => {
    setLocalRaw(content);
    const { parsed, error } = parseRawJsonSafe(content);
    if (!error && parsed !== null && typeof parsed === "object") {
      const isArray = Array.isArray(parsed);
      const typeInfo = jsonToTypeScriptInterfaces(data.label || "Conversation", parsed);

      updateData({
        rawJsonSchema: content,
        isNestedJsonSchema: true,
        jsonRootType: isArray ? "array" : "object",
        columns: typeInfo.topLevelFields.map((f) => ({
          name: f.name,
          type: f.type,
        })),
      });
    } else {
      updateData({ rawJsonSchema: content, isNestedJsonSchema: true });
    }
  };

  const handleCopy = () => {
    if (generatedTypes?.interfacesCode) {
      navigator.clipboard.writeText(generatedTypes.interfacesCode);
      setCopied(true);
      toast.success("TypeScript types copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-3 border-t border-border/40">
      {/* 1. Mode Switch: Drop/Paste JSON vs Field Builder */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-red-500/20 bg-red-500/5 dark:bg-red-950/20 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <Label
            htmlFor="nested-json-toggle"
            className="text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 size={14} className="text-red-600 dark:text-red-400" />
            Define via Nested JSON Schema (Drop / Paste JSON)
          </Label>
          <span className="text-[10px] text-muted-foreground">
            Drop an example JSON payload (e.g. conversation array) to auto-infer complex types.
          </span>
        </div>
        <Switch
          id="nested-json-toggle"
          checked={isNested}
          onCheckedChange={(checked) => {
            if (checked && !localRaw.trim()) {
              commitRawSchema(DEFAULT_CONVERSATION_SCHEMA);
            } else {
              updateData({ isNestedJsonSchema: checked });
            }
          }}
          className="scale-95"
        />
      </div>

      {isNested ? (
        /* ── NESTED / RAW JSON DROP AREA ── */
        <div className="flex flex-col gap-3">
          {/* Action Bar & Presets */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-semibold">Templates:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1 bg-background hover:border-red-500/40"
                onClick={() => commitRawSchema(DEFAULT_CONVERSATION_SCHEMA)}
              >
                <Braces size={10} /> Chat Array [{}]
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1 bg-background hover:border-red-500/40"
                onClick={() => commitRawSchema(DEFAULT_OBJECT_SCHEMA)}
              >
                <Layers size={10} /> Nested Object {}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                const formatted = formatJsonPretty(localRaw);
                commitRawSchema(formatted);
              }}
            >
              <Sparkles size={11} className="text-amber-500" /> Format JSON
            </Button>
          </div>

          {/* Code Textarea */}
          <div className="relative flex flex-col gap-1.5">
            <textarea
              value={localRaw}
              onChange={(e) => setLocalRaw(e.target.value)}
              onBlur={() => commitRawSchema(localRaw)}
              placeholder="Paste or drop sample JSON here..."
              rows={8}
              className="w-full text-xs font-mono p-3 rounded-lg border border-border/60 bg-background/90 text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-red-500/40 leading-relaxed shadow-inner"
            />

            {/* Validation & Detected Structure Pill */}
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              {validation.isValid ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1"
                  >
                    <Check size={11} /> Valid JSON
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono font-bold ${
                      validation.isArray
                        ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40"
                        : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40"
                    }`}
                  >
                    Root: {validation.isArray ? "Array of Objects (JSON[])" : "Single Object (JSON{})"}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-destructive text-[11px]">
                  <AlertCircle size={12} />
                  <span className="truncate max-w-[320px]">{validation.error}</span>
                </div>
              )}
            </div>
          </div>

          {/* TypeScript Code Preview */}
          {generatedTypes && (
            <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-border/50 bg-secondary/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Code2 size={12} className="text-red-500" /> Inferred TypeScript Types
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="p-2.5 rounded-lg bg-background/80 border border-border/40 text-[10.5px] font-mono text-foreground/90 overflow-x-auto max-h-40 leading-relaxed select-all">
                {generatedTypes.interfacesCode}
              </pre>
            </div>
          )}
        </div>
      ) : (
        /* ── STANDARD FIELD-BY-FIELD BUILDER ── */
        <div className="flex flex-col gap-3">
          {/* Root Type Selector (Object vs Array) */}
          <div className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-background/60">
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Document Root Type</span>
              <span className="text-[10px] text-muted-foreground">Top-level Redis value structure</span>
            </div>
            <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-md border border-border/40">
              <button
                type="button"
                onClick={() => updateData({ jsonRootType: "object" })}
                className={`px-2 py-0.5 text-xs font-mono rounded ${
                  rootType !== "array"
                    ? "bg-background text-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                &#123;&#125; Object
              </button>
              <button
                type="button"
                onClick={() => updateData({ jsonRootType: "array" })}
                className={`px-2 py-0.5 text-xs font-mono rounded ${
                  rootType === "array"
                    ? "bg-red-500/20 text-red-600 dark:text-red-400 font-bold border border-red-500/30 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                &#91;&#93; Array
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                {rootType === "array" ? "Array Item Fields" : "Document Fields"} ({hashFields.length})
              </span>
              <span className="text-[10px] text-muted-foreground">
                Supports dot paths (e.g. sender.name) and nested paths.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => {
                const newField: RedisHashField = {
                  name: `field_${hashFields.length + 1}`,
                  type: "string",
                  required: false,
                };
                const nextFields = [...hashFields, newField];
                updateData({
                  hashConfig: { fields: nextFields },
                  columns: syncColumnsFromFields(nextFields),
                });
              }}
            >
              <Plus size={12} /> Add Field
            </Button>
          </div>

          {hashFields.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground italic text-center border border-dashed border-border/60 rounded-lg">
              No fields defined. Click &quot;Add Field&quot; or switch to Nested JSON Schema.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {hashFields.map((f, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-border/50 bg-background/80 flex flex-col gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={f.name}
                      placeholder="field (e.g. sender.userId)"
                      onChange={(e) => {
                        const updated = [...hashFields];
                        updated[idx] = { ...updated[idx]!, name: e.target.value };
                        updateData({
                          hashConfig: { fields: updated },
                          columns: syncColumnsFromFields(updated),
                        });
                      }}
                      className="h-7 text-xs font-mono flex-1"
                    />
                    <Select
                      value={f.type}
                      onValueChange={(val) => {
                        if (isRedisHashFieldType(val)) {
                          const updated = [...hashFields];
                          updated[idx] = { ...updated[idx]!, type: val };
                          updateData({
                            hashConfig: { fields: updated },
                            columns: syncColumnsFromFields(updated),
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">string</SelectItem>
                        <SelectItem value="number">number</SelectItem>
                        <SelectItem value="boolean">boolean</SelectItem>
                        <SelectItem value="json">nested json</SelectItem>
                        <SelectItem value="datetime">datetime</SelectItem>
                        <SelectItem value="binary">binary</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => {
                        const updated = hashFields.filter((_, i) => i !== idx);
                        updateData({
                          hashConfig: { fields: updated },
                          columns: syncColumnsFromFields(updated),
                        });
                      }}
                    >
                      <Trash size={12} />
                    </Button>
                  </div>
                  <Input
                    placeholder="Optional path or field description..."
                    value={f.description || ""}
                    onChange={(e) => {
                      const updated = [...hashFields];
                      updated[idx] = { ...updated[idx]!, description: e.target.value };
                      updateData({ hashConfig: { fields: updated } });
                    }}
                    className="h-6 text-[11px] bg-background/60"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
