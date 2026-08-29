import React from "react";
import { PageCodeMismatchDialog } from "../PageCodeMismatchDialog";
import { NodeDeletionDialog } from "@/app/(canvas)/project/[projectId]/_components/NodeDeletionDialog";
import { DiffSummary } from "../diffMergeUtils";

interface WebPageDialogsProps {
  nodeId: string;
  projectId: string;
  mismatchDialogOpen: boolean;
  setMismatchDialogOpen: (open: boolean) => void;
  pageName: string;
  pageRoute: string;
  filePath: string;
  serverCode: string;
  localDiskCode: string;
  diffSummary: DiffSummary;
  isMismatchSaving: boolean;
  mergeAllToServer: () => Promise<void> | void;
  mergeSelectedToServer: (selectedHunkIds: string[]) => Promise<void> | void;
  overwriteLocalWithServer: () => Promise<void> | void;
  renameDialogOpen: boolean;
  setRenameDialogOpen: (open: boolean) => void;
  pendingRename: { oldLabel: string; newLabel: string } | null;
  setPendingRename: (val: { oldLabel: string; newLabel: string } | null) => void;
  onConfirmRename: () => void;
}

export function WebPageDialogs({
  nodeId,
  projectId,
  mismatchDialogOpen,
  setMismatchDialogOpen,
  pageName,
  pageRoute,
  filePath,
  serverCode,
  localDiskCode,
  diffSummary,
  isMismatchSaving,
  mergeAllToServer,
  mergeSelectedToServer,
  overwriteLocalWithServer,
  renameDialogOpen,
  setRenameDialogOpen,
  pendingRename,
  setPendingRename,
  onConfirmRename,
}: WebPageDialogsProps) {
  return (
    <>
      {/* Granular Code Mismatch & Merge Dialog */}
      <PageCodeMismatchDialog
        open={mismatchDialogOpen}
        onOpenChange={setMismatchDialogOpen}
        pageName={pageName}
        pageRoute={pageRoute}
        filePath={filePath}
        serverCode={serverCode}
        localDiskCode={localDiskCode}
        diffSummary={diffSummary}
        isSaving={isMismatchSaving}
        onMergeAll={mergeAllToServer}
        onMergeSelected={mergeSelectedToServer}
        onOverwriteLocal={overwriteLocalWithServer}
      />

      {/* Page Rename / File Deletion Confirmation Dialog */}
      {pendingRename && (
        <NodeDeletionDialog
          open={renameDialogOpen}
          onOpenChange={(open) => {
            setRenameDialogOpen(open);
            if (!open) setPendingRename(null);
          }}
          projectId={projectId}
          deletionTarget={{
            type: "pageRename",
            nodeId,
            oldLabel: pendingRename.oldLabel,
            newLabel: pendingRename.newLabel,
            onConfirm: onConfirmRename,
          }}
        />
      )}
    </>
  );
}
