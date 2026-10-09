import { useState } from "react";
import { parseRouteWithQueryParams, parsePageRoute, normalizePageRoute, arePageRoutesEqual } from "@workspace/canvas";
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
  const [pendingRename, setPendingRename] = useState<{
    oldLabel: string;
    newLabel: string;
    additionalChanges?: Partial<BackendNode["data"]>;
  } | null>(null);

  const handleRequestRename = (newLabel: string) => {
    const oldLabel = data.label || "";
    const parsed = parseRouteWithQueryParams(newLabel);
    const cleanNew = parsed.route || newLabel.trim();

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

    // Merge any extracted path params or query params from the input string
    const existingPathParams = data.pathParams || [];
    const mergedPathParams = [...existingPathParams];
    let pathParamsChanged = false;
    parsed.extractedPathParams.forEach((ep) => {
      if (!mergedPathParams.some((p) => p.name.toLowerCase() === ep.name.toLowerCase())) {
        mergedPathParams.push(ep);
        pathParamsChanged = true;
      }
    });

    const existingQueryParams = data.queryParams || [];
    const mergedQueryParams = [...existingQueryParams];
    let queryParamsChanged = false;
    parsed.extractedQueryParams.forEach((eq) => {
      if (!mergedQueryParams.some((q) => q.name.toLowerCase() === eq.name.toLowerCase())) {
        mergedQueryParams.push(eq);
        queryParamsChanged = true;
      }
    });

    const additionalChanges: Partial<BackendNode["data"]> = {};
    if (pathParamsChanged) additionalChanges.pathParams = mergedPathParams;
    if (queryParamsChanged) additionalChanges.queryParams = mergedQueryParams;

    // If oldLabel and cleanNew point to the exact same route (e.g. "/login" vs "login"), update label directly
    if (arePageRoutesEqual(oldLabel, cleanNew)) {
      updateData({ label: cleanNew, ...additionalChanges });
      return;
    }

    if (
      !oldLabel ||
      oldLabel.trim() === "" ||
      oldLabel === "page-server" ||
      oldLabel === "Untitled" ||
      oldLabel === "Page"
    ) {
      updateData({ label: cleanNew, ...additionalChanges });
      return;
    }

    const cleanOld = parsePageRoute(oldLabel);

    if (cleanOld === cleanNew) {
      if (pathParamsChanged || queryParamsChanged) {
        updateData(additionalChanges);
      }
      return;
    }

    if (!cleanOld || cleanOld === "page-server" || cleanOld === "Untitled" || cleanOld === "Page") {
      updateData({ label: cleanNew, ...additionalChanges });
      return;
    }

    setPendingRename({ oldLabel: cleanOld, newLabel: cleanNew, additionalChanges });
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = () => {
    if (pendingRename) {
      updateData({
        label: pendingRename.newLabel,
        ...(pendingRename.additionalChanges || {}),
      });
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
