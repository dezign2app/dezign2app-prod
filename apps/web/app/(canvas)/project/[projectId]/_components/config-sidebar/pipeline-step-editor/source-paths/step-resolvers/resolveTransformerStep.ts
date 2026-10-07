import {
  BackendNode,
  TransformerHelperNodeData,
  CustomTypeItem,
  CustomTypeField,
} from "@workspace/canvas/types";
import { toVarName } from "@/lib/compiler/utils";
import { extractNestedPaths, parseRawJsonSafe } from "@/lib/utils/nestedJsonSchema";
import {
  inferReturnSchemaFromCode,
  InferredFieldDraft,
} from "@/lib/utils/inferReturnSchema";
import { AvailablePath, PipelineStepDraft } from "../../types";

interface ReturnSchemaFieldItem {
  name: string;
  type?: string;
  description?: string;
  isArray?: boolean;
  nestedFields?: ReturnSchemaFieldItem[];
}

export function resolveTransformerStepPaths(
  step: PipelineStepDraft,
  allNodes: BackendNode[],
  stepPaths: AvailablePath[],
): void {
  const isTransformStep = step.type === "transform" || Boolean(step.transformerNodeId);
  if (!isTransformStep) return;

  let matchedNode: BackendNode | undefined;

  // 1. Try finding canvas transformer node by transformerNodeId
  if (step.transformerNodeId) {
    matchedNode = allNodes.find((n) => n.id === step.transformerNodeId);
    // If it's a transformer_ref, dereference to master node
    if (matchedNode?.type === "transformer_ref") {
      const refTarget = matchedNode.data?.transformerRef;
      if (typeof refTarget === "string" && refTarget.length > 0) {
        const master = allNodes.find((m) => {
          if (m.type !== "transformer") return false;
          if (m.id === refTarget) return true;
          const mFn = m.data?.functionName;
          if (
            typeof mFn === "string" &&
            (mFn === refTarget || toVarName(mFn) === toVarName(refTarget))
          ) {
            return true;
          }
          const mLabel = m.data?.label;
          if (
            typeof mLabel === "string" &&
            (mLabel === refTarget || toVarName(mLabel) === toVarName(refTarget))
          ) {
            return true;
          }
          return false;
        });
        if (master) matchedNode = master;
      }
    } else if (!matchedNode) {
      // Check if any transformer_ref references this transformerNodeId
      const refNode = allNodes.find(
        (n) =>
          n.type === "transformer_ref" &&
          n.data?.transformerRef === step.transformerNodeId,
      );
      if (refNode) {
        matchedNode = allNodes.find(
          (n) => n.type === "transformer" && n.id === step.transformerNodeId,
        );
      }
    }
  }

  // 2. If not found by transformerNodeId, try by functionRef name or normalized name
  if (
    !matchedNode &&
    typeof step.functionRef?.name === "string" &&
    step.functionRef.name.length > 0
  ) {
    const fnName = step.functionRef.name;
    matchedNode = allNodes.find((n) => {
      if (n.type !== "transformer") return false;
      if (n.id === fnName) return true;
      const nFn = n.data?.functionName;
      if (
        typeof nFn === "string" &&
        (nFn === fnName || toVarName(nFn) === toVarName(fnName))
      ) {
        return true;
      }
      const nLabel = n.data?.label;
      if (
        typeof nLabel === "string" &&
        (nLabel === fnName || toVarName(nLabel) === toVarName(fnName))
      ) {
        return true;
      }
      return false;
    });
  }

  // 3. Check service transformer helpers across service nodes
  let matchedHelper: TransformerHelperNodeData | undefined;
  if (!matchedNode) {
    for (const svc of allNodes.filter((n) => n.type === "service")) {
      const helpers = svc.data?.transformerHelpers;
      if (Array.isArray(helpers)) {
        matchedHelper = helpers.find((h: TransformerHelperNodeData) => {
          if (step.transformerNodeId && h.id === step.transformerNodeId) return true;
          const targetName = step.functionRef?.name;
          if (typeof targetName === "string" && typeof h.name === "string") {
            return h.name === targetName || toVarName(h.name) === toVarName(targetName);
          }
          return false;
        });
        if (matchedHelper) break;
      }
    }
  }

  const transformerPaths: AvailablePath[] = [];

  // 1. Raw JSON mode handling
  if (
    matchedNode?.data?.returnSchemaMode === "raw_json" &&
    matchedNode.data.returnSchemaRawJson
  ) {
    const { parsed, error } = parseRawJsonSafe(matchedNode.data.returnSchemaRawJson);
    if (!error && parsed !== null) {
      const nested = extractNestedPaths(parsed);
      nested.forEach((item) => {
        if (item.path && !transformerPaths.some((p) => p.path === item.path)) {
          transformerPaths.push({ path: item.path, type: item.type });
        }
      });
    }
  }

  // 2. Structured returnSchema parameter handling
  const rawReturnSchema =
    matchedNode?.data?.returnSchema ||
    matchedHelper?.returnSchema ||
    step.functionRef?.returnSchema;

  if (Array.isArray(rawReturnSchema) && rawReturnSchema.length > 0) {
    const addParamPaths = (params: readonly ReturnSchemaFieldItem[], prefix = ""): void => {
      params.forEach((param) => {
        if (!param || !param.name) return;
        const fullPath = prefix ? `${prefix}.${param.name}` : param.name;
        const pType = param.type || (param.isArray ? "array" : "string");

        if (!transformerPaths.some((tp) => tp.path === fullPath)) {
          transformerPaths.push({
            path: fullPath,
            type: pType,
            description: param.description,
          });
        }

        // Nested fields
        if (Array.isArray(param.nestedFields) && param.nestedFields.length > 0) {
          addParamPaths(param.nestedFields, fullPath);
        } else if (pType && allNodes.some((n) => n.type === "types")) {
          // Expand matching custom interface fields from types nodes
          for (const typesNode of allNodes.filter((n) => n.type === "types")) {
            const typesList = typesNode.data?.types;
            if (Array.isArray(typesList)) {
              const matchedType = typesList.find(
                (t: CustomTypeItem) =>
                  t.name === pType ||
                  (typeof t.name === "string" && toVarName(t.name) === toVarName(pType)),
              );
              if (matchedType && Array.isArray(matchedType.fields)) {
                matchedType.fields.forEach((tf: CustomTypeField) => {
                  if (tf.name) {
                    const childPath = `${fullPath}.${tf.name}`;
                    if (!transformerPaths.some((tp) => tp.path === childPath)) {
                      transformerPaths.push({
                        path: childPath,
                        type: tf.type || "string",
                      });
                    }
                  }
                });
              }
            }
          }
        }
      });
    };

    addParamPaths(rawReturnSchema);
  }

  // 3. Reconcile / enrich return schema from code (e.g. nested objects or missing fields)
  const code = matchedNode?.data?.code || matchedHelper?.code;
  const inSchema = matchedNode?.data?.inputSchema || matchedHelper?.inputSchema || [];
  if (code) {
    const isOnlyDummyResult =
      transformerPaths.length === 1 && transformerPaths[0]?.path === "result";
    const inferred = inferReturnSchemaFromCode(code, inSchema);
    if (inferred.length > 0) {
      const inferredIsDummy = inferred.length === 1 && inferred[0]?.name === "result";
      if (!inferredIsDummy || transformerPaths.length === 0) {
        if (isOnlyDummyResult && !inferredIsDummy) {
          transformerPaths.length = 0;
        }
        const addInferred = (items: readonly InferredFieldDraft[], prefix = ""): void => {
          items.forEach((item) => {
            if (!item || !item.name) return;
            const fullPath = prefix ? `${prefix}.${item.name}` : item.name;
            const existingIdx = transformerPaths.findIndex((tp) => tp.path === fullPath);
            if (existingIdx === -1) {
              transformerPaths.push({
                path: fullPath,
                type: item.type || "string",
              });
            } else if (item.type && item.type !== "string") {
              const currentPathItem = transformerPaths[existingIdx];
              if (currentPathItem) {
                currentPathItem.type = item.type;
              }
            }
            if (Array.isArray(item.nestedFields) && item.nestedFields.length > 0) {
              addInferred(item.nestedFields, fullPath);
            }
          });
        };
        addInferred(inferred);
      }
    }
  }

  if (transformerPaths.length > 0) {
    // If transformer returned real fields, remove any dummy 'result' from stepPaths if present
    const hasRealTransformerFields = transformerPaths.some((tp) => tp.path !== "result");
    if (hasRealTransformerFields) {
      const dummyIdx = stepPaths.findIndex((p) => p.path === "result");
      if (dummyIdx !== -1) {
        stepPaths.splice(dummyIdx, 1);
      }
    }

    transformerPaths.forEach((tp) => {
      if (!stepPaths.some((sp) => sp.path === tp.path)) {
        stepPaths.push(tp);
      }
    });
  }
}
