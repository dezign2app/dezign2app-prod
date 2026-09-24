"use client";

import React from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Database, CheckCircle2 } from "lucide-react";

export interface StoreActiveBadgeCardProps {
  storeName?: string;
  actionName?: string;
  actionType?: string;
}

export const StoreActiveBadgeCard: React.FC<StoreActiveBadgeCardProps> = ({
  storeName = "Store",
  actionName = "action",
  actionType = "mutate",
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/25">
      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
        <CheckCircle2 size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">
          Active State Store Mutation
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Badge
          variant="secondary"
          className="text-[10px] gap-1 px-2 py-0.5 font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
        >
          <Database size={9} />
          {storeName}
        </Badge>
        <span className="text-muted-foreground text-xs">→</span>
        <Badge
          variant="outline"
          className="text-[10px] gap-1 px-2 py-0.5 font-mono border-indigo-500/40 text-foreground"
        >
          <span className="font-bold text-indigo-500">{actionName}()</span>
          <span className="text-[8px] text-muted-foreground uppercase font-sans">
            [{actionType || "mutate"}]
          </span>
        </Badge>
      </div>
      <span className="text-[10px] text-muted-foreground">
        Canvas connection edge automatically wired to <code className="font-mono text-foreground">{storeName}</code> node.
      </span>
    </div>
  );
};
