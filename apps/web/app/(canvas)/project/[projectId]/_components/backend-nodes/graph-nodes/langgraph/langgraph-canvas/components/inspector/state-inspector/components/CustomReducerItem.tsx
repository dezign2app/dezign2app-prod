import React from "react";
import { Pencil, Trash2, Link2 } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { EditCustomReducerForm } from "./EditCustomReducerForm";
import type { LangGraphCustomReducer, LangGraphStateChannel } from "@/types/canvas";

interface CustomReducerItemProps {
  reducer: LangGraphCustomReducer;
  isEditing: boolean;
  stateChannels: LangGraphStateChannel[];
  availableFieldKeys: string[];
  editReducerName: string;
  editReducerCode: string;
  editReducerDesc: string;
  editTargetField: string;
  editTargetFieldInput: string;
  onStartEdit: (reducer: LangGraphCustomReducer) => void;
  onCancelEdit: () => void;
  onSaveEdit: (reducerId: string) => void;
  onDelete: (reducerName: string) => void;
  onSelectEditTargetField: (val: string) => void;
  onEditTargetFieldInputChange: (val: string) => void;
  onEditReducerNameChange: (val: string) => void;
  onEditReducerCodeChange: (val: string) => void;
  onEditReducerDescChange: (val: string) => void;
}

export function CustomReducerItem({
  reducer: r,
  isEditing,
  stateChannels,
  availableFieldKeys,
  editReducerName,
  editReducerCode,
  editReducerDesc,
  editTargetField,
  editTargetFieldInput,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onSelectEditTargetField,
  onEditTargetFieldInputChange,
  onEditReducerNameChange,
  onEditReducerCodeChange,
  onEditReducerDescChange,
}: CustomReducerItemProps) {
  if (isEditing) {
    return (
      <EditCustomReducerForm
        availableFieldKeys={availableFieldKeys}
        stateChannels={stateChannels}
        editTargetField={editTargetField}
        editTargetFieldInput={editTargetFieldInput}
        editReducerName={editReducerName}
        editReducerCode={editReducerCode}
        editReducerDesc={editReducerDesc}
        onSelectTargetField={onSelectEditTargetField}
        onTargetFieldInputChange={onEditTargetFieldInputChange}
        onReducerNameChange={onEditReducerNameChange}
        onReducerCodeChange={onEditReducerCodeChange}
        onReducerDescChange={onEditReducerDescChange}
        onSave={() => onSaveEdit(r.id)}
        onCancel={onCancelEdit}
      />
    );
  }

  const tiedChannel = stateChannels.find(
    (c) =>
      c.key === r.targetField ||
      c.reducer === r.name ||
      c.reducer === r.id,
  );
  const targetFieldName = r.targetField || tiedChannel?.key;

  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-xs font-mono">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-purple-300">{r.name}</span>
          <Badge
            variant="secondary"
            className="text-[8px] h-3.5 px-1 bg-purple-500/20 text-purple-300 border-0"
          >
            custom
          </Badge>
          {targetFieldName ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-sans">
              <Link2 className="w-3 h-3 text-blue-400" />
              <span className="text-muted-foreground text-[9px]">Tied to:</span>
              <span className="font-mono font-semibold text-blue-200">
                {targetFieldName}
              </span>
              {tiedChannel?.type && (
                <span className="text-[8px] px-1 py-0 rounded bg-blue-500/20 text-blue-300 font-mono">
                  {tiedChannel.type}
                </span>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground font-sans px-1">
              <Link2 className="w-2.5 h-2.5 opacity-50" /> Unassigned
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onStartEdit(r)}
            className="text-muted-foreground hover:text-purple-300 p-1 rounded transition-colors cursor-pointer"
            title="Edit custom reducer"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(r.name)}
            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
            title="Delete custom reducer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      <code className="text-[9px] text-purple-200/80 line-clamp-3 whitespace-pre-wrap font-mono bg-background/50 px-1.5 py-1 rounded border border-purple-500/20">
        {r.code}
      </code>
      {r.description && (
        <span className="text-[9px] text-muted-foreground font-sans">
          {r.description}
        </span>
      )}
    </div>
  );
}
