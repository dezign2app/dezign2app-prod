import React from "react";
import { Database, Plus, X } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

interface StateTabHeaderProps {
  channelCount: number;
  reducerCount: number;
  onAddField: () => void;
  onClose?: () => void;
}

export function StateTabHeader({
  channelCount,
  reducerCount,
  onAddField,
  onClose,
}: StateTabHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-[#006ddd]/10 text-[#006ddd] border border-[#006ddd]/20">
          <Database className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-xs text-foreground tracking-wide">
            Global Graph State
          </span>
          <span className="text-[10px] text-muted-foreground">
            {channelCount} channels • {reducerCount} reducers
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-border gap-1 font-semibold hover:border-[#006ddd]/50 hover:bg-[#006ddd]/10 hover:text-[#006ddd]"
          onClick={onAddField}
        >
          <Plus className="w-3.5 h-3.5" /> Add Field
        </Button>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
