"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  PipelineStep,
  PipelineStepInputBinding,
  Endpoint,
  DbOperationFunction,
} from "@workspace/canvas/types";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { toTableName, toVarName, parseSchemaJson } from "@/lib/compiler/utils";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@workspace/ui/components/popover";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Database,
  Table as TableIcon,
  Zap,
  Shuffle,
  Cloud,
  Terminal,
  Radio,
  Check,
  Sparkles,
  Settings2,
  Code2,
  Send,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepSource =
  | { kind: "req_body"; field: string }
  | { kind: "req_params"; field: string }
  | { kind: "req_query"; field: string }
  | { kind: "req_headers"; field: string }
  | { kind: "step_output"; stepId: string; field?: string }
  | { kind: "literal"; value: string | number | boolean };

export type StepBinding = PipelineStepInputBinding & { source: StepSource };

export type StepType =
  | "transform"
  | "db_operation"
  | "redis_operation"
  | "kafka_publish"
  | "service_call"
  | "custom_code"
  | "return_response";

export type PipelineStepDraft = {
  id: string;
  name: string;
  type: StepType;
  enabled?: boolean;
  statusCode?: number;
  responseMode?: string;
  databaseId?: string;
  tableNodeId?: string;
  operationId?: string;
  functionRef?: { name: string; importPath: string; signature?: string };
  inputBindings: StepBinding[];
  outputVariable: string;
  outputSchema?: { name: string; type: string; required?: boolean }[];
  customCode?: string;
};

export interface AvailablePath {
  path: string;
  type?: string;
  description?: string;
}

export interface AvailableSource {
  id: string;
  label: string;
  kind: "req_body" | "req_params" | "req_query" | "req_headers" | "step_output" | "literal";
  stepId?: string;
  variableName?: string;
  rootVariableName?: string;
  paths: AvailablePath[];
}

// ---------------------------------------------------------------------------
// Path Introspection Helpers
// ---------------------------------------------------------------------------

function extractPathsFromObject(obj: unknown, prefix = "", depth = 0): AvailablePath[] {
  if (depth > 6 || obj === null || obj === undefined) return [];
  const results: AvailablePath[] = [];

  if (Array.isArray(obj)) {
    if (prefix) {
      results.push({ path: prefix, type: "array" });
    }
    if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
      results.push(...extractPathsFromObject(obj[0], prefix ? `${prefix}[0]` : "[0]", depth + 1));
    }
    return results;
  }

  if (typeof obj === "object") {
    if (prefix) {
      results.push({ path: prefix, type: "object" });
    }
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const valType = Array.isArray(val) ? "array" : typeof val;
      if (val !== null && typeof val === "object") {
        results.push(...extractPathsFromObject(val, fullPath, depth + 1));
      } else {
        results.push({ path: fullPath, type: valType });
      }
    }
  }
  return results;
}

function getAvailableSources(
  endpoint?: Endpoint,
  priorSteps: PipelineStepDraft[] = [],
  allNodes: BackendNode[] = [],
): AvailableSource[] {
  const sources: AvailableSource[] = [];

  // 1. Request Body
  const bodyPaths: AvailablePath[] = [];
  if (endpoint?.requestBody) {
    if (Array.isArray(endpoint.requestBody.fields) && endpoint.requestBody.fields.length > 0) {
      endpoint.requestBody.fields.forEach((f) => {
        if (f.name) {
          bodyPaths.push({ path: f.name, type: f.type, description: f.description });
        }
      });
    }
    if (endpoint.requestBody.rawJson) {
      const parsed = parseSchemaJson(endpoint.requestBody.rawJson);
      if (parsed && typeof parsed === "object") {
        const jsonPaths = extractPathsFromObject(parsed);
        jsonPaths.forEach((jp) => {
          if (!bodyPaths.some((bp) => bp.path === jp.path)) {
            bodyPaths.push(jp);
          }
        });
      }
    }
  }
  sources.push({
    id: "req_body",
    label: "Request Body (body)",
    kind: "req_body",
    rootVariableName: "body",
    paths: bodyPaths,
  });

  // 2. Path Params
  const pathParams: AvailablePath[] = [];
  if (Array.isArray(endpoint?.pathParams)) {
    endpoint.pathParams.forEach((p) => {
      if (p.name) pathParams.push({ path: p.name, type: p.type, description: p.description });
    });
  }
  sources.push({
    id: "req_params",
    label: "Path Params (params)",
    kind: "req_params",
    rootVariableName: "req.params",
    paths: pathParams,
  });

  // 3. Query Params
  const queryParams: AvailablePath[] = [];
  if (Array.isArray(endpoint?.queryParams)) {
    endpoint.queryParams.forEach((p) => {
      if (p.name) queryParams.push({ path: p.name, type: p.type, description: p.description });
    });
  }
  sources.push({
    id: "req_query",
    label: "Query Params (query)",
    kind: "req_query",
    rootVariableName: "req.query",
    paths: queryParams,
  });

  // 4. Headers
  const headerPaths: AvailablePath[] = [];
  if (Array.isArray(endpoint?.headers)) {
    endpoint.headers.forEach((h) => {
      if (h.name) headerPaths.push({ path: h.name, type: h.type, description: h.description });
    });
  }
  sources.push({
    id: "req_headers",
    label: "Request Headers",
    kind: "req_headers",
    rootVariableName: "req.headers",
    paths: headerPaths,
  });

  // 5. Prior Steps
  priorSteps.forEach((s, idx) => {
    const varName = s.outputVariable || `step${idx + 1}Result`;
    const stepPaths: AvailablePath[] = [];

    if (Array.isArray(s.outputSchema) && s.outputSchema.length > 0) {
      s.outputSchema.forEach((os) => {
        if (os.name) stepPaths.push({ path: os.name, type: os.type });
      });
    }

    if (s.tableNodeId) {
      const tableNode = allNodes.find((n) => n.id === s.tableNodeId);
      if (tableNode?.data?.columns) {
        tableNode.data.columns.forEach((col) => {
          if (col.name && !stepPaths.some((p) => p.path === col.name)) {
            stepPaths.push({ path: col.name, type: col.type });
          }
        });
      }
    }

    sources.push({
      id: `step:${s.id}`,
      label: `Step ${idx + 1}: ${s.name || "Step"} (${varName})`,
      kind: "step_output",
      stepId: s.id,
      variableName: varName,
      rootVariableName: varName,
      paths: stepPaths,
    });
  });

  // 6. Literal Value
  sources.push({
    id: "literal",
    label: "Literal Value",
    kind: "literal",
    rootVariableName: "literal",
    paths: [],
  });

  return sources;
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const STEP_TYPE_META: Record<
  StepType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  transform: {
    label: "Transform",
    icon: <Shuffle size={13} />,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  db_operation: {
    label: "DB Operation",
    icon: <Database size={13} />,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  redis_operation: {
    label: "Redis",
    icon: <Zap size={13} />,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  kafka_publish: {
    label: "Kafka Publish",
    icon: <Radio size={13} />,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  service_call: {
    label: "Service Call",
    icon: <Cloud size={13} />,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  custom_code: {
    label: "Custom Code",
    icon: <Terminal size={13} />,
    color: "text-green-400 bg-green-500/10 border-green-500/20",
  },
  return_response: {
    label: "Return Response",
    icon: <Send size={13} />,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
};

const ADDABLE_STEP_TYPES: StepType[] = [
  "transform",
  "db_operation",
  "redis_operation",
  "kafka_publish",
  "service_call",
  "custom_code",
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Smart Path Selector / Input Component
// ---------------------------------------------------------------------------

interface SmartPathInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestedPaths: AvailablePath[];
  placeholder?: string;
  sourceKindLabel?: string;
  rootVariableName?: string;
}

const SmartPathInput = ({
  value,
  onChange,
  suggestedPaths,
  placeholder,
  sourceKindLabel,
  rootVariableName,
}: SmartPathInputProps) => {
  const [open, setOpen] = useState(false);

  const displayPlaceholder =
    placeholder ||
    (rootVariableName ? `(whole ${rootVariableName})` : "path.to.field");

  return (
    <div className="flex-1 min-w-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex items-center w-full">
            <Input
              className="h-7 text-xs font-mono bg-background/70 border-border/60 pr-6 w-full"
              placeholder={displayPlaceholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setOpen(true)}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1.5 text-muted-foreground/60 hover:text-foreground p-0.5 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              title="Choose from suggested paths or whole object"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="p-1 w-[var(--radix-popover-trigger-width)] min-w-[220px] max-h-56 overflow-y-auto z-[100] bg-popover border border-border rounded-md shadow-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 mb-1">
            <span>{sourceKindLabel ? `Fields in ${sourceKindLabel}` : "Suggested Fields"}</span>
          </div>

          {suggestedPaths.map((p) => (
            <button
              key={p.path}
              type="button"
              className="w-full text-left px-2 py-1 text-xs font-mono rounded hover:bg-accent text-foreground flex items-center justify-between transition-colors"
              onClick={() => {
                onChange(p.path);
                setOpen(false);
              }}
            >
              <span className="truncate">{p.path}</span>
              {p.type && (
                <span className="text-[9px] text-muted-foreground/60 px-1 py-0.2 rounded bg-muted/40 font-sans shrink-0 ml-1">
                  {p.type}
                </span>
              )}
            </button>
          ))}

          {suggestedPaths.length > 0 && (
            <div className="border-t border-border/40 my-1" />
          )}

          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-xs font-mono rounded hover:bg-accent text-foreground flex items-center justify-between transition-colors"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <span className="italic text-[11px] text-foreground/80">
              (whole {rootVariableName || "object"})
            </span>
            <span className="text-[9px] text-primary/90 font-mono bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              {rootVariableName || "body"}
            </span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Binding Source Editor
// ---------------------------------------------------------------------------

interface BindingSourceEditorProps {
  binding: StepBinding;
  availableSources: AvailableSource[];
  onChange: (updated: StepBinding) => void;
}

const BindingSourceEditor = ({
  binding,
  availableSources,
  onChange,
}: BindingSourceEditorProps) => {
  const { source } = binding;

  const currentSourceOptionId = useMemo(() => {
    if (source.kind === "step_output") {
      return `step:${source.stepId}`;
    }
    return source.kind;
  }, [source]);

  const activeSource = availableSources.find((s) => s.id === currentSourceOptionId);

  const handleSourceSelect = (selectedId: string) => {
    if (selectedId.startsWith("step:")) {
      const stepId = selectedId.replace("step:", "");
      onChange({
        ...binding,
        source: { kind: "step_output", stepId, field: "" },
      });
    } else if (selectedId === "req_body") {
      onChange({ ...binding, source: { kind: "req_body", field: "" } });
    } else if (selectedId === "req_params") {
      onChange({ ...binding, source: { kind: "req_params", field: "" } });
    } else if (selectedId === "req_query") {
      onChange({ ...binding, source: { kind: "req_query", field: "" } });
    } else if (selectedId === "req_headers") {
      onChange({ ...binding, source: { kind: "req_headers", field: "" } });
    } else if (selectedId === "literal") {
      onChange({ ...binding, source: { kind: "literal", value: "" } });
    }
  };

  return (
    <div className="flex gap-1.5 items-center w-full">
      {/* Source selector */}
      <Select value={currentSourceOptionId} onValueChange={handleSourceSelect}>
        <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 w-[140px] shrink-0">
          <SelectValue placeholder="Source..." />
        </SelectTrigger>
        <SelectContent>
          {availableSources.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Path / Value field editor */}
      {source.kind !== "literal" ? (
        <SmartPathInput
          value={source.field ?? ""}
          onChange={(field) => onChange({ ...binding, source: { ...source, field } })}
          suggestedPaths={activeSource?.paths || []}
          sourceKindLabel={activeSource?.label}
          rootVariableName={activeSource?.rootVariableName}
        />
      ) : (
        <Input
          className="h-7 text-xs font-mono bg-background/60 border-border/60 flex-1"
          placeholder="value"
          value={String(source.value ?? "")}
          onChange={(e) =>
            onChange({ ...binding, source: { ...source, value: e.target.value } })
          }
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Single Step Row Component
// ---------------------------------------------------------------------------

interface StepRowProps {
  step: PipelineStepDraft;
  index: number;
  priorSteps: PipelineStepDraft[];
  endpoint?: Endpoint;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  serviceNodeId?: string;
  onChange: (updated: PipelineStepDraft) => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const StepRow = ({
  step,
  index,
  priorSteps,
  endpoint,
  allNodes,
  allEdges,
  serviceNodeId,
  onChange,
  onDelete,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: StepRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const meta = STEP_TYPE_META[step.type] || STEP_TYPE_META.custom_code;

  // Available sources (request body, params, query, headers, prior steps)
  const availableSources = useMemo(
    () => getAvailableSources(endpoint, priorSteps, allNodes),
    [endpoint, priorSteps, allNodes],
  );

  // -------------------------------------------------------------------------
  // Database & Entity introspection for DB Operation steps
  // -------------------------------------------------------------------------
  const dbNodes = useMemo(
    () =>
      allNodes.filter(
        (n) => n.type === "database" || n.type === "redis_instance",
      ),
    [allNodes],
  );

  const allEntityNodes = useMemo(
    () =>
      allNodes.filter(
        (n) =>
          n.type === "entity" ||
          n.type === "redis_schema" ||
          n.type === "redis-cache" ||
          n.type === "db_ref",
      ),
    [allNodes],
  );

  const selectedDbId = step.databaseId || "all";

  const filteredEntityNodes = useMemo(() => {
    if (selectedDbId === "all") return allEntityNodes;
    return allEntityNodes.filter((entity) => {
      if (entity.data?.databaseId === selectedDbId) return true;
      return allEdges.some(
        (e) =>
          (e.source === selectedDbId && e.target === entity.id) ||
          (e.target === selectedDbId && e.source === entity.id),
      );
    });
  }, [allEntityNodes, selectedDbId, allEdges]);

  const selectedTableNode = useMemo(
    () => allEntityNodes.find((n) => n.id === step.tableNodeId),
    [allEntityNodes, step.tableNodeId],
  );

  const availableDbOperations: DbOperationFunction[] = useMemo(() => {
    if (!selectedTableNode) return [];
    return getEntityDbOperations(selectedTableNode, allNodes);
  }, [selectedTableNode, allNodes]);

  const selectedOp = useMemo(() => {
    return availableDbOperations.find(
      (op) =>
        op.name === step.functionRef?.name || op.id === step.operationId,
    );
  }, [availableDbOperations, step.functionRef?.name, step.operationId]);

  // Expected arguments based on selected operation and table columns
  const expectedArgs = useMemo(() => {
    if (!selectedTableNode) return [];
    const columns = selectedTableNode.data?.columns || [];
    const pkCol = columns.find((c) => c.isPrimaryKey) || columns[0];
    const pkName = pkCol?.name || "id";
    const pkType = pkCol?.type || "string";
    const writableCols = columns.filter((c) => !c.isPrimaryKey);

    if (selectedOp) {
      if (selectedOp.kind === "create") {
        return writableCols.map((c) => ({
          name: toVarName(c.name),
          type: c.type || "string",
          required: c.isNotNull,
        }));
      }
      if (selectedOp.kind === "update") {
        return [
          { name: toVarName(pkName), type: pkType, required: true },
          ...writableCols.map((c) => ({
            name: toVarName(c.name),
            type: c.type || "string",
            required: false,
          })),
        ];
      }
      if (selectedOp.kind === "findById" || selectedOp.kind === "delete") {
        return [{ name: toVarName(pkName), type: pkType, required: true }];
      }
      if (selectedOp.params && selectedOp.params.length > 0) {
        return selectedOp.params.map((p) => ({
          name: p.name,
          type: p.type,
          required: p.required,
        }));
      }
    }
    return [];
  }, [selectedTableNode, selectedOp]);

  // -------------------------------------------------------------------------
  // Handlers for Database / Table / Operation selection
  // -------------------------------------------------------------------------
  const handleSelectTable = (tableId: string) => {
    const cleanTableId = tableId === "__none__" ? undefined : tableId;
    const targetNode = allEntityNodes.find((n) => n.id === cleanTableId);
    if (!targetNode) {
      onChange({
        ...step,
        tableNodeId: undefined,
        operationId: undefined,
      });
      return;
    }

    const ops = getEntityDbOperations(targetNode, allNodes);
    const defaultOp = ops[0];
    const tableLabel = targetNode.data?.label || targetNode.data?.tableRef || "table";
    const isRedis =
      targetNode.type === "redis_schema" ||
      targetNode.type === "redis-cache" ||
      targetNode.data?.dbType === "redis";

    const importPath = isRedis
      ? "@workspace/primary-redis-cache"
      : `@workspace/db/helpers/${toTableName(tableLabel)}`;

    onChange({
      ...step,
      tableNodeId: cleanTableId,
      operationId: defaultOp?.id,
      functionRef: defaultOp
        ? {
            name: defaultOp.name,
            importPath: importPath,
            signature: defaultOp.signature,
          }
        : step.functionRef,
      name: defaultOp?.name || step.name,
      outputVariable: defaultOp ? `${toVarName(defaultOp.name)}Result` : step.outputVariable,
    });
  };

  const handleSelectOperation = (opIdentifier: string) => {
    const op = availableDbOperations.find(
      (o) => o.id === opIdentifier || o.name === opIdentifier,
    );
    if (!op || !selectedTableNode) return;

    const tableLabel = selectedTableNode.data?.label || selectedTableNode.data?.tableRef || "table";
    const isRedis =
      selectedTableNode.type === "redis_schema" ||
      selectedTableNode.type === "redis-cache" ||
      selectedTableNode.data?.dbType === "redis";

    const importPath = isRedis
      ? "@workspace/primary-redis-cache"
      : `@workspace/db/helpers/${toTableName(tableLabel)}`;

    onChange({
      ...step,
      operationId: op.id,
      functionRef: {
        name: op.name,
        importPath: importPath,
        signature: op.signature,
      },
      name: op.name,
      outputVariable: `${toVarName(op.name)}Result`,
    });
  };

  // -------------------------------------------------------------------------
  // Auto-map arguments from request body / prior steps
  // -------------------------------------------------------------------------
  const handleAutoMapArguments = () => {
    if (expectedArgs.length === 0) return;
    const reqBodySource = availableSources.find((s) => s.kind === "req_body");
    const reqParamsSource = availableSources.find((s) => s.kind === "req_params");

    const newBindings: StepBinding[] = expectedArgs.map((arg) => {
      // 1. Check path params for ID or key matches
      const matchParam = reqParamsSource?.paths.find(
        (p) => p.path.toLowerCase() === arg.name.toLowerCase(),
      );
      if (matchParam) {
        return {
          argName: arg.name,
          source: { kind: "req_params", field: matchParam.path },
        };
      }

      // 2. Check prior step output fields (e.g. slug from slugify step)
      for (const ps of availableSources.filter((s) => s.kind === "step_output")) {
        const matchStepField = ps.paths.find(
          (p) => p.path.toLowerCase() === arg.name.toLowerCase(),
        );
        if (matchStepField && ps.stepId) {
          return {
            argName: arg.name,
            source: {
              kind: "step_output",
              stepId: ps.stepId,
              field: matchStepField.path,
            },
          };
        }
      }

      // 3. Check request body fields (including nested dot-paths ending with argName)
      const matchBody = reqBodySource?.paths.find(
        (p) =>
          p.path.toLowerCase() === arg.name.toLowerCase() ||
          p.path.toLowerCase().endsWith(`.${arg.name.toLowerCase()}`),
      );
      if (matchBody) {
        return {
          argName: arg.name,
          source: { kind: "req_body", field: matchBody.path },
        };
      }

      // 4. Default fallback: req_body with arg name
      return {
        argName: arg.name,
        source: { kind: "req_body", field: arg.name },
      };
    });

    onChange({
      ...step,
      inputBindings: newBindings,
    });
  };

  const handlePopulateAllExpectedArgs = () => {
    if (expectedArgs.length === 0) return;
    const existingArgNames = new Set(step.inputBindings.map((b) => b.argName));
    const missing = expectedArgs.filter((a) => !existingArgNames.has(a.name));
    const addedBindings: StepBinding[] = missing.map((a) => ({
      argName: a.name,
      source: { kind: "req_body", field: a.name },
    }));
    onChange({
      ...step,
      inputBindings: [...step.inputBindings, ...addedBindings],
    });
  };

  // -------------------------------------------------------------------------
  // General Binding Handlers
  // -------------------------------------------------------------------------
  const updateBinding = useCallback(
    (bi: number, updated: StepBinding) => {
      const bindings = [...step.inputBindings];
      bindings[bi] = updated;
      onChange({ ...step, inputBindings: bindings });
    },
    [step, onChange],
  );

  const addBinding = () => {
    onChange({
      ...step,
      inputBindings: [
        ...step.inputBindings,
        { argName: "", source: { kind: "req_body", field: "" } } as StepBinding,
      ],
    });
  };

  const removeBinding = (bi: number) => {
    onChange({
      ...step,
      inputBindings: step.inputBindings.filter((_, i) => i !== bi),
    });
  };

  const stepId = step.id || `step-${index}`;

  return (
    <Draggable draggableId={stepId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`rounded-lg border transition-all duration-150 ${
            step.enabled === false ? "opacity-50" : ""
          } ${
            snapshot.isDragging
              ? "border-primary shadow-xl shadow-black/25 bg-background z-50 ring-1 ring-primary/40"
              : "border-border/60 bg-card/40 hover:border-border/80"
          }`}
        >
          {/* Header */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer select-none"
            onClick={() => setExpanded((v) => !v)}
          >
            <div
              {...provided.dragHandleProps}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted/40"
              title="Drag to reorder"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={13} className="shrink-0" />
            </div>
            <span className="text-[11px] text-muted-foreground/60 w-3.5 shrink-0 font-mono">
              {index + 1}
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${meta.color}`}
            >
              {meta.icon}
              {meta.label}
            </span>
            <span className="text-xs font-medium text-foreground/90 flex-1 truncate">
              {step.name || "Unnamed step"}
            </span>
            {step.outputVariable && (
              <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[90px]">
                → {step.outputVariable}
              </span>
            )}
            <div
              className="flex items-center gap-0.5 ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              {!isFirst && (
                <button
                  type="button"
                  className="text-muted-foreground/40 hover:text-foreground transition-colors p-1 rounded hover:bg-muted/40"
                  onClick={onMoveUp}
                  title="Move step up"
                >
                  <ArrowUp size={11} />
                </button>
              )}
              {!isLast && (
                <button
                  type="button"
                  className="text-muted-foreground/40 hover:text-foreground transition-colors p-1 rounded hover:bg-muted/40"
                  onClick={onMoveDown}
                  title="Move step down"
                >
                  <ArrowDown size={11} />
                </button>
              )}
              <button
                type="button"
                className="text-destructive/50 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                onClick={onDelete}
                title="Delete step"
              >
                <Trash2 size={11} />
              </button>
            </div>
            {expanded ? (
              <ChevronDown size={12} className="text-muted-foreground/50 shrink-0" />
            ) : (
              <ChevronRight size={12} className="text-muted-foreground/50 shrink-0" />
            )}
          </div>

          {/* Expanded editor */}
          {expanded && (
            <div className="border-t border-border/40 px-3 pt-3 pb-3 flex flex-col gap-3.5">
              {/* Row 1: Name + Type */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">Step name</Label>
                  <Input
                    className="h-7 text-xs bg-background/60 border-border/60"
                    value={step.name}
                    onChange={(e) => onChange({ ...step, name: e.target.value })}
                    placeholder="e.g. createProductStep"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">Type</Label>
                  <Select
                    value={step.type}
                    onValueChange={(v) => onChange({ ...step, type: v as StepType })}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STEP_TYPE_META) as StepType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {STEP_TYPE_META[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* DB OPERATION CONFIGURATION PANEL                              */}
              {/* ------------------------------------------------------------ */}
              {step.type === "db_operation" && (
                <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                    <Database size={13} />
                    <span>Database & Table Operation</span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {/* Database selector */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Database size={10} /> Database
                      </Label>
                      <Select
                        value={selectedDbId}
                        onValueChange={(v) => onChange({ ...step, databaseId: v })}
                      >
                        <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
                          <SelectValue placeholder="Select Database..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">
                            All Databases
                          </SelectItem>
                          {dbNodes.map((db) => {
                            const isRedisInstance = db.type === "redis_instance";
                            return (
                              <SelectItem key={db.id} value={db.id} className="text-xs font-mono">
                                {isRedisInstance ? "🔴" : "🛢"}{" "}
                                {db.data?.label || (isRedisInstance ? "Redis Instance" : "Database")}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Table / Entity selector */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <TableIcon size={10} /> Table / Entity
                      </Label>
                      <Select
                        value={step.tableNodeId || "__none__"}
                        onValueChange={handleSelectTable}
                      >
                        <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
                          <SelectValue placeholder="Select Table..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-xs text-muted-foreground">
                            Select a table...
                          </SelectItem>
                          {filteredEntityNodes.map((t) => {
                            const isRedis =
                              t.type === "redis_schema" ||
                              t.type === "redis-cache" ||
                              t.data?.dbType === "redis";
                            const icon = isRedis ? "🔴" : "📄";
                            const label =
                              t.data?.label ||
                              t.data?.tableRef ||
                              (isRedis ? "Redis Cache" : "Table");
                            return (
                              <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                                {icon} {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Operation / Function selector */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Code2 size={10} /> Operation / Function
                      </Label>
                      <Select
                        value={step.functionRef?.name || step.operationId || "__none__"}
                        onValueChange={handleSelectOperation}
                        disabled={!selectedTableNode || availableDbOperations.length === 0}
                      >
                        <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
                          <SelectValue
                            placeholder={
                              !selectedTableNode
                                ? "Select table first"
                                : availableDbOperations.length === 0
                                ? "No operations"
                                : "Choose operation..."
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-xs text-muted-foreground">
                            Select an operation...
                          </SelectItem>
                          {availableDbOperations.map((op) => (
                            <SelectItem key={op.id} value={op.name} className="text-xs font-mono">
                              <span className="font-semibold text-primary/90">{op.name}</span>
                              <span className="text-[9px] text-muted-foreground ml-1.5 uppercase">
                                ({op.kind})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Expected arguments preview & quick mapping buttons */}
                  {selectedOp && expectedArgs.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-blue-500/15">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span>Expected args:</span>
                          <div className="flex flex-wrap gap-1">
                            {expectedArgs.map((arg) => (
                              <span
                                key={arg.name}
                                className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-background/80 border border-border/50 text-foreground/80"
                                title={`Type: ${arg.type}${arg.required ? " (required)" : ""}`}
                              >
                                {arg.name}
                                <span className="text-muted-foreground/60 text-[8px] ml-0.5">
                                  :{arg.type}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
                            onClick={handleAutoMapArguments}
                            title="Automatically map matching argument names from request body / path params"
                          >
                            <Sparkles size={10} />
                            Auto-map matching fields
                          </button>
                          <button
                            type="button"
                            className="px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground rounded border border-border/50 hover:bg-muted/40 transition-colors"
                            onClick={handlePopulateAllExpectedArgs}
                            title="Add empty binding rows for all expected fields"
                          >
                            + Populate all
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Row 2: Standard Function ref for other step types */}
              {step.type !== "custom_code" && step.type !== "db_operation" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Function name</Label>
                    <Input
                      className="h-7 text-xs font-mono bg-background/60 border-border/60"
                      value={step.functionRef?.name ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...step,
                          functionRef: {
                            ...(step.functionRef ?? { importPath: "" }),
                            name: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. processData"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Import path</Label>
                    <Input
                      className="h-7 text-xs font-mono bg-background/60 border-border/60"
                      value={step.functionRef?.importPath ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...step,
                          functionRef: {
                            ...(step.functionRef ?? { name: "" }),
                            importPath: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. @workspace/transformers"
                    />
                  </div>
                </div>
              )}

              {/* Custom code block */}
              {step.type === "custom_code" && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">TypeScript code</Label>
                  <textarea
                    className="text-xs font-mono bg-background/60 border border-border/60 rounded-md p-2 min-h-[80px] resize-y text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    value={step.customCode ?? ""}
                    onChange={(e) => onChange({ ...step, customCode: e.target.value })}
                    placeholder="// raw TypeScript to inline at this step&#10;const result = someValue;"
                  />
                </div>
              )}

              {/* Output variable */}
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Output variable name</Label>
                <Input
                  className="h-7 text-xs font-mono bg-background/60 border-border/60"
                  value={step.outputVariable}
                  onChange={(e) => onChange({ ...step, outputVariable: e.target.value })}
                  placeholder="e.g. createdProduct"
                />
                <p className="text-[9px] text-muted-foreground/60">
                  Referenced by subsequent steps as <span className="font-mono">{step.outputVariable || "…"}.field</span>
                </p>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Input Bindings Section                                        */}
              {/* ------------------------------------------------------------ */}
              {step.type !== "custom_code" && (
                <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Argument Bindings
                      </Label>
                      {step.inputBindings.length > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-muted/60 text-muted-foreground">
                          {step.inputBindings.length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary transition-colors"
                        onClick={addBinding}
                      >
                        <Plus size={10} />
                        Add arg
                      </button>
                    </div>
                  </div>

                  {step.inputBindings.length === 0 && (
                    <div className="rounded border border-dashed border-border/40 p-2.5 text-center bg-muted/10">
                      <p className="text-[10px] text-muted-foreground/60">
                        No arguments bound yet.
                      </p>
                      {expectedArgs.length > 0 ? (
                        <p className="text-[9px] text-primary/70 mt-0.5 cursor-pointer hover:underline" onClick={handleAutoMapArguments}>
                          Click here to auto-map expected fields from Request Body.
                        </p>
                      ) : (
                        <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                          Click "+ Add arg" to bind function parameters.
                        </p>
                      )}
                    </div>
                  )}

                  {step.inputBindings.map((binding, bi) => (
                    <div
                      key={bi}
                      className="grid grid-cols-[1fr_auto_2.2fr_auto] gap-1.5 items-center bg-muted/15 p-1.5 rounded border border-border/40"
                    >
                      {/* Arg name */}
                      <Input
                        className="h-7 text-xs font-mono bg-background/70 border-border/60"
                        value={binding.argName}
                        onChange={(e) =>
                          updateBinding(bi, { ...binding, argName: e.target.value })
                        }
                        placeholder="argName"
                      />
                      {/* Arrow */}
                      <span className="text-[10px] text-muted-foreground/50 px-0.5">←</span>
                      {/* Source & Smart Path Editor */}
                      <BindingSourceEditor
                        binding={binding}
                        availableSources={availableSources}
                        onChange={(updated) => updateBinding(bi, updated)}
                      />
                      {/* Delete */}
                      <button
                        type="button"
                        className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                        onClick={() => removeBinding(bi)}
                        title="Remove argument"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Advanced function settings toggle for DB operation */}
              {step.type === "db_operation" && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors self-start"
                    onClick={() => setShowAdvancedSettings((v) => !v)}
                  >
                    <Settings2 size={10} />
                    <span>{showAdvancedSettings ? "Hide" : "Show"} Advanced Import & Function Overrides</span>
                  </button>

                  {showAdvancedSettings && (
                    <div className="grid grid-cols-2 gap-2 p-2 rounded bg-muted/20 border border-border/40">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[9px] text-muted-foreground">Compiled Function Name</Label>
                        <Input
                          className="h-6 text-[11px] font-mono bg-background/60 border-border/60"
                          value={step.functionRef?.name ?? ""}
                          onChange={(e) =>
                            onChange({
                              ...step,
                              functionRef: {
                                ...(step.functionRef ?? { importPath: "" }),
                                name: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[9px] text-muted-foreground">Compiled Import Path</Label>
                        <Input
                          className="h-6 text-[11px] font-mono bg-background/60 border-border/60"
                          value={step.functionRef?.importPath ?? ""}
                          onChange={(e) =>
                            onChange({
                              ...step,
                              functionRef: {
                                ...(step.functionRef ?? { name: "" }),
                                importPath: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Enabled toggle */}
              <button
                type="button"
                className={`flex items-center gap-1.5 text-[10px] self-end transition-colors ${
                  step.enabled === false
                    ? "text-muted-foreground/50"
                    : "text-primary/70 hover:text-primary"
                }`}
                onClick={() =>
                  onChange({ ...step, enabled: step.enabled === false ? true : false })
                }
              >
                <Check size={11} />
                {step.enabled === false ? "Enable step" : "Disable step"}
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

// ---------------------------------------------------------------------------
// Mandatory Return Response Step Row
// ---------------------------------------------------------------------------

const HTTP_STATUS_OPTIONS = [
  { code: 200, label: "200 OK" },
  { code: 201, label: "201 Created" },
  { code: 204, label: "204 No Content" },
  { code: 400, label: "400 Bad Request" },
  { code: 401, label: "401 Unauthorized" },
  { code: 403, label: "403 Forbidden" },
  { code: 404, label: "404 Not Found" },
  { code: 500, label: "500 Internal Error" },
];

interface ReturnResponseStepRowProps {
  step: PipelineStepDraft;
  priorSteps: PipelineStepDraft[];
  endpoint?: Endpoint;
  allNodes: BackendNode[];
  onChange: (updated: PipelineStepDraft) => void;
}

const ReturnResponseStepRow = ({
  step,
  priorSteps,
  endpoint,
  allNodes,
  onChange,
}: ReturnResponseStepRowProps) => {
  const [expanded, setExpanded] = useState(true);

  // Available sources (request body, params, query, headers, prior steps)
  const availableSources = useMemo(
    () => getAvailableSources(endpoint, priorSteps, allNodes),
    [endpoint, priorSteps, allNodes],
  );

  const statusCode = step.statusCode || (endpoint?.type === "POST" ? 201 : 200);

  const updateBinding = (bi: number, updated: StepBinding) => {
    const bindings = [...step.inputBindings];
    bindings[bi] = updated;
    onChange({ ...step, inputBindings: bindings });
  };

  const addBinding = () => {
    onChange({
      ...step,
      inputBindings: [
        ...step.inputBindings,
        {
          argName: `field_${step.inputBindings.length + 1}`,
          source: { kind: "req_body", field: "" },
        } as StepBinding,
      ],
    });
  };

  const removeBinding = (bi: number) => {
    onChange({
      ...step,
      inputBindings: step.inputBindings.filter((_, i) => i !== bi),
    });
  };

  // Build preview code
  const previewCode = useMemo(() => {
    const bindings = step.inputBindings || [];
    if (bindings.length === 0) {
      return `res.status(${statusCode}).json({ status: ${statusCode}, message: "Success" });`;
    }

    const getExprForBinding = (b: StepBinding): string => {
      const source = b.source as StepSource | undefined;
      if (!source) return "undefined";

      switch (source.kind) {
        case "literal": {
          const v = source.value;
          return typeof v === "string" ? `"${v}"` : String(v);
        }
        case "step_output": {
          const found = availableSources.find(
            (s) => s.id === `step:${source.stepId}`,
          );
          const base = found?.variableName || "stepResult";
          const field = source.field ? source.field.trim() : "";
          return field ? `${base}.${field}` : base;
        }
        case "req_body": {
          const field = source.field ? source.field.trim() : "";
          return field ? `body.${field}` : "body";
        }
        case "req_params": {
          const field = source.field ? source.field.trim() : "";
          return field ? `req.params.${field}` : "req.params";
        }
        case "req_query": {
          const field = source.field ? source.field.trim() : "";
          return field ? `req.query.${field}` : "req.query";
        }
        case "req_headers": {
          const field = source.field ? source.field.trim() : "";
          return field ? `(req.headers["${field}"] as string)` : "req.headers";
        }
        default:
          return "undefined";
      }
    };

    const b = bindings[0];
    if (
      bindings.length === 1 &&
      b &&
      (b.argName === "data" || b.argName === "_spread" || !b.argName)
    ) {
      return `res.status(${statusCode}).json(${getExprForBinding(b)});`;
    }

    const fields = bindings
      .map((b) => `${b.argName}: ${getExprForBinding(b)}`)
      .join(", ");
    return `res.status(${statusCode}).json({ ${fields} });`;
  }, [step.inputBindings, statusCode, availableSources]);

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 shadow-sm transition-all duration-150">
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[11px] text-emerald-400 font-mono w-3.5 shrink-0">
          ↩
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 text-emerald-400 bg-emerald-500/10 border-emerald-500/25">
          <Send size={11} />
          Return Response
        </span>
        <span className="text-xs font-medium text-foreground/90 flex-1 truncate">
          HTTP {statusCode}
        </span>
        <span className="text-[10px] font-mono text-emerald-400/60 truncate max-w-[130px]">
          {previewCode}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-muted-foreground/50 shrink-0 ml-1" />
        ) : (
          <ChevronRight size={12} className="text-muted-foreground/50 shrink-0 ml-1" />
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-emerald-500/20 px-3 pt-3 pb-3 flex flex-col gap-3">
          {/* Status code row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">
                HTTP Status Code
              </Label>
              <Select
                value={String(statusCode)}
                onValueChange={(v) => onChange({ ...step, statusCode: Number(v) })}
              >
                <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_STATUS_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.code}
                      value={String(opt.code)}
                      className="text-xs font-mono"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">
                Description
              </Label>
              <Input
                className="h-7 text-xs bg-background/60 border-border/60"
                value={step.name || "Return Response"}
                onChange={(e) => onChange({ ...step, name: e.target.value })}
                placeholder="e.g. Return Created Product"
              />
            </div>
          </div>

          {/* Response payload bindings */}
          <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Response Payload Source
              </Label>
              <button
                type="button"
                className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                onClick={addBinding}
              >
                <Plus size={10} />
                Add field
              </button>
            </div>

            {step.inputBindings.length === 0 ? (
              <div className="rounded border border-dashed border-border/40 p-2.5 text-center bg-muted/10">
                <p className="text-[10px] text-muted-foreground/60">
                  Default response envelope will be returned.
                </p>
                <p
                  className="text-[9px] text-emerald-400/80 mt-0.5 cursor-pointer hover:underline"
                  onClick={() => {
                    const lastPrior = priorSteps[priorSteps.length - 1];
                    onChange({
                      ...step,
                      inputBindings: lastPrior
                        ? [
                            {
                              argName: "data",
                              source: {
                                kind: "step_output",
                                stepId: lastPrior.id,
                                field: "",
                              },
                            } as StepBinding,
                          ]
                        : [
                            {
                              argName: "data",
                              source: { kind: "req_body", field: "" },
                            } as StepBinding,
                          ],
                    });
                  }}
                >
                  Click here to return the result of the previous step.
                </p>
              </div>
            ) : (
              step.inputBindings.map((binding, bi) => (
                <div
                  key={bi}
                  className="grid grid-cols-[1fr_auto_2.2fr_auto] gap-1.5 items-center bg-muted/15 p-1.5 rounded border border-border/40"
                >
                  {/* Key name */}
                  <Input
                    className="h-7 text-xs font-mono bg-background/70 border-border/60"
                    value={binding.argName}
                    onChange={(e) =>
                      updateBinding(bi, { ...binding, argName: e.target.value })
                    }
                    placeholder="data / fieldName"
                  />
                  {/* Arrow */}
                  <span className="text-[10px] text-muted-foreground/50 px-0.5">←</span>
                  {/* Source & Smart Path */}
                  <BindingSourceEditor
                    binding={binding}
                    availableSources={availableSources}
                    onChange={(updated) => updateBinding(bi, updated)}
                  />
                  {/* Delete button (only if more than 1 binding) */}
                  {step.inputBindings.length > 1 ? (
                    <button
                      type="button"
                      className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                      onClick={() => removeBinding(bi)}
                      title="Remove field"
                    >
                      <Trash2 size={11} />
                    </button>
                  ) : (
                    <div className="w-5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// PipelineStepEditor — Main Component
// ---------------------------------------------------------------------------

export interface PipelineStepEditorProps {
  steps: PipelineStepDraft[];
  onChange: (steps: PipelineStepDraft[]) => void;
  endpoint?: Endpoint;
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
  serviceNodeId?: string;
}

export const PipelineStepEditor = ({
  steps,
  onChange,
  endpoint,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
}: PipelineStepEditorProps) => {
  // Separate draggable executable steps from the mandatory pinned return step
  const executableSteps = useMemo(
    () => steps.filter((s) => s.type !== "return_response"),
    [steps],
  );

  const returnStep = useMemo(() => {
    const found = steps.find((s) => s.type === "return_response");
    if (found) return found;
    const defaultStatusCode = endpoint?.type === "POST" ? 201 : 200;
    const lastPriorStep = executableSteps[executableSteps.length - 1];
    return {
      id: "return-response-step",
      name: "Return Response",
      type: "return_response" as StepType,
      enabled: true,
      statusCode: defaultStatusCode,
      inputBindings: lastPriorStep
        ? [
            {
              argName: "data",
              source: {
                kind: "step_output",
                stepId: lastPriorStep.id,
                field: "",
              },
            } as StepBinding,
          ]
        : [
            {
              argName: "data",
              source: { kind: "req_body", field: "" },
            } as StepBinding,
          ],
      outputVariable: "",
    };
  }, [steps, endpoint, executableSteps]);

  const addStep = (type: StepType) => {
    const id = generateId();
    const newStep: PipelineStepDraft = {
      id,
      name: `${STEP_TYPE_META[type].label} ${executableSteps.length + 1}`,
      type,
      enabled: true,
      inputBindings: [],
      outputVariable: `step${executableSteps.length + 1}Result`,
    };
    onChange([...executableSteps, newStep, returnStep]);
  };

  const updateStep = (index: number, updated: PipelineStepDraft) => {
    const next = [...executableSteps];
    next[index] = updated;
    onChange([...next, returnStep]);
  };

  const deleteStep = (index: number) => {
    const next = executableSteps.filter((_, i) => i !== index);
    onChange([...next, returnStep]);
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= executableSteps.length) return;
    const reordered = Array.from(executableSteps);
    const [moved] = reordered.splice(fromIndex, 1);
    if (!moved) return;
    reordered.splice(toIndex, 0, moved);
    onChange([...reordered, returnStep]);
  };

  const updateReturnStep = (updated: PipelineStepDraft) => {
    onChange([...executableSteps, updated]);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    moveStep(result.source.index, result.destination.index);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Draggable step list */}
      {executableSteps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-4 text-center">
          <p className="text-xs text-muted-foreground/60">
            No pipeline steps configured yet.
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            Add transform or DB operations below to define data flow before returning the response.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="pipeline-steps-droppable">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col gap-2 rounded-lg transition-colors ${
                  snapshot.isDraggingOver ? "bg-accent/15 p-1 -m-1" : ""
                }`}
              >
                {executableSteps.map((step, i) => (
                  <StepRow
                    key={step.id || `step-${i}`}
                    step={step}
                    index={i}
                    priorSteps={executableSteps.slice(0, i)}
                    endpoint={endpoint}
                    allNodes={allNodes}
                    allEdges={allEdges}
                    serviceNodeId={serviceNodeId}
                    onChange={(updated) => updateStep(i, updated)}
                    onDelete={() => deleteStep(i)}
                    isFirst={i === 0}
                    isLast={i === executableSteps.length - 1}
                    onMoveUp={() => moveStep(i, i - 1)}
                    onMoveDown={() => moveStep(i, i + 1)}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Add step buttons */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {ADDABLE_STEP_TYPES.map((type) => {
          const meta = STEP_TYPE_META[type];
          return (
            <button
              key={type}
              type="button"
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border transition-all duration-150 hover:brightness-110 active:scale-95 ${meta.color}`}
              onClick={() => addStep(type)}
            >
              <Plus size={9} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Mandatory Pinned Return Response Step */}
      <div className="pt-2 border-t border-border/40">
        <ReturnResponseStepRow
          step={returnStep}
          priorSteps={executableSteps}
          endpoint={endpoint}
          allNodes={allNodes}
          onChange={updateReturnStep}
        />
      </div>
    </div>
  );
};
