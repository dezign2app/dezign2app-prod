import React from "react";
import { Database, Plus } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

interface StateChannelsEmptyProps {
  onAddDefaultMessagesChannel: () => void;
  onAddField: () => void;
}

export function StateChannelsEmpty({
  onAddDefaultMessagesChannel,
  onAddField,
}: StateChannelsEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-border rounded-xl gap-2 bg-secondary/10">
      <Database className="w-8 h-8 text-muted-foreground/40" />
      <span className="text-xs font-semibold text-foreground">
        No State Channels Defined
      </span>
      <span className="text-[11px] text-muted-foreground max-w-[240px]">
        State channels hold shared data across graph nodes. Add a default chat history channel or custom fields.
      </span>
      <div className="flex items-center gap-2 mt-2">
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 bg-[#006ddd] hover:bg-[#006ddd]/90 text-white font-semibold cursor-pointer shadow-sm"
          onClick={onAddDefaultMessagesChannel}
        >
          <Plus className="w-3.5 h-3.5" /> Add Default messages (Chat History)
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 cursor-pointer"
          onClick={onAddField}
        >
          <Plus className="w-3.5 h-3.5" /> Add Field
        </Button>
      </div>
    </div>
  );
}
