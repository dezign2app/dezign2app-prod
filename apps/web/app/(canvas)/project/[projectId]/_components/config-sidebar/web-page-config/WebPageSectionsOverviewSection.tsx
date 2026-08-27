import React from "react";
import { Layers, Plus } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import type { PageSection } from "@/types/canvas";

interface WebPageSectionsOverviewSectionProps {
  nodeId: string;
  sections?: PageSection[];
  onAddSection: () => void;
}

export function WebPageSectionsOverviewSection({
  nodeId,
  sections = [],
  onAddSection,
}: WebPageSectionsOverviewSectionProps) {
  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span>Page Sections & Components</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
          onClick={onAddSection}
        >
          <Plus size={12} className="mr-1 text-indigo-500" />
          Add Section
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {sections.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-border/70 text-center flex flex-col items-center gap-2 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              No sections defined yet. Each section compiles into its own component in{" "}
              <code className="font-mono text-primary">_components/</code>.
            </span>
          </div>
        ) : (
          sections.map((sec) => (
            <div
              key={sec.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border text-xs"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground truncate">{sec.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {sec.renderMode || "server"} • {sec.loadStrategy || "eager"} •{" "}
                  {(sec.actions || []).length} action
                  {(sec.actions || []).length === 1 ? "" : "s"}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  useBackendCanvasStore.getState().setActiveConfigItem({
                    type: "pageSection",
                    id: sec.id,
                    nodeId,
                  })
                }
              >
                Configure &rarr;
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
