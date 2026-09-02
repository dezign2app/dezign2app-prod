import { useState } from "react";
import { parsePageRoute } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";

interface UseWebPageRenameParams {
  data: BackendNode["data"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export function useWebPageRename({
  data,
  updateData,
}: UseWebPageRenameParams) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [pendingRename, setPendingRename] = useState<{ oldLabel: string; newLabel: string } | null>(null);

  const handleRequestRename = (newLabel: string) => {
    const oldLabel = data.label || "";
    const cleanNew = parsePageRoute(newLabel) || newLabel.trim();

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
