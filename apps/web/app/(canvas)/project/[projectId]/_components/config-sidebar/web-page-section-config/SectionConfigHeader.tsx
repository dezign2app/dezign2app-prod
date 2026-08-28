"use client";

import React, { useState } from "react";
import { Trash } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { NodeDeletionDialog } from "../../node-deletion-dialog/NodeDeletionDialog";

interface SectionConfigHeaderProps {
  nodeId?: string;
  sectionId?: string;
  pageLabel?: string;
  sectionName?: string;
  renderMode?: "server" | "client";
  onDelete?: () => void;
}

export const SectionConfigHeader: React.FC<SectionConfigHeaderProps> = ({
  nodeId,
  sectionId,
  pageLabel,
  sectionName,
  renderMode = "server",
  onDelete,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const badgeLabel = renderMode === "client" ? "CLIENT" : "RSC";

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-6">
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-primary/15 text-primary rounded border border-primary/20 shadow-sm">
            {badgeLabel}
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground truncate">
            {sectionName || "Section"}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          Configure section details and behavior for {pageLabel || "page"}.
        </span>
      </div>

      {onDelete && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteDialogOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
            title="Delete section"
          >
            <Trash size={15} />
          </Button>

          {nodeId && sectionId ? (
            <NodeDeletionDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              deletionTarget={{
                type: "section",
                nodeId,
                section: {
                  id: sectionId,
                  name: sectionName,
                },
                onConfirm: onDelete,
              }}
            />
          ) : (
            <NodeDeletionDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              deletionTarget={{
                type: "custom",
                itemLabel: sectionName || "Section",
                itemType: "section",
                title: `Delete Section "${sectionName || "Untitled"}"?`,
                onConfirm: onDelete,
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
