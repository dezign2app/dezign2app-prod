import React from "react";
import { Database, Plus } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

interface ChatHistoryCalloutProps {
  onAddDefaultMessagesChannel: () => void;
}

export function ChatHistoryCallout({
  onAddDefaultMessagesChannel,
}: ChatHistoryCalloutProps) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs">
      <div className="flex items-center gap-2 text-blue-300">
        <Database className="w-4 h-4 text-blue-400 shrink-0" />
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">Chat History Channel</span>
          <span className="text-[10px] text-muted-foreground">
            LangGraph uses{" "}
            <code className="font-mono text-blue-300 font-semibold">messages</code>{" "}
            with{" "}
            <code className="font-mono text-blue-300 font-semibold">add_messages</code>{" "}
            reducer to persist chat turns.
          </span>
        </div>
      </div>
      <Button
        size="sm"
        className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1 shrink-0 cursor-pointer"
        onClick={onAddDefaultMessagesChannel}
      >
        <Plus className="w-3 h-3" /> Add messages State
      </Button>
    </div>
  );
}
