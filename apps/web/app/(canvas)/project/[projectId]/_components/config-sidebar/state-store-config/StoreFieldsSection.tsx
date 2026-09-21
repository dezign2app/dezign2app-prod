"use client";

import React from "react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Layers, Plus, Trash2 } from "lucide-react";
import { GlobalStoreField, JsonValue } from "@workspace/canvas/types";
import { TypeCombobox } from "../TypeCombobox";

export interface StoreFieldsSectionProps {
  fields: GlobalStoreField[];
  onAddField: () => void;
  onUpdateField: (fieldId: string, patch: Partial<GlobalStoreField>) => void;
  onRemoveField: (fieldId: string) => void;
}

export const StoreFieldsSection: React.FC<StoreFieldsSectionProps> = ({
  fields,
  onAddField,
  onUpdateField,
  onRemoveField,
}) => {
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

      {fields.length === 0 ? (
        <div className="p-3 text-center text-[11px] text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border/60">
          No fields defined. Click &quot;Add Field&quot; or pick a preset above.
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div
              key={f.id}
              className="p-2.5 rounded-lg bg-card/60 border border-border/60 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={f.name}
                  onChange={(e) => onUpdateField(f.id, { name: e.target.value })}
                  placeholder="Field name"
                  className="h-7 text-xs font-mono flex-1"
                />
                <TypeCombobox
                  value={f.type}
                  onValueChange={(val) => onUpdateField(f.id, { type: val })}
                  className="h-7 w-28 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveField(f.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono w-16 shrink-0">
                  Default:
                </span>
                <Input
                  value={
                    f.defaultValue !== undefined && f.defaultValue !== null
                      ? typeof f.defaultValue === "object"
                        ? JSON.stringify(f.defaultValue)
                        : String(f.defaultValue)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    let val: JsonValue | undefined = raw;
                    if (raw === "") {
                      val = undefined;
                    } else if (f.type === "number") {
                      val = isNaN(Number(raw)) ? 0 : Number(raw);
                    } else if (f.type === "boolean") {
                      val = raw === "true";
                    } else if (f.type === "object" || f.type === "array") {
                      try {
                        val = JSON.parse(raw);
                      } catch {
                        val = raw;
                      }
                    }
                    onUpdateField(f.id, { defaultValue: val });
                  }}
                  placeholder={
                    f.type === "number"
                      ? "e.g. 0"
                      : f.type === "boolean"
                      ? "e.g. false"
                      : f.type === "string"
                      ? 'e.g. "default text"'
                      : f.type === "array"
                      ? "e.g. []"
                      : "e.g. null or {}"
                  }
                  className="h-6 text-[11px] font-mono bg-background/50 flex-1"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
