import React from "react";
import { Link2 } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

interface CoreChatHistoryCardProps {
  hasCustomAddMessages: boolean;
  onCustomize: () => void;
}

export function CoreChatHistoryCard({
  hasCustomAddMessages,
  onCustomize,
}: CoreChatHistoryCardProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 px-1">
        Chat History Reducer (Core)
      </span>
      <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs font-mono shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-blue-300">add_messages</span>
            <Badge
              variant="secondary"
              className="text-[8px] h-3.5 px-1 bg-blue-500/20 text-blue-300 border-0"
            >
              chat history
            </Badge>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-200 text-[10px] font-sans">
              <Link2 className="w-3 h-3 text-blue-400" />
              <span className="text-muted-foreground text-[9px]">Tied to:</span>
              <span className="font-mono font-semibold text-blue-100">
                messages
              </span>
              <span className="text-[8px] px-1 py-0 rounded bg-blue-500/30 text-blue-200 font-mono">
                messages
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0.5 border-blue-500/30 text-blue-300 font-sans"
          >
            Built-in
          </Badge>
        </div>
        <code className="text-[9px] text-blue-200/90 line-clamp-3 whitespace-pre-wrap font-mono bg-background/50 px-2 py-1.5 rounded-lg border border-blue-500/20">
          {"(prev, next) => Array.isArray(prev) ? [...prev, ...(Array.isArray(next) ? next : [next])] : next"}
        </code>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-sans">
          <span>
            Deduplicates incoming messages by ID and appends conversation history.
          </span>
          {!hasCustomAddMessages && (
            <button
              type="button"
              onClick={onCustomize}
              className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline underline-offset-2 ml-2 shrink-0"
            >
              Customize as custom reducer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
