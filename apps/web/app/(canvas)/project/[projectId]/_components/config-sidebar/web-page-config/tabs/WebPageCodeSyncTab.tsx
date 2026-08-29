import React from "react";
import { TabsContent } from "@workspace/ui/components/tabs";
import { WebPageCodeSyncSection } from "../WebPageCodeSyncSection";
import { DiffSummary } from "../../diffMergeUtils";
import { MismatchStatus } from "../../useWebPageCodeMismatch";

interface WebPageCodeSyncTabProps {
  hasCustomServerFile: boolean;
  detectedDiskPath: string;
  defaultFilePath: string;
  outputDir: string;
  mismatchStatus: MismatchStatus;
  diffSummary: DiffSummary;
  isMismatchSaving: boolean;
  onOpenMismatchDialog: () => void;
  onMergeAllToServer: () => void;
  onOverwriteLocalWithServer: () => void;
  onOpenPageStudio: () => void;
  onResetToCompilerBaseline: () => void;
}

export function WebPageCodeSyncTab({
  hasCustomServerFile,
  detectedDiskPath,
  defaultFilePath,
  outputDir,
  mismatchStatus,
  diffSummary,
  isMismatchSaving,
  onOpenMismatchDialog,
  onMergeAllToServer,
  onOverwriteLocalWithServer,
  onOpenPageStudio,
  onResetToCompilerBaseline,
}: WebPageCodeSyncTabProps) {
  return (
    <TabsContent
      value="code"
      className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
    >
      <WebPageCodeSyncSection
        hasCustomServerFile={hasCustomServerFile}
        detectedDiskPath={detectedDiskPath}
        defaultFilePath={defaultFilePath}
        outputDir={outputDir}
        mismatchStatus={mismatchStatus}
        diffSummary={diffSummary}
        isMismatchSaving={isMismatchSaving}
        onOpenMismatchDialog={onOpenMismatchDialog}
        onMergeAllToServer={onMergeAllToServer}
        onOverwriteLocalWithServer={onOverwriteLocalWithServer}
        onOpenPageStudio={onOpenPageStudio}
        onResetToCompilerBaseline={onResetToCompilerBaseline}
      />
    </TabsContent>
  );
}
