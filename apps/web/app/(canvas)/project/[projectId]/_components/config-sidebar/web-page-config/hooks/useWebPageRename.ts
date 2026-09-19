import { useState } from "react";
import { parsePageRoute, normalizePageRoute, arePageRoutesEqual } from "@workspace/canvas";
import { toast } from "sonner";
import { BackendNode, BackendEdge } from "@/types/canvas";

interface UseWebPageRenameParams {
  nodeId?: string;
  data: BackendNode["data"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
  connectedWebApp?: BackendNode | null;
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
}

export function useWebPageRename({
  nodeId,
  data,
  updateData,
  connectedWebApp,
  allNodes = [],
  allEdges = [],
}: UseWebPageRenameParams) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [pendingRename, setPendingRename] = useState<{ oldLabel: string; newLabel: string } | null>(null);

  const handleRequestRename = (newLabel: string) => {
    const oldLabel = data.label || "";
    const cleanNew = parsePageRoute(newLabel) || newLabel.trim();

    // Check if another page in the same WebApp already has this route
    if (cleanNew.toLowerCase() !== "layout" && connectedWebApp) {
      const normalizedNew = normalizePageRoute(cleanNew);
      const existingPageEdges = allEdges.filter(
        (e) => e.source === connectedWebApp.id || e.target === connectedWebApp.id,
      );
      const duplicatePage = existingPageEdges
        .map((e) => allNodes.find((n) => n.id === (e.source === connectedWebApp.id ? e.target : e.source)))
        .find(
          (other) =>
            other &&
            other.id !== nodeId &&
            other.type === "webPage" &&
            !other.data?.isLayout &&
            other.data?.label?.trim().toLowerCase() !== "layout" &&
            normalizePageRoute(other.data?.label || other.data?.path || "") === normalizedNew,
        );

      if (duplicatePage) {
        toast.error(
          `Route "${normalizedNew}" already exists in this Web App (node "${duplicatePage.data?.label || "Page"}"). Route names must be unique.`,
        );
        return;
      }
    }

    // If oldLabel and cleanNew point to the exact same route (e.g. "/login" vs "login"), update label directly
    if (arePageRoutesEqual(oldLabel, cleanNew)) {
      updateData({ label: cleanNew });
      return;
    }

    if (
      !oldLabel ||
      oldLabel.trim() === "" ||
      oldLabel === "page-server" ||
      oldLabel === "Untitled" ||
      oldLabel === "Page"
    ) {
      updateData({ label: cleanNew });
      return;
    }

    const cleanOld = parsePageRoute(oldLabel);

    if (cleanOld === cleanNew) return;

    if (!cleanOld || cleanOld === "page-server" || cleanOld === "Untitled" || cleanOld === "Page") {
      updateData({ label: cleanNew });
      return;
    }

    setPendingRename({ oldLabel: cleanOld, newLabel: cleanNew });
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = () => {
    if (pendingRename) {
      updateData({ label: pendingRename.newLabel });
      setPendingRename(null);
    }
  };

  return {
    renameDialogOpen,
    setRenameDialogOpen,
    pendingRename,
    setPendingRename,
    handleRequestRename,
    handleConfirmRename,
  };
}
