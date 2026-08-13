import { ConditionPrimitive, SessionClaimConfig } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";
import { ClaimColumnInfo } from "./types";

export function extractEnumValuesFromColDef(colDef?: {
  type?: string;
  enumValues?: string[];
  options?: string[];
}): string[] {
  if (!colDef) return [];
  if (Array.isArray(colDef.enumValues) && colDef.enumValues.length > 0) {
    return colDef.enumValues;
  }
  if (Array.isArray(colDef.options) && colDef.options.length > 0) {
    return colDef.options;
  }

  const typeStr = colDef.type || "";
  const match = typeStr.match(/ENUM\s*\(([^)]+)\)/i);
  if (match && match[1]) {
    return match[1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  return [];
}

export function getClaimColumnInfo(
  claimKey: string,
  authClaims: SessionClaimConfig[] = [],
  allNodes: BackendNode[] = []
): ClaimColumnInfo {
  const entityNodes = allNodes.filter((n) => n.type === "entity");
  const claimConfig = authClaims.find((c) => c.key === claimKey || c.targetValue === claimKey);

  let targetColName = claimConfig?.targetValue || claimKey;
  let targetEntityId = claimConfig?.entityId;

  let targetEntity = targetEntityId
    ? entityNodes.find((n) => n.id === targetEntityId)
    : undefined;

  if (!targetEntity) {
    targetEntity = entityNodes.find((e) =>
      (e.data.columns || []).some(
        (col) => col.name.toLowerCase() === targetColName.toLowerCase()
      )
    );
  }

  const colDef = (targetEntity?.data.columns || []).find(
    (col) =>
      col.name.toLowerCase() === targetColName.toLowerCase() ||
      col.name.toLowerCase() === claimKey.toLowerCase()
  );

  const colTypeUpper = (colDef?.type || "").toUpperCase();
  const extractedEnums = extractEnumValuesFromColDef(colDef as any);

  if (colTypeUpper.startsWith("ENUM") || colTypeUpper.includes("ENUM") || extractedEnums.length > 0) {
    return {
      dataType: "enum",
      enumValues: extractedEnums,
      entityName: targetEntity?.data.label,
      columnName: colDef?.name || targetColName,
    };
  }

  if (
    colTypeUpper === "BOOLEAN" ||
    colTypeUpper === "BOOL" ||
    colTypeUpper.includes("TINYINT(1)")
  ) {
    return {
      dataType: "boolean",
      enumValues: ["true", "false"],
      entityName: targetEntity?.data.label,
      columnName: colDef?.name || targetColName,
    };
  }

  return {
    dataType: colTypeUpper.includes("INT") || colTypeUpper.includes("FLOAT") || colTypeUpper.includes("NUMBER") ? "number" : "string",
    entityName: targetEntity?.data.label,
    columnName: colDef?.name || targetColName,
  };
}

export const getClaimKey = (leaf: ConditionPrimitive): string => {
  if (leaf.type === "auth") return "auth";
  if (leaf.type === "orgRole") return "orgRole";
  if (leaf.type === "subscriptionStatus") return "subscriptionStatus";
  if (leaf.type === "plan") return "planId";
  if (leaf.type === "org") return "org";
  if (leaf.type === "access") return "access";
  if (leaf.type === "customClaim") return leaf.key;
  return (leaf as any).type || "custom";
};

export const getClaimTag = (leaf: ConditionPrimitive): string => {
  const key = getClaimKey(leaf);
  return key.toUpperCase();
};

export const getNormalizedOp = (leaf: ConditionPrimitive): string => {
  if (leaf.type === "auth") return leaf.op;
  if (leaf.type === "orgRole" || leaf.type === "plan") return leaf.op;
  if (leaf.type === "subscriptionStatus") {
    return leaf.op === "statusNotIn" ? "notIn" : "in";
  }
  if (leaf.type === "org") return leaf.op === "notRequired" ? "falsy" : "truthy";
  if (leaf.type === "access") return leaf.op === "notGranted" ? "falsy" : "truthy";
  if (leaf.type === "customClaim") return leaf.op;
  return "in";
};

export const getLeafValues = (leaf: ConditionPrimitive): string[] => {
  if (leaf.type === "orgRole" || leaf.type === "plan") return leaf.values || [];
  if (leaf.type === "subscriptionStatus") return leaf.values || [];
  if (leaf.type === "customClaim") {
    if (leaf.values && Array.isArray(leaf.values)) return leaf.values;
    if (leaf.value !== undefined && leaf.value !== null) return [String(leaf.value)];
  }
  return [];
};

export const getLeafSingleVal = (leaf: ConditionPrimitive): string => {
  if (leaf.type === "customClaim") return String(leaf.value ?? "");
  const vals = getLeafValues(leaf);
  return vals.length > 0 ? vals[0]! : "";
};
