import React from "react";
import { Panel } from "@xyflow/react";
import { Button } from "@workspace/ui/components/button";
import { LayoutTemplate, RotateCcw, Users } from "lucide-react";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
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

  return (
    <Panel position="top-right" className="flex gap-2 flex-col">
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs"
        onClick={() => onLayout("LR")}
      >
        <LayoutTemplate className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
        Auto layout
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs gap-1.5"
        onClick={() =>
          setActiveConfigItem({
            type: "testUsers",
            id: "testUsers",
            nodeId: "testUsers",
          })
        }
        title="Manage Test Users & Database Seed Fixtures"
      >
        <Users className="w-3.5 h-3.5 text-muted-foreground" />
        <span>Test Users</span>
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-secondary text-muted-foreground border border-border/50">
          {personas.length}
        </span>
      </Button>

      {simulation.status !== "idle" && (
        <Button
          variant="destructive"
          size="sm"
          className="shadow-sm text-xs"
          onClick={simulation.clear}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-2" />
          Reset
        </Button>
      )}
    </Panel>
  );
};

