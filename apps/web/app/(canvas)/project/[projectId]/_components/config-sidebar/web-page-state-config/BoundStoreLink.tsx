"use client";

import React from "react";
import { Database, ExternalLink } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export interface BoundStoreLinkProps {
  storeId: string;
  storeName?: string;
  onOpenStore: () => void;
}

export const BoundStoreLink: React.FC<BoundStoreLinkProps> = ({
  storeId,
  storeName,
  onOpenStore,
}) => {
  if (!storeId) return null;

  return (
    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Database size={13} className="text-cyan-500" />
        <span>
          Bound Store: <strong className="text-foreground">{storeName || "Zustand Store"}</strong>
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOpenStore}
        className="h-7 text-[11px] gap-1 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
      >
        <span>Open Store</span>
        <ExternalLink size={11} />
      </Button>
    </div>
  );
};
