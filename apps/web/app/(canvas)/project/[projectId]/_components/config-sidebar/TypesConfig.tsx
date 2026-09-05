"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Button } from "@workspace/ui/components/button";
import {
  Plus,
  Trash,
  Text,
  Copy,
  Check,
  Code2,
  Sparkles,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { useBufferedInput } from "@/lib/hooks/useBufferedInput";
import type {
  CustomTypeItem,
  CustomTypeField,
  CustomTypeKind,
} from "@workspace/canvas/types";

export interface TypesConfigProps {
  id: string;
  nodeId: string;
  selectedTypeId?: string;
}

const PRIMITIVE_TYPES = [
  "string",
  "number",
  "boolean",
  "Date",
  "any",
  "Record<string, unknown>",
];

// --- Memoized Property Row with Buffered Inputs for instant 0ms typing ---
interface TypePropertyRowProps {
  field: CustomTypeField;
  otherCustomTypes: string[];
  onUpdate: (updates: Partial<CustomTypeField>) => void;
  onDelete: () => void;
}

const TypePropertyRow = React.memo(
  ({ field, otherCustomTypes, onUpdate, onDelete }: TypePropertyRowProps) => {
    const nameBuffer = useBufferedInput(
      field.name || "",
      useCallback((name: string) => onUpdate({ name }), [onUpdate]),
      200,
    );

    const descBuffer = useBufferedInput(
      field.description || "",
      useCallback(
        (description: string) => onUpdate({ description }),
        [onUpdate],
      ),
      200,
    );

    const isFieldArray = Boolean(
      field.isArray || field.type?.endsWith("[]"),
    );
    const baseType = (field.type || "string").replace(/\[\]$/, "");

    const toggleArray = () => {
      if (isFieldArray) {
        onUpdate({ type: baseType, isArray: false });
      } else {
        onUpdate({ type: `${baseType}[]`, isArray: true });
      }
    };

    const handleTypeChange = (selectedBase: string) => {
      const cleanBase = selectedBase.replace(/\[\]$/, "");
      const newType = isFieldArray ? `${cleanBase}[]` : cleanBase;
      onUpdate({ type: newType, isArray: isFieldArray });
    };

    return (
      <div className="flex flex-col gap-2 rounded-lg border bg-background/50 p-2.5 relative group/param transition-all hover:border-primary/30 hover:shadow-sm">
        <div className="flex items-center gap-2">
          <Input
            className="h-7 text-xs flex-1 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1 placeholder:font-sans"
            placeholder="Property name"
            value={nameBuffer.value}
            onChange={(e) => nameBuffer.onChange(e.target.value)}
            onBlur={nameBuffer.flush}
          />

          {/* Type Select: Primitives + Available Custom Types */}
          <Select
            value={baseType}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger className="h-7 w-[140px] text-xs py-0 nodrag bg-secondary/50 border-none font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[260px]">
              <SelectGroup>
                <SelectLabel className="text-[10px] font-bold uppercase text-muted-foreground">
                  Primitives
                </SelectLabel>
                {PRIMITIVE_TYPES.map((pt) => (
                  <SelectItem key={pt} value={pt} className="text-xs font-mono">
                    {pt}
                  </SelectItem>
                ))}
              </SelectGroup>

              {otherCustomTypes.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-bold uppercase text-indigo-500 dark:text-indigo-400">
                    Custom Types
                  </SelectLabel>
                  {otherCustomTypes.map((ct) => (
                    <SelectItem key={ct} value={ct} className="text-xs font-mono">
                      {ct}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {/* Array [] toggle button (replaces REQUIRED button) */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={
              isFieldArray
                ? "Array type active (click to make single)"
                : "Single type (click to make array [])"
            }
            className={cn(
              "h-7 px-3 font-mono text-xs font-bold nodrag rounded-full transition-all cursor-pointer",
              isFieldArray
                ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 ring-1 ring-primary/30"
                : "bg-secondary/60 text-muted-foreground/80 hover:bg-secondary hover:text-foreground border border-border/40",
            )}
            onClick={toggleArray}
          >
            []
          </Button>

          {/* Add Description toggle button */}
          {field.description === undefined && (
            <Button
              size="icon"
              variant="ghost"
              title="Add Description"
              className="h-7 w-7 opacity-0 group-hover/param:opacity-100 text-muted-foreground hover:bg-secondary shrink-0 transition-all rounded-full"
              onClick={() => onUpdate({ description: "" })}
            >
              <Text size={14} />
            </Button>
          )}

          {/* Delete Field button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 opacity-0 group-hover/param:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all rounded-full"
            onClick={onDelete}
          >
            <Trash size={14} />
          </Button>
        </div>

        {/* Description row (matching ParameterEditor) */}
        {field.description !== undefined && (
          <div className="relative w-full">
            <Input
              className="h-6 text-[10px] pl-2.5 pr-6 w-full nodrag bg-transparent border-none shadow-none text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:bg-secondary/30 rounded"
              placeholder="Add a description..."
              value={descBuffer.value}
              onChange={(e) => descBuffer.onChange(e.target.value)}
              onBlur={descBuffer.flush}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 absolute right-0.5 top-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-all rounded"
              onClick={() => onUpdate({ description: undefined })}
            >
              <Trash size={10} />
            </Button>
          </div>
        )}
      </div>
    );
  },
);
TypePropertyRow.displayName = "TypePropertyRow";

// --- Memoized Enum Constant Row with Buffered Input ---
interface TypeEnumConstantRowProps {
  value: string;
  onUpdate: (val: string) => void;
  onDelete: () => void;
}

const TypeEnumConstantRow = React.memo(
  ({ value, onUpdate, onDelete }: TypeEnumConstantRowProps) => {
    const valBuffer = useBufferedInput(
      value || "",
      useCallback(
        (v: string) => onUpdate(v.toUpperCase().replace(/\s+/g, "_")),
        [onUpdate],
      ),
      200,
    );

    return (
      <div className="flex items-center gap-2 rounded-lg border bg-background/50 p-2.5 group/param transition-all hover:border-primary/30 hover:shadow-sm">
        <Input
          className="h-7 text-xs flex-1 nodrag bg-background font-mono font-semibold border-none shadow-none focus-visible:ring-1"
          placeholder="CONSTANT_NAME"
          value={valBuffer.value}
          onChange={(e) => valBuffer.onChange(e.target.value)}
          onBlur={valBuffer.flush}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover/param:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all rounded-full"
          onClick={onDelete}
        >
          <Trash size={14} />
        </Button>
      </div>
    );
  },
);
TypeEnumConstantRow.displayName = "TypeEnumConstantRow";

// --- Dedicated Type Editor Form (keyed by currentType.id for instantaneous switches) ---
interface TypeEditorFormProps {
  currentType: CustomTypeItem;
  otherCustomTypes: string[];
  onUpdateCurrentType: (updates: Partial<CustomTypeItem>) => void;
  onDeleteCurrentType: () => void;
}

const TypeEditorForm = ({
  currentType,
  otherCustomTypes,
  onUpdateCurrentType,
  onDeleteCurrentType,
}: TypeEditorFormProps) => {
  const [copied, setCopied] = useState(false);

  // Buffered inputs for Name and Description (matching EndpointConfig.tsx)
  const nameBuffer = useBufferedInput(
    currentType.name || "",
    useCallback(
      (name: string) => onUpdateCurrentType({ name }),
      [onUpdateCurrentType],
    ),
    200,
  );

  const descBuffer = useBufferedInput(
    currentType.description || "",
    useCallback(
      (description: string) => onUpdateCurrentType({ description }),
      [onUpdateCurrentType],
    ),
    200,
  );

  const handleAddField = useCallback(() => {
    const currentFields = currentType.fields || [];
    const newField: CustomTypeField = {
      id: `f-${Date.now()}`,
      name: `prop${currentFields.length + 1}`,
      type: "string",
      required: true,
      isArray: false,
    };
    onUpdateCurrentType({ fields: [...currentFields, newField] });
  }, [currentType.fields, onUpdateCurrentType]);

  const handleUpdateField = useCallback(
    (fieldId: string, fieldUpdates: Partial<CustomTypeField>) => {
      const updatedFields = (currentType.fields || []).map((f) =>
        f.id === fieldId ? { ...f, ...fieldUpdates } : f,
      );
      onUpdateCurrentType({ fields: updatedFields });
    },
    [currentType.fields, onUpdateCurrentType],
  );

  const handleDeleteField = useCallback(
    (fieldId: string) => {
      const updatedFields = (currentType.fields || []).filter(
        (f) => f.id !== fieldId,
      );
      onUpdateCurrentType({ fields: updatedFields });
    },
    [currentType.fields, onUpdateCurrentType],
  );

  const handleAddEnumValue = useCallback(() => {
    const currentValues = currentType.enumValues || [];
    const newVal = `VALUE_${currentValues.length + 1}`;
    onUpdateCurrentType({ enumValues: [...currentValues, newVal] });
  }, [currentType.enumValues, onUpdateCurrentType]);

  const handleUpdateEnumValue = useCallback(
    (index: number, val: string) => {
      const currentValues = [...(currentType.enumValues || [])];
      currentValues[index] = val;
      onUpdateCurrentType({ enumValues: currentValues });
    },
    [currentType.enumValues, onUpdateCurrentType],
  );

  const handleDeleteEnumValue = useCallback(
    (index: number) => {
      const currentValues = (currentType.enumValues || []).filter(
        (_, idx) => idx !== index,
      );
      onUpdateCurrentType({ enumValues: currentValues });
    },
    [currentType.enumValues, onUpdateCurrentType],
  );

  // Memoized TypeScript preview code
  const previewCode = useMemo((): string => {
    const desc = currentType.description
      ? `/**\n * ${currentType.description}\n */\n`
      : "";

    if (currentType.kind === "enum") {
      const vals = currentType.enumValues || [];
      if (vals.length === 0) return `${desc}export enum ${currentType.name} {}\n`;
      const lines = vals.map((v) => `  ${v} = "${v}",`).join("\n");
      return `${desc}export enum ${currentType.name} {\n${lines}\n}\n`;
    }

    const fields = currentType.fields || [];
    const fieldLines = fields
      .map((f) => {
        const isArr = Boolean(f.isArray || f.type?.endsWith("[]"));
        const base = (f.type || "string").replace(/\[\]$/, "");
        const finalType = isArr ? `${base}[]` : base;
        const opt = f.required === false ? "?" : "";
        const comment = f.description ? ` // ${f.description}` : "";
        return `  ${f.name || "prop"}${opt}: ${finalType};${comment}`;
      })
      .join("\n");

    if (currentType.kind === "type") {
      return `${desc}export type ${currentType.name} = {\n${fieldLines}\n};\n`;
    }

    return `${desc}export interface ${currentType.name} {\n${fieldLines}\n}\n`;
  }, [currentType]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(previewCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Type Header - Kind and Name (buffered, matching EndpointConfig.tsx) */}
      <div className="flex flex-col gap-2.5 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2">
          <Select
            value={currentType.kind}
            onValueChange={(kind: CustomTypeKind) =>
              onUpdateCurrentType({ kind })
            }
          >
            <SelectTrigger className="h-8 w-[115px] text-xs font-mono font-bold bg-primary/15 text-primary border-primary/30 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interface" className="text-xs font-mono font-bold">
                INTERFACE
              </SelectItem>
              <SelectItem value="type" className="text-xs font-mono font-bold">
                TYPE
              </SelectItem>
              <SelectItem value="enum" className="text-xs font-mono font-bold">
                ENUM
              </SelectItem>
            </SelectContent>
          </Select>

          <Input
            className="h-8 text-sm font-semibold tracking-tight text-foreground bg-background font-mono flex-1"
            placeholder="TypeName (e.g. UserProfile)"
            value={nameBuffer.value}
            onChange={(e) => nameBuffer.onChange(e.target.value)}
            onBlur={nameBuffer.flush}
          />

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 rounded-lg"
            onClick={onDeleteCurrentType}
            title="Delete this type"
          >
            <Trash size={14} />
          </Button>
        </div>

        <span className="text-xs text-muted-foreground">
          Configure flat object schema properties and reference reusable custom types.
        </span>
      </div>

      {/* Description Section (buffered, matching EndpointConfig.tsx summary) */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Description
        </Label>
        <Input
          className="bg-background/50"
          placeholder="e.g. Represents user profile and credentials."
          value={descBuffer.value}
          onChange={(e) => descBuffer.onChange(e.target.value)}
          onBlur={descBuffer.flush}
        />
      </div>

      {/* Properties Editor (Flat Object) - Reusing exact ParameterEditor style from EndpointConfig.tsx */}
      {currentType.kind === "enum" ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Enum Constants ({(currentType.enumValues || []).length})
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-[10px] gap-1 rounded-full px-3"
              onClick={handleAddEnumValue}
            >
              <Plus size={12} /> Add Constant
            </Button>
          </div>

          <div className="flex flex-col gap-2.5 mt-1">
            {(currentType.enumValues || []).map((val, idx) => (
              <TypeEnumConstantRow
                key={idx}
                value={val}
                onUpdate={(newVal) => handleUpdateEnumValue(idx, newVal)}
                onDelete={() => handleDeleteEnumValue(idx)}
              />
            ))}
            {(currentType.enumValues || []).length === 0 && (
              <span className="text-xs text-muted-foreground/60 italic py-2">
                No constants added yet. Click &quot;Add Constant&quot; above.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Properties ({(currentType.fields || []).length})
              </span>
              {otherCustomTypes.length > 0 && (
                <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                  <Sparkles size={11} /> {otherCustomTypes.length} custom types
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-[10px] gap-1 rounded-full px-3"
              onClick={handleAddField}
            >
              <Plus size={12} /> Add Property
            </Button>
          </div>

          <div className="flex flex-col gap-2.5 mt-1">
            {(currentType.fields || []).map((f) => (
              <TypePropertyRow
                key={f.id}
                field={f}
                otherCustomTypes={otherCustomTypes}
                onUpdate={(updates) => handleUpdateField(f.id, updates)}
                onDelete={() => handleDeleteField(f.id)}
              />
            ))}

            {(currentType.fields || []).length === 0 && (
              <span className="text-xs text-muted-foreground/60 italic py-2">
                No properties defined yet. Click &quot;Add Property&quot; above.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Generated TypeScript Preview Section */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Code2 size={14} className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              TypeScript Preview
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyCode}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>

        <pre className="p-3 rounded-lg bg-background/80 border text-[11px] font-mono text-foreground/90 overflow-x-auto max-h-[220px] whitespace-pre">
          {previewCode}
        </pre>
      </div>
    </>
  );
};

// --- Main TypesConfig Component ---
export const TypesConfig: React.FC<TypesConfigProps> = ({
  id,
  nodeId,
  selectedTypeId,
}) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === (nodeId || id)),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);

  const [activeTypeId, setActiveTypeId] = useState<string | undefined>(
    selectedTypeId,
  );

  const data = node?.data;
  const types: CustomTypeItem[] = useMemo(
    () => (data && Array.isArray(data.types) ? data.types : []),
    [data],
  );

  // Set active type to selectedTypeId if provided, or default to first type
  useEffect(() => {
    if (selectedTypeId) {
      setActiveTypeId(selectedTypeId);
    } else if (!activeTypeId && types.length > 0) {
      setActiveTypeId(types[0]?.id);
    }
  }, [selectedTypeId, types, activeTypeId]);

  const allNodes = useBackendCanvasStore((s) => s.nodes);

  const currentType = useMemo(() => {
    return types.find((t) => t.id === activeTypeId) || types[0];
  }, [types, activeTypeId]);

  // Exclude only the currently edited type itself (so Type 2 sees Type 3, and Type 3 sees Type 2!)
  const otherCustomTypes = useMemo(() => {
    const list: string[] = [];
    allNodes.forEach((tn) => {
      if (tn.type === "types") {
        const typeList = (tn.data?.types as CustomTypeItem[]) || [];
        typeList.forEach((item) => {
          if (
            item.name &&
            item.name.trim().length > 0 &&
            item.id !== currentType?.id &&
            item.name.trim() !== currentType?.name?.trim()
          ) {
            list.push(item.name.trim());
          }
        });
      }
    });
    return Array.from(new Set(list));
  }, [allNodes, currentType?.id, currentType?.name]);

  const updateTypesList = useCallback(
    (updated: CustomTypeItem[]) => {
      if (!node || !data) return;
      updateNode(node.id, {
        data: {
          ...data,
          types: updated,
        },
      });
    },
    [node, data, updateNode],
  );

  const handleUpdateCurrentType = useCallback(
    (updates: Partial<CustomTypeItem>) => {
      if (!currentType) return;
      const updated = types.map((t) =>
        t.id === currentType.id ? { ...t, ...updates } : t,
      );
      updateTypesList(updated);
    },
    [currentType, types, updateTypesList],
  );

  const handleAddType = useCallback(() => {
    const newId = `type-${Date.now()}`;
    const newType: CustomTypeItem = {
      id: newId,
      name: `Type${types.length + 1}`,
      kind: "interface",
      description: "",
      fields: [
        { id: `f-${Date.now()}-1`, name: "id", type: "string", required: true, isArray: false },
        { id: `f-${Date.now()}-2`, name: "name", type: "string", required: true, isArray: false },
      ],
    };
    updateTypesList([...types, newType]);
    setActiveTypeId(newId);
  }, [types, updateTypesList]);

  const handleDeleteCurrentType = useCallback(() => {
    if (!currentType) return;
    const remaining = types.filter((t) => t.id !== currentType.id);
    updateTypesList(remaining);
    setActiveTypeId(remaining[0]?.id);
  }, [currentType, types, updateTypesList]);

  if (!node || !data) return null;

  return (
    <div className="flex flex-col gap-6 mt-6 pb-12">
      {/* Type Navigator Bar if multiple types exist */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-card/50 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            Selected Type:
          </span>
          <Select
            value={currentType?.id}
            onValueChange={(val) => setActiveTypeId(val)}
          >
            <SelectTrigger className="h-8 text-xs font-mono font-semibold bg-background flex-1 max-w-[220px]">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                  {t.name} ({t.kind})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-[10px] gap-1 rounded-full px-3 shrink-0"
          onClick={handleAddType}
        >
          <Plus size={12} /> Add Type
        </Button>
      </div>

      {currentType ? (
        <TypeEditorForm
          key={currentType.id}
          currentType={currentType}
          otherCustomTypes={otherCustomTypes}
          onUpdateCurrentType={handleUpdateCurrentType}
          onDeleteCurrentType={handleDeleteCurrentType}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-dashed text-center gap-3">
          <p className="text-sm text-muted-foreground">
            No types defined on this node yet.
          </p>
          <Button size="sm" onClick={handleAddType} className="text-xs">
            <Plus size={14} className="mr-1" /> Add Type
          </Button>
        </div>
      )}
    </div>
  );
};
