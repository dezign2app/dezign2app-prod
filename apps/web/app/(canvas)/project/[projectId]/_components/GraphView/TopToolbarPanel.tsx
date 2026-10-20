import React from "react";
import { Panel } from "@xyflow/react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { LayoutTemplate, RotateCcw, Users } from "lucide-react";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { useTestUsersStore } from "../test-users/useTestUsersStore";

interface TopToolbarPanelProps {
  onLayout: (direction: "LR" | "TB") => void;
}

export const TopToolbarPanel: React.FC<TopToolbarPanelProps> = ({
  onLayout,
}) => {
  const simulation = useSimulationStore();
  const personas = useTestUsersStore((s) => s.personas);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);
  const paletteOpen = useSidebarStore((s) => s.paletteOpen);
  const paletteWidth = useSidebarStore((s) => s.paletteWidth);

  return (
    <Panel
      position="top-left"
      className="pointer-events-auto select-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
      style={{
        top: "68px",
        left: paletteOpen ? `${paletteWidth + 16}px` : "124px",
      }}
    >
      <div className="flex items-center gap-1 p-1 rounded-xl bg-sidebar/95 backdrop-blur-md border border-sidebar-border shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-sidebar-foreground hover:bg-sidebar-accent gap-1.5"
          onClick={() => onLayout("LR")}
          title="Auto-arrange nodes in left-to-right flow (Shift + A)"
        >
          <LayoutTemplate className="w-3.5 h-3.5 text-primary" />
          <span>Auto layout</span>
          <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono font-medium text-muted-foreground/80 bg-sidebar-accent/80 border border-sidebar-border px-1 py-0.5 rounded leading-none ml-0.5">
            ⇧A
          </kbd>
        </Button>

        <div className="w-px h-4 bg-sidebar-border mx-0.5" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-sidebar-foreground hover:bg-sidebar-accent gap-1.5"
          onClick={() =>
            setActiveConfigItem({
              type: "testUsers",
              id: "testUsers",
              nodeId: "testUsers",
            })
          }
          title="Manage Test Users & Database Seed Fixtures"
        >
          <Users className="w-3.5 h-3.5 text-primary" />
          <span>Test Users</span>
          <Badge
            variant="secondary"
            className="px-1.5 py-0 text-[10px] font-mono font-bold bg-sidebar-accent text-sidebar-foreground border border-sidebar-border"
          >
            {personas.length}
          </Badge>
        </Button>

        {simulation.status !== "idle" && (
          <>
            <div className="w-px h-4 bg-sidebar-border mx-0.5" />
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 shadow-sm"
              onClick={simulation.clear}
              title="Reset simulation state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
};
