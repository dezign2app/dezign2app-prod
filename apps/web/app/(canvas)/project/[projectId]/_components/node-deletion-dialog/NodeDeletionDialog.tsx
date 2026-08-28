"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { AlertDialog, AlertDialogContent } from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Trash2, Loader2 } from "lucide-react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import { computeNodeDeletionDiff } from "@/lib/compiler/nodeDeletionDiff";
import { computeNodeArchitectureImpact } from "@/lib/compiler/nodeArchitectureImpact";
import { getSavedWorkspaceDir } from "@/lib/compiler/nodeDeletionSync";
import { isElectron } from "@/lib/electron";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

import { NodeDeletionDialogProps, AffectedItem } from "./types";
import { buildAffectedFileTree, getAllFolderPaths, getNodeLabel } from "./utils";
import { NodeDeletionHeader } from "./NodeDeletionHeader";
import { NodeDeletionTabNav } from "./NodeDeletionTabNav";
import { NodeArchitectureImpactView } from "./NodeArchitectureImpactView";
import { NodeDeletionImpactSummary } from "./NodeDeletionImpactSummary";
import { NodeDeletionFileTree } from "./NodeDeletionFileTree";
import { NodeDeletionResizeHandle } from "./NodeDeletionResizeHandle";
import { NodeDeletionCodePreview } from "./NodeDeletionCodePreview";

export function NodeDeletionDialog({
  open,
  onOpenChange,
  nodesPendingDeletion,
  projectId,
  projectName = "Blueprint",
}: NodeDeletionDialogProps): React.JSX.Element {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const events = useBackendCanvasStore((s) => s.events);
  const edges = useBackendCanvasStore((s) => s.edges);
  const deleteNodes = useBackendCanvasStore((s) => s.deleteNodes);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const testCases = useSimulationStore((s) => s.testCases) || [];

  // Active view tab: defaults to "architecture"
  const [activeTab, setActiveTab] = useState<"architecture" | "code">("architecture");

  // Code Diff tab states
  const [filterType, setFilterType] = useState<"all" | "deleted" | "modified">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<"before" | "after">("before");
  const [sidebarWidth, setSidebarWidth] = useState<number>(310);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const nodeIdsToDelete = useMemo(() => {
    return nodesPendingDeletion.map((n) => n.id);
  }, [nodesPendingDeletion]);

  const outputDir = useMemo(() => {
    return getSavedWorkspaceDir(projectId);
  }, [projectId]);

  // Compute the exact node architecture impact on canvas
  const architectureImpact = useMemo(() => {
    if (!open || nodeIdsToDelete.length === 0) {
      return {
        targetNodes: [],
        severedConnections: [],
        cascadeElements: [],
        brokenReferences: [],
        totalCanvasImpactCount: 0,
      };
    }

    return computeNodeArchitectureImpact(nodes, edges, endpoints, events, nodeIdsToDelete);
  }, [open, nodes, edges, endpoints, events, nodeIdsToDelete]);

  // Compute the file diff
  const diff = useMemo(() => {
    if (!open || nodeIdsToDelete.length === 0) {
      return {
        deletedNodes: [],
        deletedFiles: [],
        modifiedFiles: [],
        addedFiles: [],
        totalAffectedCount: 0,
        filesBefore: [],
        filesAfter: [],
      };
    }

    try {
      return computeNodeDeletionDiff(
        nodes,
        endpoints,
        events,
        edges,
        testCases,
        projectName,
        nodeIdsToDelete,
      );
    } catch (e) {
      console.error("[NodeDeletionDialog] Error calculating diff:", e);
      return {
        deletedNodes: nodesPendingDeletion.map((n) => ({
          id: n.id,
          label: getNodeLabel(n),
          type: n.type || "node",
        })),
        deletedFiles: [],
        modifiedFiles: [],
        addedFiles: [],
        totalAffectedCount: 0,
        filesBefore: [],
        filesAfter: [],
      };
    }
  }, [open, nodes, endpoints, events, edges, testCases, projectName, nodeIdsToDelete, nodesPendingDeletion]);

  const filteredFiles: AffectedItem[] = useMemo(() => {
    const items: AffectedItem[] = [
      ...diff.deletedFiles.map((path) => ({ path, type: "deleted" as const })),
      ...diff.modifiedFiles.map((path) => ({ path, type: "modified" as const })),
      ...diff.addedFiles.map((path) => ({ path, type: "added" as const })),
    ];

    return items.filter((item) => {
      if (filterType === "deleted" && item.type !== "deleted") return false;
      if (filterType === "modified" && item.type !== "modified") return false;
      if (searchQuery.trim()) {
        return item.path.toLowerCase().includes(searchQuery.toLowerCase().trim());
      }
      return true;
    });
  }, [diff, filterType, searchQuery]);

  const fileTree = useMemo(() => {
    return buildAffectedFileTree(filteredFiles);
  }, [filteredFiles]);

  // Reset tab to "architecture" whenever dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab("architecture");
    }
  }, [open]);

  // Expand all folders by default when tree changes
  useEffect(() => {
    const allPaths = getAllFolderPaths(fileTree);
    setExpandedFolders(new Set(allPaths));
  }, [fileTree]);

  // Automatically select first affected file when dialog opens
  useEffect(() => {
    if (open) {
      const first = diff.deletedFiles[0] || diff.modifiedFiles[0] || null;
      setSelectedFilePath(first);
      setPreviewVersion("before");
    }
  }, [open, diff.deletedFiles, diff.modifiedFiles]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const activeFileDetails = useMemo(() => {
    if (!selectedFilePath) return null;
    const isDeleted = diff.deletedFiles.includes(selectedFilePath);
    const isModified = diff.modifiedFiles.includes(selectedFilePath);

    const fileBefore = diff.filesBefore.find((f) => f.filename === selectedFilePath);
    const fileAfter = diff.filesAfter.find((f) => f.filename === selectedFilePath);

    const content =
      previewVersion === "after" && fileAfter ? fileAfter.content : fileBefore?.content || "";

    const lines = content ? content.split("\n") : [];

    return {
      path: selectedFilePath,
      isDeleted,
      isModified,
      content,
      lines,
      hasAfterVersion: Boolean(fileAfter),
    };
  }, [selectedFilePath, diff, previewVersion]);

  // Resize drag handle handler for code diff pane
  const handleMouseDownResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingSidebar(true);

      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.min(Math.max(startWidth + deltaX, 180), 550);
        setSidebarWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsDraggingSidebar(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [sidebarWidth],
  );

  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    toast.success(`Copied path: ${path}`);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleCopyCode = () => {
    if (!activeFileDetails?.content) return;
    navigator.clipboard.writeText(activeFileDetails.content);
    setCopiedCode(true);
    toast.success(`Copied file contents`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      if (deleteNodes) {
        deleteNodes(nodeIdsToDelete);
      } else {
        nodeIdsToDelete.forEach((id) => deleteNode(id));
      }
      onOpenChange(false);
    } catch (err) {
      console.error("[NodeDeletionDialog] Deletion failed:", err);
      toast.error("Failed to delete selected nodes");
    } finally {
      setIsDeleting(false);
    }
  };

  const primaryNodeLabel = useMemo(() => {
    if (nodesPendingDeletion.length === 1 && nodesPendingDeletion[0]) {
      return getNodeLabel(nodesPendingDeletion[0]);
    }
    return `${nodesPendingDeletion.length} Nodes`;
  }, [nodesPendingDeletion]);

  const primaryNodeType = nodesPendingDeletion[0]?.type || "node";
  const inDesktop = isElectron();
  const hasFiles = diff.totalAffectedCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          "p-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#111216] text-zinc-100 shadow-2xl ring-1 ring-white/5 flex flex-col outline-none transition-all duration-200",
          "w-[80vw] h-[80vh] !max-w-[1280px] min-w-[680px] min-h-[520px] max-h-[85vh]",
        )}
      >
        {/* Header Bar */}
        <NodeDeletionHeader
          primaryNodeLabel={primaryNodeLabel}
          nodeCount={nodesPendingDeletion.length}
          primaryNodeType={primaryNodeType}
          isDeleting={isDeleting}
          onClose={() => onOpenChange(false)}
        />

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col gap-3 bg-[#111216]">
          {/* View Tab Switcher: Architecture Impact vs Code & Files Diff */}
          <NodeDeletionTabNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            canvasImpactCount={architectureImpact.totalCanvasImpactCount}
            fileImpactCount={diff.totalAffectedCount}
          />

          {/* TAB 1: Architecture & Node Impact View (Default) */}
          {activeTab === "architecture" && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <NodeArchitectureImpactView impact={architectureImpact} />
            </div>
          )}

          {/* TAB 2: Generated Code & Files Diff View */}
          {activeTab === "code" && (
            <div className="flex-1 overflow-hidden flex flex-col gap-2.5 min-h-0">
              {/* Impact summary row */}
              <NodeDeletionImpactSummary
                nodesPendingDeletion={nodesPendingDeletion}
                deletedCount={diff.deletedFiles.length}
                modifiedCount={diff.modifiedFiles.length}
                inDesktop={inDesktop}
                outputDir={outputDir}
              />

              {/* Main Affected Files & Code Preview Split Container */}
              <div className="flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row min-h-0">
                {/* Left: File Tree Explorer */}
                <NodeDeletionFileTree
                  totalAffectedCount={diff.totalAffectedCount}
                  deletedCount={diff.deletedFiles.length}
                  modifiedCount={diff.modifiedFiles.length}
                  filterType={filterType}
                  onFilterChange={setFilterType}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  fileTree={fileTree}
                  filteredFiles={filteredFiles}
                  selectedFilePath={selectedFilePath}
                  onSelectFile={(path) => {
                    setSelectedFilePath(path);
                    setPreviewVersion("before");
                  }}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                  onCopyPath={handleCopyPath}
                  copiedPath={copiedPath}
                  sidebarWidth={sidebarWidth}
                  showCodePreview={true}
                  hasFiles={hasFiles}
                />

                {/* Drag Resize Divider */}
                {hasFiles && (
                  <NodeDeletionResizeHandle
                    onMouseDown={handleMouseDownResize}
                    isDragging={isDraggingSidebar}
                  />
                )}

                {/* Right: Code Content Preview Panel */}
                {hasFiles && (
                  <NodeDeletionCodePreview
                    activeFileDetails={activeFileDetails}
                    previewVersion={previewVersion}
                    onPreviewVersionChange={setPreviewVersion}
                    onCopyCode={handleCopyCode}
                    copiedCode={copiedCode}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 px-4 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-end gap-2 shrink-0">
          <Button
            type="button"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            variant={"secondary"}
            className="h-8 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            variant={"destructive"}
            className="h-8 px-3 text-xs font-medium bg-red-600 hover:bg-red-500 text-white"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                <span>
                  Confirm & Delete ({architectureImpact.totalCanvasImpactCount > 0 ? `${architectureImpact.totalCanvasImpactCount} affected` : "Node"})
                </span>
              </>
            )}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
