"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";
import { TypePropertyRow } from "./TypePropertyRow";
import { Plus, Sparkles } from "lucide-react";
import type { PropertiesEditorProps } from "./types";

export const PropertiesEditor: React.FC<PropertiesEditorProps> = ({
  currentType,
  otherCustomTypes,
  onAddField,
  onUpdateField,
  onDeleteField,
}) => {
  return (
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
        {!currentType.isReadOnly && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-[10px] gap-1 rounded-full px-3"
            onClick={onAddField}
          >
            <Plus size={12} /> Add Property
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2.5 mt-1">
        {(currentType.fields || []).map((f) => (
          <TypePropertyRow
            key={f.id}
            field={f}
            otherCustomTypes={otherCustomTypes}
            readOnly={Boolean(currentType.isReadOnly)}
            onUpdate={(updates) => onUpdateField(f.id, updates)}
            onDelete={() => onDeleteField(f.id)}
          />
        ))}

        {(currentType.fields || []).length === 0 && (
          <span className="text-xs text-muted-foreground/60 italic py-2">
            No properties defined yet. Click &quot;Add Property&quot; above.
          </span>
        )}
      </div>
    </div>
  );
};
