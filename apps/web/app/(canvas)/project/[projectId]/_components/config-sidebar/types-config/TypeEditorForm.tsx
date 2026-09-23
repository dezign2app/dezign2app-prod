"use client";

import React, { useCallback } from "react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Button } from "@workspace/ui/components/button";
import { Trash, Sparkles, Plus, Lock, EyeOff, Eye } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { useBufferedInput } from "@/lib/hooks/useBufferedInput";
import { ReadOnlyPackageContractBanner } from "./PackageTypesBanner";
import { EnumTypeEditor } from "./EnumTypeEditor";
import { FunctionTypeEditor } from "./FunctionTypeEditor";
import { TypePropertyRow } from "./TypePropertyRow";
import { TypePreviewSection } from "./TypePreviewSection";
import { TypeCombobox } from "../TypeCombobox";
import type { TypeEditorFormProps } from "./types";
import type { CustomTypeField, CustomTypeKind } from "@workspace/canvas/types";

// ─── Extended-type field sections ────────────────────────────────────────────

interface ExtendedFieldsSectionProps {
  baseName: string;
  inheritedFields: CustomTypeField[];
  addedFields: CustomTypeField[];
  otherCustomTypes: string[];
  /** IDs of inherited fields the user has chosen to Omit<> */
  omittedIds: Set<string>;
  onToggleOmit: (fieldId: string) => void;
  onAddField: () => void;
  onUpdateAddedField: (fieldId: string, updates: Partial<CustomTypeField>) => void;
  onDeleteAddedField: (fieldId: string) => void;
}

const ExtendedFieldsSection: React.FC<ExtendedFieldsSectionProps> = ({
  baseName,
  inheritedFields,
  addedFields,
  otherCustomTypes,
  omittedIds,
  onToggleOmit,
  onAddField,
  onUpdateAddedField,
  onDeleteAddedField,
}) => {
  const omittedCount = omittedIds.size;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Inherited fields (read-only, omit toggle) ── */}
      <div className="flex flex-col gap-2 rounded-xl border border-purple-500/25 bg-purple-500/5 p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Lock size={12} className="text-purple-400 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Inherited from {baseName}
            </span>
          </div>
          {omittedCount > 0 && (
            <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {omittedCount} omitted
            </span>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground leading-tight mb-2">
          Base fields are read-only. Toggle{" "}
          <span className="font-mono text-amber-400">Omit</span> to exclude a
          field from the extended type, generating{" "}
          <span className="font-mono text-purple-400">
            Omit&lt;{baseName}, &apos;field&apos;&gt;
          </span>{" "}
          in the TypeScript output.
        </p>

        {inheritedFields.length === 0 ? (
          <span className="text-xs text-muted-foreground/60 italic py-1">
            No inherited fields.
          </span>
        ) : (
          <div className="flex flex-col gap-2">
            {inheritedFields.map((f) => {
              const isOmitted = omittedIds.has(f.id);
              return (
                <div
                  key={f.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all",
                    isOmitted
                      ? "bg-amber-500/5 border-amber-500/30 opacity-60"
                      : "bg-background/50 border-border/50",
                  )}
                >
                  <Lock size={10} className="shrink-0 text-purple-400/70" />
                  <span className="font-mono font-semibold text-foreground flex-1">
                    {f.name}
                    {f.required === false && (
                      <span className="text-amber-400">?</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "font-mono px-2 py-0.5 rounded text-[11px] bg-secondary/60 text-foreground",
                      isOmitted && "line-through text-muted-foreground",
                    )}
                  >
                    {f.type}
                    {f.isArray && "[]"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title={isOmitted ? "Re-include this field" : "Omit this field from the extended type"}
                    className={cn(
                      "h-6 px-2 text-[10px] font-mono gap-1 shrink-0 rounded-full cursor-pointer transition-all",
                      isOmitted
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                        : "bg-secondary/60 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-400 border border-border/40",
                    )}
                    onClick={() => onToggleOmit(f.id)}
                  >
                    {isOmitted ? (
                      <>
                        <Eye size={9} /> Include
                      </>
                    ) : (
                      <>
                        <EyeOff size={9} /> Omit
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Added (new) fields — fully editable ── */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              New Fields ({addedFields.length})
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
            onClick={onAddField}
          >
            <Plus size={12} /> Add Field
          </Button>
        </div>

        <div className="flex flex-col gap-2.5 mt-1">
          {addedFields.map((f) => (
            <TypePropertyRow
              key={f.id}
              field={f}
              otherCustomTypes={otherCustomTypes}
              readOnly={false}
              onUpdate={(updates) => onUpdateAddedField(f.id, updates)}
              onDelete={() => onDeleteAddedField(f.id)}
            />
          ))}
          {addedFields.length === 0 && (
            <span className="text-xs text-muted-foreground/60 italic py-2">
              No new fields added yet. Click &quot;Add Field&quot; to extend {baseName} with custom properties.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main TypeEditorForm ──────────────────────────────────────────────────────

export const TypeEditorForm: React.FC<TypeEditorFormProps> = ({
  nodeId,
  currentType,
  otherCustomTypes,
  inheritedEnumValues = [],
  onUpdateCurrentType,
  onDeleteCurrentType,
}) => {
  // Buffered inputs for Name and Description
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

  // ── Field helpers ────────────────────────────────────────────────────────
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

  // ── Extended-type: omit management ──────────────────────────────────────
  // We store omitted field IDs by removing the inherited field from the fields array
  // (previewer detects absence of inherited fields to emit Omit<>).
  // But to keep UX clean we show them as "omitted" toggles.
  // We derive omittedIds from fields that have isInherited=true and are absent
  // vs what was originally cloned. Instead, we store omitted state on the field
  // by keeping a virtual flag: keep the field in the array but mark isOmitted.
  // Actually simpler: we keep the field in the array with isInherited=true and
  // a new isOmitted flag — preview/compiler skips omitted inherited fields.
  const isExtended = Boolean(currentType.extendedFrom);

  const inheritedFields = (currentType.fields || []).filter((f) => f.isInherited);
  const addedFields = (currentType.fields || []).filter((f) => !f.isInherited);

  // Build omittedIds from stored flag
  const omittedIds: Set<string> = new Set(
    inheritedFields.filter((f) => f.isOmitted).map((f) => f.id),
  );

  const handleToggleOmit = useCallback(
    (fieldId: string) => {
      const updatedFields = (currentType.fields || []).map((f) => {
        if (f.id !== fieldId) return f;
        return { ...f, isOmitted: !f.isOmitted };
      });
      onUpdateCurrentType({ fields: updatedFields });
    },
    [currentType.fields, onUpdateCurrentType],
  );

  const handleAddExtendedField = useCallback(() => {
    const currentFields = currentType.fields || [];
    const newField: CustomTypeField = {
      id: `f-${Date.now()}`,
      name: `prop${addedFields.length + 1}`,
      type: "string",
      required: true,
      isArray: false,
    };
    onUpdateCurrentType({ fields: [...currentFields, newField] });
  }, [currentType.fields, addedFields.length, onUpdateCurrentType]);

  return (
    <>
      {/* Read-Only Package Contract Banner */}
      <ReadOnlyPackageContractBanner nodeId={nodeId} currentType={currentType} />

      {/* Extended Type Banner */}
      {isExtended && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-xs text-purple-700 dark:text-purple-300">
          <Sparkles size={14} className="shrink-0 text-purple-500" />
          <span>
            Extended from base model:{" "}
            <strong className="font-mono">{currentType.extendedFrom}</strong>
          </span>
        </div>
      )}

      {/* Type Header - Kind and Name */}
      <div className="flex flex-col gap-2.5 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2">
          <Select
            value={currentType.kind}
            disabled={Boolean(currentType.isReadOnly) || isExtended}
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
              <SelectItem value="function" className="text-xs font-mono font-bold">
                FUNCTION
              </SelectItem>
              <SelectItem value="enum" className="text-xs font-mono font-bold">
                ENUM
              </SelectItem>
            </SelectContent>
          </Select>

          <Input
            className="h-8 text-sm font-semibold tracking-tight text-foreground bg-background font-mono flex-1 disabled:opacity-80"
            placeholder="TypeName (e.g. UserProfile)"
            value={nameBuffer.value}
            disabled={Boolean(currentType.isReadOnly)}
            onChange={(e) => nameBuffer.onChange(e.target.value)}
            onBlur={nameBuffer.flush}
          />

          {!currentType.isReadOnly && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 rounded-lg cursor-pointer"
              onClick={onDeleteCurrentType}
              title="Delete this type"
            >
              <Trash size={14} />
            </Button>
          )}
        </div>

        <span className="text-xs text-muted-foreground">
          {currentType.kind === "function"
            ? "Define a reusable function signature with typed parameters and return type."
            : currentType.kind === "enum"
              ? "Define a fixed set of string constants."
              : isExtended
                ? `Extends ${currentType.extendedFrom}. Omit inherited fields or add new ones below.`
                : "Configure flat object schema properties and reference reusable custom types."}
        </span>
      </div>

      {/* Description Section */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Description
        </Label>
        <Input
          className="bg-background/50 disabled:opacity-80"
          placeholder="e.g. Represents user profile and credentials."
          disabled={Boolean(currentType.isReadOnly)}
          value={descBuffer.value}
          onChange={(e) => descBuffer.onChange(e.target.value)}
          onBlur={descBuffer.flush}
        />
      </div>

      {/* Kind-specific editor */}
      {currentType.kind === "enum" ? (
        <EnumTypeEditor
          currentType={currentType}
          inheritedEnumValues={inheritedEnumValues}
          onUpdateCurrentType={onUpdateCurrentType}
        />
      ) : currentType.kind === "function" ? (
        <FunctionTypeEditor
          currentType={currentType}
          otherCustomTypes={otherCustomTypes}
          onAddField={handleAddField}
          onUpdateField={handleUpdateField}
          onDeleteField={handleDeleteField}
          onUpdateCurrentType={onUpdateCurrentType}
        />
      ) : isExtended ? (
        /* ── Extended interface/type: split inherited vs added ── */
        <ExtendedFieldsSection
          baseName={currentType.extendedFrom!}
          inheritedFields={inheritedFields}
          addedFields={addedFields}
          otherCustomTypes={otherCustomTypes}
          omittedIds={omittedIds}
          onToggleOmit={handleToggleOmit}
          onAddField={handleAddExtendedField}
          onUpdateAddedField={handleUpdateField}
          onDeleteAddedField={handleDeleteField}
        />
      ) : (
        /* ── Normal (non-extended) properties editor ── */
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
                onClick={handleAddField}
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
      <TypePreviewSection currentType={currentType} />
    </>
  );
};
