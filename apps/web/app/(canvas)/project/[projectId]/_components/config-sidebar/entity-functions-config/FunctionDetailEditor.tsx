import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, Zap, Check, Trash } from "lucide-react";
import { DbOperationFunction, CanvasEntityColumn } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { LocalInput } from "../../backend-nodes/graph-nodes/common/LocalInput";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  BusinessLogicBlock,
  generateCodeWithAI,
} from "../../shared/BusinessLogicBlock";
import { FunctionParamsSection } from "./FunctionParamsSection";
import { OperationTestStudio } from "./OperationTestStudio";

interface FunctionDetailEditorProps {
  selectedOp: DbOperationFunction;
  isNew?: boolean;
  onCancelNew?: () => void;
  onSaveNew?: () => void;
  label: string;
  columns?: CanvasEntityColumn[];
  pascalLabel: string;
  availableTableNodes: { id: string; label: string }[];
  parentDb?: BackendNode;
  onBack: () => void;
  updateSelectedOp: (changes: Partial<DbOperationFunction>) => void;
  handleTogglePagination?: (enabled: boolean) => void;
  handleChangePaginationMode?: (mode: "offset" | "cursor") => void;
  onDeleteRequest: (op: { id: string; name: string }) => void;
}

export const FunctionDetailEditor: React.FC<FunctionDetailEditorProps> = ({
  selectedOp,
  isNew = false,
  onCancelNew,
  onSaveNew,
  label,
  columns,
  pascalLabel,
  availableTableNodes,
  parentDb,
  onBack,
  updateSelectedOp,
  handleTogglePagination: externalTogglePagination,
  handleChangePaginationMode: externalChangePaginationMode,
  onDeleteRequest,
}) => {
  // Local draft state to eliminate global store roundtrips on every keystroke
  const [draftOp, setDraftOp] = useState<DbOperationFunction>(selectedOp);
  const isNewRef = useRef(isNew);
  const previousValidNameRef = useRef(selectedOp.name?.trim() || "");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const latestDraftOpRef = useRef(draftOp);
  latestDraftOpRef.current = draftOp;

  const isRedis =
    parentDb?.type === "redis_instance" ||
    parentDb?.data?.dbEngine === "redis" ||
    draftOp.id.startsWith("redis-");

  const pendingChangesRef = useRef<Partial<DbOperationFunction>>({});
  const debouncedSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const updateSelectedOpRef = useRef(updateSelectedOp);
  updateSelectedOpRef.current = updateSelectedOp;

  // Focus name field on mount when adding a new function
  useEffect(() => {
    isNewRef.current = isNew;
    if (isNew) {
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
    }
  }, [isNew]);

  const flushPending = useCallback(() => {
    if (debouncedSaveTimerRef.current) {
      clearTimeout(debouncedSaveTimerRef.current);
      debouncedSaveTimerRef.current = null;
    }
    if (Object.keys(pendingChangesRef.current).length > 0) {
      const changesToFlush = { ...pendingChangesRef.current };
      pendingChangesRef.current = {};
      updateSelectedOpRef.current(changesToFlush);
    }
  }, []);

  // Flush on unmount so no changes are ever lost
  useEffect(() => {
    return () => {
      const trimmed = (latestDraftOpRef.current.name || "").trim();
      if (!trimmed && !isNewRef.current && previousValidNameRef.current) {
        updateSelectedOpRef.current({ name: previousValidNameRef.current });
      } else {
        flushPending();
      }
    };
  }, [flushPending]);

  // Sync external prop if operation ID changes
  const prevOpIdRef = useRef(selectedOp.id);
  useEffect(() => {
    if (selectedOp.id !== prevOpIdRef.current) {
      flushPending();
      prevOpIdRef.current = selectedOp.id;
      setDraftOp(selectedOp);
      previousValidNameRef.current = selectedOp.name?.trim() || "";
    }
  }, [selectedOp, flushPending]);

  const handleUpdateOp = useCallback(
    (changes: Partial<DbOperationFunction>, immediate = false) => {
      setDraftOp((prev) => ({ ...prev, ...changes }));
      pendingChangesRef.current = { ...pendingChangesRef.current, ...changes };

      if (debouncedSaveTimerRef.current) {
        clearTimeout(debouncedSaveTimerRef.current);
        debouncedSaveTimerRef.current = null;
      }

      if (immediate) {
        flushPending();
      } else {
        debouncedSaveTimerRef.current = setTimeout(() => {
          flushPending();
        }, 500);
      }
    },
    [flushPending],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextVal = e.target.value;
      setDraftOp((prev) => ({ ...prev, name: nextVal }));
      const trimmed = nextVal.trim();
      if (trimmed) {
        handleUpdateOp({ name: nextVal });
      }
    },
    [handleUpdateOp],
  );

  const handleNameBlur = useCallback(() => {
    const trimmed = (latestDraftOpRef.current.name || "").trim();

    if (!trimmed) {
      if (isNewRef.current) {
        // Cancel add function if blank on blur
        if (debouncedSaveTimerRef.current) {
          clearTimeout(debouncedSaveTimerRef.current);
          debouncedSaveTimerRef.current = null;
          pendingChangesRef.current = {};
        }
        if (onCancelNew) {
          onCancelNew();
        } else {
          onDeleteRequest({
            id: draftOp.id,
            name: draftOp.name || "Function",
          });
        }
        return;
      } else {
        // Cancel rename: restore previous valid name
        const restored =
          previousValidNameRef.current ||
          (isRedis ? `custom${pascalLabel}Op` : `custom${pascalLabel}Query`);
        setDraftOp((prev) => ({ ...prev, name: restored }));
        handleUpdateOp({ name: restored }, true);
        return;
      }
    }

    // Non-empty valid name
    previousValidNameRef.current = trimmed;
    isNewRef.current = false;
    onSaveNew?.();
    handleUpdateOp({ name: trimmed }, true);
  }, [
    draftOp.id,
    draftOp.name,
    isRedis,
    pascalLabel,
    handleUpdateOp,
    onCancelNew,
    onDeleteRequest,
    onSaveNew,
  ]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        nameInputRef.current?.blur();
      } else if (e.key === "Escape") {
        if (isNewRef.current) {
          if (debouncedSaveTimerRef.current) {
            clearTimeout(debouncedSaveTimerRef.current);
            debouncedSaveTimerRef.current = null;
            pendingChangesRef.current = {};
          }
          if (onCancelNew) {
            onCancelNew();
          } else {
            onDeleteRequest({
              id: draftOp.id,
              name: draftOp.name || "Function",
            });
          }
        } else {
          const restored =
            previousValidNameRef.current ||
            (isRedis ? `custom${pascalLabel}Op` : `custom${pascalLabel}Query`);
          setDraftOp((prev) => ({ ...prev, name: restored }));
          handleUpdateOp({ name: restored }, true);
          nameInputRef.current?.blur();
        }
      }
    },
    [
      draftOp.id,
      draftOp.name,
      isRedis,
      pascalLabel,
      handleUpdateOp,
      onCancelNew,
      onDeleteRequest,
    ],
  );

  const handleBack = useCallback(() => {
    const trimmed = (latestDraftOpRef.current.name || "").trim();
    if (!trimmed) {
      if (isNewRef.current) {
        if (debouncedSaveTimerRef.current) {
          clearTimeout(debouncedSaveTimerRef.current);
          debouncedSaveTimerRef.current = null;
          pendingChangesRef.current = {};
        }
        if (onCancelNew) {
          onCancelNew();
        } else {
          onDeleteRequest({
            id: draftOp.id,
            name: draftOp.name || "Function",
          });
        }
        return;
      } else {
        const restored =
          previousValidNameRef.current ||
          (isRedis ? `custom${pascalLabel}Op` : `custom${pascalLabel}Query`);
        handleUpdateOp({ name: restored }, true);
      }
    }
    flushPending();
    onBack();
  }, [
    draftOp.id,
    draftOp.name,
    isRedis,
    pascalLabel,
    onCancelNew,
    onDeleteRequest,
    flushPending,
    onBack,
    handleUpdateOp,
  ]);

  const handleDelete = useCallback(() => {
    if (debouncedSaveTimerRef.current) {
      clearTimeout(debouncedSaveTimerRef.current);
      debouncedSaveTimerRef.current = null;
      pendingChangesRef.current = {};
    }
    onDeleteRequest({
      id: draftOp.id,
      name: draftOp.name || "Function",
    });
  }, [draftOp.id, draftOp.name, onDeleteRequest]);

  const handleTogglePagination = useCallback(
    (enabled: boolean) => {
      const currentPagination = draftOp.pagination || {
        defaultLimit: 20,
        maxLimit: 100,
        mode: "offset",
      };

      let params = draftOp.params || [];
      if (enabled) {
        const mode = currentPagination.mode || "offset";
        const hasLimit = params.some((p) => p.name === "limit");
        const hasOffset = params.some((p) => p.name === "offset");
        const hasCursor = params.some((p) => p.name === "cursor");

        const newParams = [...params];
        if (!hasLimit) {
          newParams.push({
            name: "limit",
            type: "number",
            required: false,
            defaultValue: String(currentPagination.defaultLimit ?? 20),
          });
        }
        if (mode === "offset" && !hasOffset) {
          newParams.push({
            name: "offset",
            type: "number",
            required: false,
            defaultValue: "0",
          });
        } else if (mode === "cursor" && !hasCursor) {
          newParams.push({
            name: "cursor",
            type: "string",
            required: false,
          });
        }
        params = newParams;
      } else {
        params = params.filter(
          (p) => p.name !== "limit" && p.name !== "offset" && p.name !== "cursor",
        );
      }

      handleUpdateOp(
        {
          pagination: { ...currentPagination, enabled },
          params,
        },
        true,
      );
    },
    [draftOp.pagination, draftOp.params, handleUpdateOp],
  );

  const handleChangePaginationMode = useCallback(
    (mode: "offset" | "cursor") => {
      let params = draftOp.params || [];
      if (mode === "offset") {
        params = params.filter((p) => p.name !== "cursor");
        if (!params.some((p) => p.name === "offset")) {
          params.push({
            name: "offset",
            type: "number",
            required: false,
            defaultValue: "0",
          });
        }
      } else {
        params = params.filter((p) => p.name !== "offset");
        if (!params.some((p) => p.name === "cursor")) {
          params.push({
            name: "cursor",
            type: "string",
            required: false,
          });
        }
      }

      handleUpdateOp(
        {
          pagination: {
            ...(draftOp.pagination || {
              enabled: true,
              defaultLimit: 20,
              maxLimit: 100,
            }),
            mode,
          },
          params,
        },
        true,
      );
    },
    [draftOp.pagination, draftOp.params, handleUpdateOp],
  );

  const handlePromptChange = useCallback(
    (prompt: string) => {
      handleUpdateOp({ prompt, query: prompt });
    },
    [handleUpdateOp],
  );

  const handleCodeChange = useCallback(
    (code: string) => {
      handleUpdateOp({ code });
    },
    [handleUpdateOp],
  );

  const handleModeChange = useCallback(
    (logicMode: "natural_language" | "code") => {
      handleUpdateOp({ logicMode }, true);
    },
    [handleUpdateOp],
  );

  const handleGenerateCode = useCallback(async () => {
    const promptText =
      draftOp.prompt ||
      draftOp.query ||
      `Query function for ${draftOp.name}`;
    const generated = await generateCodeWithAI({
      prompt: promptText,
      endpointPath: `db.${label}.${draftOp.name}`,
      endpointMethod: draftOp.kind.toUpperCase(),
      availableTableNodes,
    });
    if (generated) {
      handleUpdateOp({ code: generated, logicMode: "code" }, true);
    }
  }, [
    draftOp.prompt,
    draftOp.query,
    draftOp.name,
    draftOp.kind,
    label,
    availableTableNodes,
    handleUpdateOp,
  ]);

  return (
    <div className="flex flex-col gap-6 mt-2 pb-12">
      {/* Back navigation */}
      <div
        onClick={handleBack}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      >
        <ChevronLeft size={16} className="mr-0.5" />
        Back to Operations List
      </div>

      {/* Operation Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-secondary text-secondary-foreground rounded border border-border/40 uppercase">
            {draftOp.kind === "fetchByIndex" ? "INDEX" : draftOp.kind}
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground font-mono">
            {draftOp.name || (isNew ? "New Function" : "Unnamed Function")}
          </span>
          {draftOp.isAutoGenerated && (
            <span className="text-[10px] text-muted-foreground border border-border/40 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Zap size={10} className="text-muted-foreground" /> Auto
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Define function signature, input parameters, pagination, and implementation logic.
        </span>
      </div>

      {/* 1. Function Name & Kind */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Function Name</Label>
          <LocalInput
            ref={nameInputRef}
            autoFocus={isNew}
            value={draftOp.name}
            debounceMs={150}
            placeholder={isRedis ? `custom${pascalLabel}Op` : `custom${pascalLabel}Query`}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Operation Kind</Label>
          <Select
            value={draftOp.kind}
            onValueChange={(val: DbOperationFunction["kind"]) =>
              handleUpdateOp({ kind: val }, true)
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="findAll">Read (findAll)</SelectItem>
              <SelectItem value="findById">Read (findById)</SelectItem>
              <SelectItem value="fetchByIndex">Index Fetch (fetchByIndex)</SelectItem>
              <SelectItem value="join">Relational Join (join)</SelectItem>
              <SelectItem value="create">Write (create)</SelectItem>
              <SelectItem value="update">Write (update)</SelectItem>
              <SelectItem value="delete">Write (delete)</SelectItem>
              <SelectItem value="custom">Custom Query</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold">Description</Label>
        <LocalInput
          placeholder="Purpose of this database function..."
          value={draftOp.description || ""}
          debounceMs={150}
          onChange={(e) => handleUpdateOp({ description: e.target.value })}
          className="h-8 text-xs"
        />
      </div>

      {/* 2. Unified Function Input Parameters & Pagination Card */}
      <FunctionParamsSection
        selectedOp={draftOp}
        updateSelectedOp={handleUpdateOp}
        handleTogglePagination={handleTogglePagination}
        handleChangePaginationMode={handleChangePaginationMode}
      />

      {/* 3. Business Logic Block */}
      <BusinessLogicBlock
        title="Function Body & Business Logic"
        description="Define the function implementation in natural language or write query code. Use AI to generate code from instructions."
        mode={draftOp.logicMode || "natural_language"}
        onModeChange={handleModeChange}
        prompt={draftOp.prompt || draftOp.query || ""}
        onPromptChange={handlePromptChange}
        code={draftOp.code || ""}
        onCodeChange={handleCodeChange}
        availableTableNodes={availableTableNodes}
        promptPlaceholder={`Describe query function logic for ${draftOp.name}... e.g. Query ${label} table with parameters and pagination limit/offset`}
        codePlaceholder="/* Function implementation code or raw SQL query */"
        onGenerateCode={handleGenerateCode}
      />

      {/* 4. Test Cases & Live Execution Studio */}
      <OperationTestStudio
        selectedOp={draftOp}
        label={label}
        columns={columns}
        parentDb={parentDb}
        updateSelectedOp={handleUpdateOp}
      />

      {/* Actions Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border/40">
        <Button
          variant="destructive"
          size="sm"
          className="h-8 gap-1 text-xs cursor-pointer"
          onClick={handleDelete}
        >
          <Trash size={13} /> Delete Function
        </Button>

        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1 text-xs cursor-pointer"
          onClick={handleBack}
        >
          <Check size={13} /> Done
        </Button>
      </div>
    </div>
  );
};
