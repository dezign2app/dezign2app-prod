"use client";

import React, { useMemo, useCallback } from "react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Layers, Plus, Trash2, AlertCircle } from "lucide-react";
import { GlobalStoreField, JsonValue } from "@workspace/canvas/types";
import { TypeCombobox } from "../TypeCombobox";
import { LocalInput } from "../../backend-nodes/graph-nodes/shared";
import { cn } from "@workspace/ui/lib/utils";

export interface StoreFieldsSectionProps {
  fields: GlobalStoreField[];
  onAddField: () => void;
  onUpdateField: (fieldId: string, patch: Partial<GlobalStoreField>) => void;
  onRemoveField: (fieldId: string) => void;
}

interface StoreFieldRowProps {
  field: GlobalStoreField;
  isDuplicate?: boolean;
  onUpdateField: (fieldId: string, patch: Partial<GlobalStoreField>) => void;
  onRemoveField: (fieldId: string) => void;
}

const StoreFieldRow = React.memo(function StoreFieldRow({
  field,
  isDuplicate = false,
  onUpdateField,
  onRemoveField,
}: StoreFieldRowProps) {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdateField(field.id, { name: e.target.value });
    },
    [field.id, onUpdateField],
  );

  const handleTypeChange = useCallback(
    (val: GlobalStoreField["type"]) => {
      onUpdateField(field.id, { type: val });
    },
    [field.id, onUpdateField],
  );

  const handleRemove = useCallback(() => {
    onRemoveField(field.id);
  }, [field.id, onRemoveField]);

  const defaultString = useMemo(() => {
    if (field.defaultValue === undefined || field.defaultValue === null) {
      return "";
    }
    if (typeof field.defaultValue === "object") {
      try {
        return JSON.stringify(field.defaultValue);
      } catch {
        return String(field.defaultValue);
      }
    }
    return String(field.defaultValue);
  }, [field.defaultValue]);

  const handleDefaultChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      let val: JsonValue | undefined = raw;
      if (raw === "") {
        val = undefined;
      } else if (field.type === "number") {
        if (raw.trim() === "" || raw === "-") {
          val = undefined;
        } else {
          const num = Number(raw);
          val = isNaN(num) ? raw : num;
        }
      } else if (field.type === "boolean") {
        const lower = raw.trim().toLowerCase();
        if (lower === "true") val = true;
        else if (lower === "false") val = false;
        else val = raw;
      } else if (field.type === "object" || field.type === "array") {
        try {
          val = JSON.parse(raw);
        } catch {
          val = raw;
        }
      }
      onUpdateField(field.id, { defaultValue: val });
    },
    [field.id, field.type, onUpdateField],
  );

  const placeholder = useMemo(() => {
    switch (field.type) {
      case "number":
        return "e.g. 0";
      case "boolean":
        return "e.g. false";
      case "string":
        return 'e.g. "default text"';
      case "array":
        return "e.g. []";
      default:
        return "e.g. null or {}";
    }
  }, [field.type]);

  return (
    <div
      className={cn(
        "p-2.5 rounded-lg bg-card/60 border space-y-2 transition-colors",
        isDuplicate ? "border-destructive/60 bg-destructive/5" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-2">
        <LocalInput
          value={field.name}
          onChange={handleNameChange}
          placeholder="Field name"
          debounceMs={150}
          className={cn(
            "h-7 text-xs font-mono flex-1",
            isDuplicate && "border-destructive text-destructive focus-visible:ring-destructive",
          )}
        />
        <TypeCombobox
          value={field.type}
          onValueChange={handleTypeChange}
          className="h-7 w-28 text-xs font-mono"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
        >
          <Trash2 size={13} />
        </Button>
      </div>

      {isDuplicate && (
        <div className="flex items-center gap-1.5 text-[10px] text-destructive font-medium font-sans">
          <AlertCircle size={11} className="shrink-0" />
          <span>Duplicate field name &quot;{field.name}&quot;. Field names must be unique.</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground font-mono w-16 shrink-0">
          Default:
        </span>
        <LocalInput
          value={defaultString}
          onChange={handleDefaultChange}
          debounceMs={200}
          placeholder={placeholder}
          className="h-6 text-[11px] font-mono bg-background/50 flex-1"
        />
      </div>
    </div>
  );
});

export const StoreFieldsSection: React.FC<StoreFieldsSectionProps> = ({
  fields,
  onAddField,
  onUpdateField,
  onRemoveField,
}) => {
  const duplicateFieldNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of fields) {
      const key = f.name?.trim().toLowerCase();
      if (key) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const duplicates = new Set<string>();
    for (const [key, count] of counts.entries()) {
      if (count > 1) duplicates.add(key);
    }
    return duplicates;
  }, [fields]);

  return (
    <div className="flex flex-col gap-2.5 pt-2 border-t border-border/40">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers size={13} />
          <span>State Fields ({fields.length})</span>
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddField}
          className="h-6 text-[10px] px-2 gap-1 text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 border-indigo-500/30 cursor-pointer"
        >
          <Plus size={11} />
          <span>Add Field</span>
        </Button>
      </div>

      {duplicateFieldNames.size > 0 && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-[11px]">Duplicate Field Names Detected</span>
            <span className="text-[10px] text-destructive/90">
              Field names must be unique within this store. Please rename duplicate fields.
            </span>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <div className="p-3 text-center text-[11px] text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border/60">
          No fields defined. Click &quot;Add Field&quot; or pick a preset above.
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => {
            const key = f.name?.trim().toLowerCase();
            const isDuplicate = Boolean(key && duplicateFieldNames.has(key));
            return (
              <StoreFieldRow
                key={f.id}
                field={f}
                isDuplicate={isDuplicate}
                onUpdateField={onUpdateField}
                onRemoveField={onRemoveField}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
