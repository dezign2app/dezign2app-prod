"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { TypePropertyRow } from "./TypePropertyRow";
import { Plus, Sparkles } from "lucide-react";
import type { PropertiesEditorProps } from "./types";
import type { CustomTypeField } from "@workspace/canvas/types";

export const PropertiesEditor: React.FC<PropertiesEditorProps> = ({
  currentType,
  otherCustomTypes,
  onAddField,
  onUpdateField,
  onDeleteField,
}) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const fields = currentType.fields || [];
  const selectedField = fields.find((f) => f.id === selectedFieldId) || fields[fields.length - 1];

  const handleAddUnionToProperty = () => {
    const fallbackType = otherCustomTypes[0] || "string";
    if (!selectedField) {
      // If no properties exist, create an initial one
      onAddField();
      return;
    }
    const currentRaw = (selectedField.type || "string").replace(/\[\]$/, "").trim();
    const isArr = Boolean(selectedField.isArray || selectedField.type?.endsWith("[]"));
    const nextType = `${currentRaw} | ${fallbackType}`;
    onUpdateField(selectedField.id, {
      type: isArr ? `(${nextType})[]` : nextType,
      isArray: isArr,
    });
  };

  const handleAddIntersectionToProperty = () => {
    const fallbackType = otherCustomTypes[0] || "string";
    if (!selectedField) {
      onAddField();
      return;
    }
    const currentRaw = (selectedField.type || "string").replace(/\[\]$/, "").trim();
    const isArr = Boolean(selectedField.isArray || selectedField.type?.endsWith("[]"));
    const nextType = `${currentRaw} & ${fallbackType}`;
    onUpdateField(selectedField.id, {
      type: isArr ? `(${nextType})[]` : nextType,
      isArray: isArr,
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Properties ({fields.length})
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
            className="h-7 text-[10px] gap-1 rounded-full px-3 cursor-pointer"
            onClick={onAddField}
          >
            <Plus size={12} /> Add Property
          </Button>
        )}
      </div>

      {/* Properties List */}
      <div className="flex flex-col gap-2.5 mt-1">
        {fields.map((f) => (
          <TypePropertyRow
            key={f.id}
            field={f}
            otherCustomTypes={otherCustomTypes}
            readOnly={Boolean(currentType.isReadOnly)}
            isSelected={selectedFieldId === f.id}
            onSelect={() => setSelectedFieldId(f.id)}
            onUpdate={(updates) => onUpdateField(f.id, updates)}
            onDelete={() => {
              if (selectedFieldId === f.id) setSelectedFieldId(null);
              onDeleteField(f.id);
            }}
          />
        ))}

        {fields.length === 0 && (
          <span className="text-xs text-muted-foreground/60 italic py-2">
            No properties defined yet. Click &quot;Add Property&quot; below.
          </span>
        )}
      </div>

      {/* Action Buttons Directly Below Properties */}
      {!currentType.isReadOnly && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-xs font-medium gap-1 px-3 cursor-pointer"
            onClick={onAddField}
          >
            <Plus size={12} /> Add Property
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs font-mono font-semibold gap-1.5 px-3 cursor-pointer hover:bg-primary/10 hover:text-primary border-dashed"
            onClick={handleAddUnionToProperty}
            title={
              selectedField
                ? `Append union (|) to "${selectedField.name || 'property'}"`
                : "Add union (|)"
            }
          >
            <span className="text-primary font-bold">|</span>
            <span>
              {selectedField?.name ? `Add Union (|) to "${selectedField.name}"` : "Add Union (|)"}
            </span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs font-mono font-semibold gap-1.5 px-3 cursor-pointer hover:bg-primary/10 hover:text-primary border-dashed"
            onClick={handleAddIntersectionToProperty}
            title={
              selectedField
                ? `Append intersection (&) to "${selectedField.name || 'property'}"`
                : "Add intersection (&)"
            }
          >
            <span className="text-primary font-bold">&</span>
            <span>
              {selectedField?.name ? `Add Intersection (&) to "${selectedField.name}"` : "Add Intersection (&)"}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
};
