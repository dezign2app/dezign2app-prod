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
import { Trash, Sparkles } from "lucide-react";
import { useBufferedInput } from "@/lib/hooks/useBufferedInput";
import { ReadOnlyPackageContractBanner } from "./PackageTypesBanner";
import { EnumTypeEditor } from "./EnumTypeEditor";
import { FunctionTypeEditor } from "./FunctionTypeEditor";
import { PropertiesEditor } from "./PropertiesEditor";
import { TypePreviewSection } from "./TypePreviewSection";
import type { TypeEditorFormProps } from "./types";
import type { CustomTypeField, CustomTypeKind } from "@workspace/canvas/types";

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

  return (
    <>
      {/* Read-Only Package Contract Banner */}
      <ReadOnlyPackageContractBanner nodeId={nodeId} currentType={currentType} />

      {/* Extended Type Banner */}
      {Boolean(currentType.extendedFrom) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-xs text-purple-700 dark:text-purple-300">
          <Sparkles size={14} className="shrink-0 text-purple-500" />
          <span>
            Extended from base model: <strong className="font-mono">{currentType.extendedFrom}</strong>
          </span>
        </div>
      )}

      {/* Type Header - Kind and Name */}
      <div className="flex flex-col gap-2.5 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2">
          <Select
            value={currentType.kind}
            disabled={Boolean(currentType.isReadOnly) || Boolean(currentType.extendedFrom)}
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
            disabled={Boolean(currentType.isReadOnly) || Boolean(currentType.extendedFrom)}
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
          disabled={Boolean(currentType.isReadOnly) || Boolean(currentType.extendedFrom)}
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
      ) : (
        <PropertiesEditor
          currentType={currentType}
          otherCustomTypes={otherCustomTypes}
          onAddField={handleAddField}
          onUpdateField={handleUpdateField}
          onDeleteField={handleDeleteField}
        />
      )}

      {/* Generated TypeScript Preview Section */}
      <TypePreviewSection currentType={currentType} />
    </>
  );
};
