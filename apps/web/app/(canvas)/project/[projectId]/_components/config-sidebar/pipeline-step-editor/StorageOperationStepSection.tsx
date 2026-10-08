"use client";

import React, { useMemo } from "react";
import { BackendNode, BackendEdge, StepBinding } from "@workspace/canvas/types";
import {
  getStorageOperations,
  computeStorageOpBindings,
  StorageOperationFunction,
} from "@/lib/utils/storageOperationsHelper";
import { toFolderName, toVarName } from "@/lib/compiler/utils";
import { cn } from "@workspace/ui/lib/utils";
import { Label } from "@workspace/ui/components/label";
import { StepCombobox, StepComboboxOption } from "./StepCombobox";
import { HardDrive, Layers, Code2, Sparkles } from "lucide-react";
import { PipelineStepDraft, ExpectedArg, AvailableSource } from "./types";
import { Badge } from "@workspace/ui/components/badge";

export interface StorageOperationStepSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  expectedArgs?: ExpectedArg[];
  availableSources?: AvailableSource[];
  showAdvancedSettings?: boolean;
  onToggleAdvancedSettings?: () => void;
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments?: () => void;
  children?: React.ReactNode;
}

export const StorageOperationStepSection: React.FC<StorageOperationStepSectionProps> = ({
  step,
  allNodes,
  allEdges: _allEdges,
  expectedArgs: _expectedArgs,
  availableSources: _availableSources,
  onChange,
  onAutoMapArguments,
  children,
}) => {
  const allStorageNodes = useMemo(
    () => allNodes.filter((n) => n.type === "storage"),
    [allNodes],
  );

  const selectedStorageNode = useMemo(() => {
    return (
      allStorageNodes.find(
        (n) => n.id === step.storageNodeId || n.id === step.brokerNodeId,
      ) || allStorageNodes[0]
    );
  }, [allStorageNodes, step.storageNodeId, step.brokerNodeId]);

  const availableBuckets = useMemo(() => {
    return selectedStorageNode?.data?.buckets || [];
  }, [selectedStorageNode]);

  const operations: StorageOperationFunction[] = useMemo(() => {
    return getStorageOperations(selectedStorageNode);
  }, [selectedStorageNode]);

  const selectedOp = useMemo(() => {
    return (
      operations.find(
        (op) =>
          op.name === step.functionRef?.name || op.id === step.operationId,
      ) || operations[0]
    );
  }, [operations, step.functionRef?.name, step.operationId]);

  const selectedBucket = useMemo(() => {
    if (step.bucketId) return step.bucketId;
    return availableBuckets[0]?.name || "default-bucket";
  }, [step.bucketId, availableBuckets]);

  const handleSelectStorageNode = (nodeId: string) => {
    const targetNode = allStorageNodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    const targetBuckets = targetNode.data?.buckets || [];
    const firstBucketName = targetBuckets[0]?.name || "default-bucket";
    const packageFolder = toFolderName(targetNode.data?.label || "storage") || "storage";

    const nextBindings = computeStorageOpBindings(
      selectedOp,
      step.inputBindings || [],
      firstBucketName,
    );

    onChange({
      ...step,
      storageNodeId: targetNode.id,
      brokerNodeId: targetNode.id,
      bucketId: firstBucketName,
      functionRef: {
        name: selectedOp?.name || "uploadObject",
        importPath: `@workspace/${packageFolder}/operations`,
        signature: selectedOp?.signature,
      },
      inputBindings: nextBindings,
    });
  };

  const handleSelectBucket = (bucketName: string) => {
    const packageFolder =
      toFolderName(selectedStorageNode?.data?.label || "storage") || "storage";

    const nextBindings = computeStorageOpBindings(
      selectedOp,
      step.inputBindings || [],
      bucketName,
    );

    onChange({
      ...step,
      bucketId: bucketName,
      functionRef: {
        name: selectedOp?.name || "uploadObject",
        importPath: `@workspace/${packageFolder}/operations`,
        signature: selectedOp?.signature,
      },
      inputBindings: nextBindings,
    });
  };

  const handleSelectOperation = (opId: string) => {
    const op = operations.find((o) => o.id === opId || o.name === opId);
    if (!op) return;

    const packageFolder =
      toFolderName(selectedStorageNode?.data?.label || "storage") || "storage";

    const nextBindings = computeStorageOpBindings(
      op,
      step.inputBindings || [],
      selectedBucket,
    );

    let defaultVar = step.outputVariable;
    if (!defaultVar || defaultVar.startsWith("step") || defaultVar.startsWith("storageResult")) {
      if (op.kind === "presign_upload") defaultVar = "uploadUrl";
      else if (op.kind === "presign_download") defaultVar = "downloadUrl";
      else if (op.kind === "upload") defaultVar = "uploadedFile";
      else if (op.kind === "download") defaultVar = "fileData";
      else if (op.kind === "delete" || op.kind === "batch_delete") defaultVar = "deleteResult";
      else if (op.kind === "list") defaultVar = "listedObjects";
      else if (op.kind === "exists") defaultVar = "fileExists";
      else if (op.kind === "copy") defaultVar = "copyResult";
    }

    onChange({
      ...step,
      operationId: op.id,
      storageNodeId: selectedStorageNode?.id,
      brokerNodeId: selectedStorageNode?.id,
      bucketId: selectedBucket,
      name: op.label || op.name,
      outputVariable: defaultVar,
      functionRef: {
        name: op.name,
        importPath: `@workspace/${packageFolder}/operations`,
        signature: op.signature,
      },
      inputBindings: nextBindings,
    });
  };

  // Auto-migrate: Ensure filename binding exists for storage operations that require/support a filename
  React.useEffect(() => {
    if (!selectedOp) return;
    const isUploadOrPresign =
      selectedOp.kind === "presign_upload" ||
      selectedOp.kind === "presign_download" ||
      selectedOp.kind === "upload" ||
      selectedOp.name === "getUploadPresignedUrl" ||
      selectedOp.name === "getDownloadPresignedUrl" ||
      selectedOp.name === "uploadObject" ||
      selectedOp.params?.some((p) => p.name.toLowerCase() === "filename");

    if (!isUploadOrPresign) return;

    const currentBindings = step.inputBindings || [];
    const hasFilename = currentBindings.some(
      (b) => (b.argName || "").trim().toLowerCase() === "filename",
    );

    if (!hasFilename) {
      const reqBodySource = _availableSources?.find(
        (s) => s.kind === "req_body" || s.id === "event_payload",
      );
      const matchField =
        reqBodySource?.paths.find((p) => {
          const norm = p.path.toLowerCase();
          return (
            norm === "filename" ||
            norm === "name" ||
            norm === "file" ||
            norm === "filepath" ||
            norm === "originalname"
          );
        })?.path || "filename";

      const filenameBinding: StepBinding = {
        argName: "filename",
        source: {
          kind: "req_body",
          field: matchField,
        },
      };

      const optionsIdx = currentBindings.findIndex(
        (b) => (b.argName || "").trim().toLowerCase() === "options",
      );
      const keyIdx = currentBindings.findIndex(
        (b) => (b.argName || "").trim().toLowerCase() === "key",
      );

      const next = [...currentBindings];
      if (keyIdx !== -1) {
        next.splice(keyIdx + 1, 0, filenameBinding);
      } else if (optionsIdx !== -1) {
        next.splice(optionsIdx, 0, filenameBinding);
      } else {
        next.push(filenameBinding);
      }

      onChange({
        ...step,
        inputBindings: next,
      });
    }
  }, [selectedOp, step, onChange, _availableSources]);

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Storage Node & Bucket Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Storage Node Selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <HardDrive size={11} className="text-amber-500" />
            Storage Node
          </Label>
          <StepCombobox
            value={selectedStorageNode?.id || ""}
            onValueChange={handleSelectStorageNode}
            options={allStorageNodes.map((node) => ({
              value: node.id,
              label: node.data?.label || "Storage Node",
            }))}
            placeholder="Select storage node..."
            className="h-7 text-xs bg-background/60 border-border/60"
          />
        </div>

        {/* Bucket Selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <Layers size={11} className="text-amber-500" />
            Bucket Resource
          </Label>
          <StepCombobox
            value={selectedBucket || ""}
            onValueChange={handleSelectBucket}
            options={
              availableBuckets.length === 0
                ? [{ value: "default-bucket", label: "default-bucket" }]
                : availableBuckets.map((b) => ({
                    value: b.name,
                    label: b.name,
                  }))
            }
            placeholder="Select bucket..."
            className="h-7 text-xs bg-background/60 border-border/60 font-mono"
          />
        </div>
      </div>

      {/* 2. Operation Picker */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <Code2 size={11} className="text-amber-500" />
            Storage Operation
          </Label>
          {onAutoMapArguments && (
            <button
              type="button"
              onClick={onAutoMapArguments}
              className="text-[10px] font-medium text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
              title="Automatically map input parameters from request context"
            >
              <Sparkles size={11} />
              Auto-Map
            </button>
          )}
        </div>
        <StepCombobox
          value={selectedOp?.id || selectedOp?.name || ""}
          onValueChange={handleSelectOperation}
          options={operations.map((op) => ({
            value: op.id,
            label: op.name,
            description: op.description,
            badge: op.badge ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[8px] font-bold font-mono px-1 py-0 h-4 border uppercase shrink-0",
                  op.badge.colorClass,
                )}
              >
                {op.badge.label}
              </Badge>
            ) : undefined,
          }))}
          placeholder="Select storage function..."
          className="h-7 text-xs bg-background/60 border-border/60"
        />
      </div>

      {/* 3. Live Function Signature & Description Box */}
      {selectedOp && (
        <div className="rounded-lg bg-secondary/15 border border-border/50 p-2.5 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Signature
            </span>
            {selectedOp.badge && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[8px] font-bold font-mono px-1.5 py-0 h-4 uppercase",
                  selectedOp.badge.colorClass,
                )}
              >
                {selectedOp.badge.label}
              </Badge>
            )}
          </div>
          <div className="font-mono text-[11px] text-amber-500 dark:text-amber-400 select-text overflow-x-auto whitespace-pre hide-scrollbar text-wrap">
            {selectedOp.signature}
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {selectedOp.description}
          </p>
        </div>
      )}

      {/* 4. Argument Bindings Section (Passed as children) */}
      {children}
    </div>
  );
};
