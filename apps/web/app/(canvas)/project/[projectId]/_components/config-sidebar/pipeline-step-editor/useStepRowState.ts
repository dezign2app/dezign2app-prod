"use client";

import { useMemo, useCallback } from "react";
import { Endpoint, BackendNode, BackendEdge, AnyMessagingResource } from "@workspace/canvas/types";
import {
  PipelineStepDraft,
  StepBinding,
  ExpectedArg,
} from "./types";
import {
  STEP_TYPE_META,
  getAvailableSources,
  getAvailableTransformers,
  isPathMatch,
} from "./utils";
import { toVarName } from "@/lib/compiler/utils";
import { isStepInputUnconfigured } from "@/lib/utils/pipelineValidation";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";

export interface UseStepRowStateProps {
  step: PipelineStepDraft;
  index: number;
  priorSteps: PipelineStepDraft[];
  endpoint?: Endpoint;
  consumedEvent?: AnyMessagingResource;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  serviceNodeId?: string;
  onChange: (updated: PipelineStepDraft) => void;
}

export function useStepRowState({
  step,
  index,
  priorSteps,
  endpoint,
  consumedEvent,
  allNodes,
  allEdges,
  serviceNodeId,
  onChange,
}: UseStepRowStateProps) {
  const meta = STEP_TYPE_META[step.type] || STEP_TYPE_META.custom_code;

  // Available sources (request body, params, query, headers, prior steps, or event payload/metadata)
  const availableSources = useMemo(
    () => getAvailableSources(endpoint, priorSteps, allNodes, consumedEvent),
    [endpoint, priorSteps, allNodes, consumedEvent],
  );

  // Available transformers
  const availableTransformers = useMemo(
    () => getAvailableTransformers(allNodes, serviceNodeId, allEdges),
    [allNodes, serviceNodeId, allEdges],
  );

  const selectedTransformer = useMemo(() => {
    if (step.type !== "transform") return undefined;
    return availableTransformers.find(
      (t) =>
        t.name === step.functionRef?.name ||
        t.id === step.functionRef?.name,
    );
  }, [step.type, step.functionRef?.name, availableTransformers]);

  // DB nodes & entities
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
  const selectedTableNode = useMemo(
    () => allEntityNodes.find((n) => n.id === step.tableNodeId),
    [allEntityNodes, step.tableNodeId],
  );

  // Expected arguments (for DB Operation, Redis, Transform, Kafka, Service Call)
  const expectedArgs = useMemo((): ExpectedArg[] => {
    if (step.type === "transform" && selectedTransformer) {
      return selectedTransformer.inputSchema.map((f) => ({
        name: f.name,
        type: f.type || "string",
        required: f.required !== false,
      }));
    }

    if (step.type === "db_operation" && selectedTableNode) {
      const columns = selectedTableNode.data?.columns || [];
      const pkCol = columns.find((c) => c.isPrimaryKey) || columns[0];
      const pkName = pkCol?.name || "id";
      const pkType = pkCol?.type || "string";
      const writableCols = columns.filter((c) => !c.isPrimaryKey);

      const opName = (step.functionRef?.name || step.operationId || "").toLowerCase();
      if (opName.includes("create") || opName.includes("insert")) {
        return writableCols.map((c) => ({
          name: toVarName(c.name),
          type: c.type || "string",
          required: c.isNotNull,
        }));
      }
      if (opName.includes("update")) {
        return [
          { name: toVarName(pkName), type: pkType, required: true },
          ...writableCols.map((c) => ({
            name: toVarName(c.name),
            type: c.type || "string",
            required: false,
          })),
        ];
      }
      if (opName.includes("byid") || opName.includes("findone") || opName.includes("delete")) {
        return [{ name: toVarName(pkName), type: pkType, required: true }];
      }
    }

    if (step.type === "redis_operation") {
      if (selectedTableNode && selectedTableNode.id !== "__direct__") {
        const ops = getEntityDbOperations(selectedTableNode, allNodes);
        const op = ops.find(
          (o) => o.id === step.operationId || o.name === step.functionRef?.name,
        );
        if (op && op.params) {
          return op.params.map((p) => ({
            name: p.name,
            type: p.type || "string",
            required: p.required !== false,
          }));
        }
      }

      // Direct / Standard Redis Commands
      const fn = (step.functionRef?.name || step.operationId || "").toLowerCase();
      if (fn.includes("setex")) {
        return [
          { name: "key", type: "string", required: true },
          { name: "seconds", type: "number", required: true },
          { name: "value", type: "string", required: true },
        ];
      }
      if (fn.includes("hset")) {
        return [
          { name: "key", type: "string", required: true },
          { name: "field", type: "string", required: true },
          { name: "value", type: "string", required: true },
        ];
      }
      if (fn.includes("hget") || fn.includes("hdel")) {
        return [
          { name: "key", type: "string", required: true },
          { name: "field", type: "string", required: true },
        ];
      }
      if (fn.includes("set") || fn.includes("lpush") || fn.includes("rpush")) {
        return [
          { name: "key", type: "string", required: true },
          { name: "value", type: "string", required: true },
        ];
      }
      if (fn.includes("publish")) {
        return [
          { name: "channel", type: "string", required: true },
          { name: "message", type: "string", required: true },
        ];
      }
      if (fn.includes("xadd")) {
        return [
          { name: "stream", type: "string", required: true },
          { name: "fields", type: "object", required: true },
        ];
      }
      if (fn.includes("expire")) {
        return [
          { name: "key", type: "string", required: true },
          { name: "seconds", type: "number", required: true },
        ];
      }
      return [{ name: "key", type: "string", required: true }];
    }

    if (step.type === "kafka_publish") {
      const fnName = step.functionRef?.name || "";
      if (fnName === "publishKafkaEvent") {
        return [
          { name: "topic", type: "string", required: true },
          { name: "payload", type: "object", required: true },
          { name: "key", type: "string", required: false },
        ];
      }
      return [
        { name: "payload", type: "object", required: true },
        { name: "key", type: "string", required: false },
      ];
    }

    if (step.type === "service_call") {
      const targetService = allNodes.find((n) => n.id === step.databaseId);
      const endpoints: Endpoint[] = targetService?.data?.endpoints || [];
      const targetEp = endpoints.find(
        (ep) => ep.id === step.tableNodeId || ep.name === step.tableNodeId,
      );
      if (targetEp) {
        const args: ExpectedArg[] = [];
        if (targetEp.pathParams && targetEp.pathParams.length > 0) {
          targetEp.pathParams.forEach((p) => {
            args.push({ name: p.name, type: p.type || "string", required: true });
          });
        }
        if (targetEp.queryParams && targetEp.queryParams.length > 0) {
          targetEp.queryParams.forEach((q) => {
            args.push({ name: q.name, type: q.type || "string", required: false });
          });
        }
        if (
          targetEp.requestBody &&
          targetEp.requestBody.fields &&
          targetEp.requestBody.fields.length > 0
        ) {
          targetEp.requestBody.fields.forEach((f) => {
            args.push({
              name: f.name,
              type: f.type || "string",
              required: f.required !== false,
            });
          });
        } else if (
          targetEp.type === "POST" ||
          targetEp.type === "PUT" ||
          targetEp.type === "PATCH"
        ) {
          args.push({ name: "body", type: "object", required: true });
        }
        return args;
      }
      return [
        { name: "params", type: "object", required: false },
        { name: "body", type: "object", required: false },
      ];
    }

    return [];
  }, [
    step.type,
    selectedTransformer,
    selectedTableNode,
    step.databaseId,
    step.tableNodeId,
    step.functionRef?.name,
    step.operationId,
    allNodes,
  ]);

  // Auto-map arguments from route params / query / body / prior steps (preserving existing)
  // ONLY maps and adds fields that actually exist in available sources, preventing adding non-existent fields.
  const handleAutoMapArguments = useCallback(() => {
    if (expectedArgs.length === 0) return;
    const reqBodySource = availableSources.find(
      (s) => s.kind === "req_body" || s.id === "event_payload",
    );
    const reqParamsSource = availableSources.find((s) => s.kind === "req_params");
    const reqQuerySource = availableSources.find((s) => s.kind === "req_query");
    const reqHeadersSource = availableSources.find(
      (s) => s.kind === "req_headers" || s.id === "event_metadata",
    );

    const existingBindingMap = new Map<string, StepBinding>();
    step.inputBindings.forEach((b) => {
      if (b.argName) {
        existingBindingMap.set(b.argName.trim().toLowerCase(), b);
      }
    });

    const newBindings: StepBinding[] = [];

    for (const arg of expectedArgs) {
      const normArg = arg.name.trim().toLowerCase();
      const existing = existingBindingMap.get(normArg);

      // 1. If an existing configured binding exists for this arg, preserve it
      if (existing) {
        const src = existing.source;
        const isConfigured =
          src.kind === "literal"
            ? src.value !== undefined && src.value !== ""
            : src.kind === "step_output"
            ? Boolean(src.stepId)
            : Boolean(src.field && src.field.trim() !== "");
        if (isConfigured) {
          newBindings.push(existing);
          continue;
        }
      }

      // 2. Path param match
      const matchParam = reqParamsSource?.paths.find((p) =>
        isPathMatch(p.path, arg.name),
      );
      if (matchParam) {
        newBindings.push({
          argName: arg.name,
          source: { kind: "req_params", field: matchParam.path },
        });
        continue;
      }

      // 3. Query param match
      const matchQuery = reqQuerySource?.paths.find((p) =>
        isPathMatch(p.path, arg.name),
      );
      if (matchQuery) {
        newBindings.push({
          argName: arg.name,
          source: { kind: "req_query", field: matchQuery.path },
        });
        continue;
      }

      // 4. Prior step outputs match
      let stepMatched = false;
      for (const ps of availableSources.filter((s) => s.kind === "step_output")) {
        const matchStepField = ps.paths.find((p) =>
          isPathMatch(p.path, arg.name),
        );
        if (matchStepField && ps.stepId) {
          newBindings.push({
            argName: arg.name,
            source: {
              kind: "step_output",
              stepId: ps.stepId,
              field: matchStepField.path,
            },
          });
          stepMatched = true;
          break;
        }
      }
      if (stepMatched) continue;

      // 5. Request body / Event payload match
      const matchBody = reqBodySource?.paths.find((p) =>
        isPathMatch(p.path, arg.name),
      );
      if (matchBody) {
        newBindings.push({
          argName: arg.name,
          source: { kind: "req_body", field: matchBody.path },
        });
        continue;
      }

      // 6. Header / Event Metadata match
      const matchHeader = reqHeadersSource?.paths.find((p) =>
        isPathMatch(p.path, arg.name),
      );
      if (matchHeader) {
        newBindings.push({
          argName: arg.name,
          source: { kind: "req_headers", field: matchHeader.path },
        });
        continue;
      }

      // 7. If existing was already present in inputBindings (even if unconfigured), preserve it
      if (existing) {
        newBindings.push(existing);
        continue;
      }

      // 8. If no matching field exists in any available source, do NOT add non-existent field
    }

    // Also keep any extra custom bindings that the user manually added
    const expectedArgNames = new Set(
      expectedArgs.map((a) => a.name.trim().toLowerCase()),
    );
    const extraCustomBindings = step.inputBindings.filter(
      (b) => !expectedArgNames.has(b.argName.trim().toLowerCase()),
    );

    onChange({
      ...step,
      inputBindings: [...newBindings, ...extraCustomBindings],
    });
  }, [expectedArgs, availableSources, step, onChange]);

  const updateBinding = useCallback(
    (bi: number, updated: StepBinding) => {
      const bindings = [...step.inputBindings];
      bindings[bi] = updated;
      onChange({ ...step, inputBindings: bindings });
    },
    [step, onChange],
  );

  const addBinding = useCallback(() => {
    const newBinding: StepBinding = {
      argName: "",
      source: { kind: "req_body", field: "" },
    };
    onChange({
      ...step,
      inputBindings: [...step.inputBindings, newBinding],
    });
  }, [step, onChange]);

  const removeBinding = useCallback(
    (bi: number) => {
      onChange({
        ...step,
        inputBindings: step.inputBindings.filter((_, i) => i !== bi),
      });
    },
    [step, onChange],
  );

  const stepId = step.id || `step-${index}`;
  const displayVarName = step.outputVariable || step.name || `step${index + 1}Result`;

  const isUnconfigured = useMemo(
    () => isStepInputUnconfigured(step, allNodes),
    [step, allNodes],
  );

  return {
    meta,
    availableSources,
    availableTransformers,
    selectedTransformer,
    selectedDbId,
    selectedTableNode,
    expectedArgs,
    isUnconfigured,
    stepId,
    displayVarName,
    handleAutoMapArguments,
    updateBinding,
    addBinding,
    removeBinding,
  };
}
