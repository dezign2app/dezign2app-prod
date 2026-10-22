import React, { useState, useCallback } from "react";
import { Panel } from "@xyflow/react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { LayoutTemplate, RotateCcw, Users, FileJson, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { useTestUsersStore } from "../test-users/useTestUsersStore";
import { formatSystemContext } from "@/lib/system-context/formatSystemContext";

interface TopToolbarPanelProps {
  onLayout: (direction: "LR" | "TB") => void;
  projectId?: string;
  projectName?: string;
}

export const TopToolbarPanel: React.FC<TopToolbarPanelProps> = ({
  onLayout,
  projectId,
  projectName,
}) => {
  const simulation = useSimulationStore();
  const personas = useTestUsersStore((s) => s.personas);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);
  const paletteOpen = useSidebarStore((s) => s.paletteOpen);
  const paletteWidth = useSidebarStore((s) => s.paletteWidth);

  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedContext, setCopiedContext] = useState(false);

  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const events = useBackendCanvasStore((s) => s.events);
  const identityProviders = useBackendCanvasStore((s) => s.identityProviders);
  const storeProjectId = useBackendCanvasStore((s) => s.projectId);
  const effectiveProjectId = projectId || storeProjectId || "";

  const handleCopySystemContext = useCallback(async () => {
    try {
      const projectPayload = {
        project: {
          id: effectiveProjectId,
          name: projectName || "Untitled Project",
        },
        nodes,
        edges,
        endpoints,
        events,
        identityProviders,
        testUsers: personas,
      };

      const formattedText = formatSystemContext(projectPayload);

      // Log to browser console so user can directly inspect and explore the readable text
      console.log("[System Context Markdown]\n" + formattedText);

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(formattedText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = formattedText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedContext(true);
      toast.success("System context copied to clipboard!", {
        description: "Formatted readable text without repetitive JSON keys. Also logged to browser console.",
      });
      setTimeout(() => setCopiedContext(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy";
      toast.error("Failed to copy system context", {
        description: message,
      });
    }
  }, [effectiveProjectId, projectName, nodes, edges, endpoints, events, identityProviders, personas]);

  const handleCopyProjectJson = useCallback(async () => {
    try {
      const projectPayload = {
        project: {
          id: effectiveProjectId,
          name: projectName || "Untitled Project",
        },
        nodes,
        edges,
        endpoints,
        events,
        identityProviders,
        testUsers: personas,
      };

      const jsonText = JSON.stringify(projectPayload, null, 2);

      // Log to browser console so user can directly inspect and explore the object
      console.log("[Project JSON]", projectPayload);

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(jsonText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = jsonText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedJson(true);
      toast.success("Project JSON copied to clipboard!", {
        description: `${nodes.length} nodes, ${edges.length} edges, ${endpoints.length} endpoints. Also logged to browser console.`,
      });
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy";
      toast.error("Failed to copy project JSON", {
        description: message,
      });
    }
  }, [effectiveProjectId, projectName, nodes, edges, endpoints, events, identityProviders, personas]);

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
          className="h-7 px-2.5 text-xs text-sidebar-foreground hover:bg-sidebar-accent gap-1.5 transition-colors"
          onClick={handleCopySystemContext}
          title="Copy formatted system architecture context (clean readable text without repetitive JSON keys) to clipboard"
        >
          {copiedContext ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in-50 duration-200" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-primary" />
          )}
          <span>{copiedContext ? "Copied Context" : "Copy Context"}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent gap-1.5 transition-colors"
          onClick={handleCopyProjectJson}
          title="Copy entire raw project JSON object (including SchemaView, LangGraph, endpoints, and edges) to clipboard"
        >
          {copiedJson ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in-50 duration-200" />
          ) : (
            <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span>{copiedJson ? "Copied JSON" : "Raw JSON"}</span>
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
