import React from "react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { LocalInput } from "../../../backend-nodes/graph-nodes/common/LocalInput";
import { FunctionMetaSectionProps, OperationKind } from "./types";

const VALID_OPERATION_KINDS: readonly OperationKind[] = [
  "findAll",
  "findById",
  "fetchByIndex",
  "join",
  "create",
  "update",
  "delete",
  "custom",
];

function isOperationKind(val: string): val is OperationKind {
  return VALID_OPERATION_KINDS.includes(val as OperationKind);
}

export const FunctionMetaSection: React.FC<FunctionMetaSectionProps> = React.memo(({
  name = "",
  kind,
  description = "",
  isNew,
  isRedis,
  pascalLabel,
  nameInputRef,
  onNameChange,
  onNameBlur,
  onNameKeyDown,
  onKindChange,
  onDescriptionChange,
}) => {
  const placeholderName = isRedis
    ? `custom${pascalLabel}Op`
    : `custom${pascalLabel}Query`;

  const handleSelectKind = (val: string) => {
    if (isOperationKind(val)) {
      onKindChange(val);
    }
  };

  const handleDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDescriptionChange(e.target.value);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Function Name & Kind */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Function Name</Label>
          <LocalInput
            ref={nameInputRef}
            autoFocus={isNew}
            value={name}
            debounceMs={150}
            placeholder={placeholderName}
            onChange={onNameChange}
            onBlur={onNameBlur}
            onKeyDown={onNameKeyDown}
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Operation Kind</Label>
          <Select value={kind} onValueChange={handleSelectKind}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="findAll">Read (findAll)</SelectItem>
              <SelectItem value="findById">Read (findById)</SelectItem>
              <SelectItem value="fetchByIndex">Index Fetch (fetchByIndex)</SelectItem>
              <SelectItem value="join">Relational Join (join)</SelectItem>
              <SelectItem value="create">Write (create)</SelectItem>
              <SelectItem value="update">Write (update)</SelectItem>
              <SelectItem value="delete">Write (delete)</SelectItem>
              <SelectItem value="custom">Custom Query</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold">Description</Label>
        <LocalInput
          placeholder="Purpose of this database function..."
          value={description}
          debounceMs={150}
          onChange={handleDescChange}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
});

FunctionMetaSection.displayName = "FunctionMetaSection";
