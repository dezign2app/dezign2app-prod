import React from "react";
import { Server, ExternalLink } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";

interface RedisInstanceNoticeCardProps {
  parentDb?: BackendNode;
  onConfigureInstance: (dbId: string) => void;
}

export const RedisInstanceNoticeCard: React.FC<RedisInstanceNoticeCardProps> = ({
  parentDb,
  onConfigureInstance,
}) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/30">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Server size={18} className="text-amber-500 shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-foreground">
            Server Instance Settings (Eviction & Persistence)
          </span>
          <span className="text-[10px] text-muted-foreground truncate">
            {parentDb
              ? `Attached to [${parentDb.data?.label || "Redis DB"}] (${parentDb.data?.maxmemoryPolicy || "volatile-lru"})`
              : "Not attached to a Database node yet."}
          </span>
        </div>
      </div>
      {parentDb && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 shrink-0 ml-2"
          onClick={() => onConfigureInstance(parentDb.id)}
        >
          Configure Instance <ExternalLink size={12} />
        </Button>
      )}
    </div>
  );
};
