import React from "react";
import { Label } from "@workspace/ui/components/label";
import { BackendNode } from "@/types/canvas";

interface ConnectedPagesListProps {
  connectedPages: BackendNode[];
}

export const ConnectedPagesList: React.FC<ConnectedPagesListProps> = ({
  connectedPages,
}) => {
  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
      <Label className="text-xs text-muted-foreground font-medium">
        Connected WebClient Pages ({connectedPages.length})
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {connectedPages.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            No WebClient pages connected to this zone handle yet.
          </span>
        ) : (
          connectedPages.map((p) => (
            <span
              key={p.id}
              className="px-2 py-0.5 rounded bg-background text-foreground font-mono text-xs border border-border"
            >
              {p.data?.label || "Page"}
            </span>
          ))
        )}
      </div>
    </div>
  );
};
