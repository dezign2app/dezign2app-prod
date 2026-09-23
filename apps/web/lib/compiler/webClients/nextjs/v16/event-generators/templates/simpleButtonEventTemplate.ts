function resolveActionLibImports(libraries?: string[]): string {
  if (!libraries || libraries.length === 0) return "";
  const lines: string[] = [];
  for (const lib of libraries) {
    const clean = lib.trim();
    if (!clean) continue;
    const safeId = clean.replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+/, "");
    lines.push(`import * as ${safeId} from "${clean}";`);
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

export function generateSimpleButtonEventTemplate({
  componentName,
  eventName,
  eventType,
  url,
  upperMethod,
  requireAuth = true,
  typeDefs,
  libraries = [],
  storeActionBinding,
}: {
  componentName: string;
  eventName: string;
  eventType: string;
  url: string;
  upperMethod: string;
  requireAuth?: boolean;
  typeDefs: string[];
  libraries?: string[];
  storeActionBinding?: {
    storeNodeId?: string;
    storeName?: string;
    actionId?: string;
    actionName?: string;
    actionType?: string;
    targetFieldId?: string;
    targetFieldName?: string;
    updateSource?: "response" | "response_property" | "payload" | "static" | "direct";
    valuePath?: string;
    customValue?: string;
    parameterMappings?: Record<string, string>;
  };
}): string {
  const libImports = resolveActionLibImports(libraries);
  const rawStoreName = storeActionBinding?.storeName?.replace(/Store$/i, "");
  const storeHookName = rawStoreName
    ? `use${rawStoreName.charAt(0).toUpperCase() + rawStoreName.slice(1)}Store`
    : "";
  const storeActionName =
    storeActionBinding?.actionName ||
    (storeActionBinding?.targetFieldName
      ? `set${storeActionBinding.targetFieldName.charAt(0).toUpperCase() + storeActionBinding.targetFieldName.slice(1)}`
      : storeActionBinding?.actionType === "reset"
      ? "reset"
      : storeActionBinding?.actionType === "populate"
      ? "populate"
      : "set");
  const storeImport = storeHookName ? `import { ${storeHookName} } from "@/lib/stores";\n` : "";

  // Helper to emit input mapping for store call
  const generateStoreUpdate = () => {
    if (!storeHookName) return { preTrigger: "", postTrigger: "" };
    const hasApiUrl = Boolean(url && url.trim() && url !== "#");
    const src = !hasApiUrl ? "direct" : (storeActionBinding?.updateSource || "response");
    const vPath = storeActionBinding?.valuePath?.trim();
    const cVal = storeActionBinding?.customValue?.trim();

    if (src === "static") {
      let parsed = "undefined";
      if (cVal) {
        try {
          JSON.parse(cVal);
          parsed = cVal;
        } catch {
          parsed = JSON.stringify(cVal);
        }
      }
      return {
        preTrigger: `      ${storeHookName}.getState().${storeActionName}(${parsed});\n`,
        postTrigger: "",
      };
    }
    if (src === "direct") {
      return {
        preTrigger: `      ${storeHookName}.getState().${storeActionName}();\n`,
        postTrigger: "",
      };
    }
    if (src === "response_property" && vPath) {
      const chain = vPath.split(".").filter(Boolean).map((k) => `?.[${JSON.stringify(k)}]`).join("");
      return {
        preTrigger: "",
        postTrigger: `      if (triggerResult) {
        const resData = (triggerResult as any)?.data !== undefined ? (triggerResult as any).data : triggerResult;
        const extracted = resData${chain};
        ${storeHookName}.getState().${storeActionName}(extracted);
      }\n`,
      };
    }
    // Default response:
    return {
      preTrigger: "",
      postTrigger: `      if (triggerResult) {
        const resData = (triggerResult as any)?.data !== undefined ? (triggerResult as any).data : triggerResult;
        ${storeHookName}.getState().${storeActionName}(resData);
      }\n`,
    };
  };

  const storeSnippet = generateStoreUpdate();

  return `"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
${storeImport}${libImports}
${typeDefs.join("\n\n")}

export function ${componentName}({ onTrigger }: ${componentName}Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
${storeSnippet.preTrigger}      const triggerResult = await onTrigger?.(
        "${eventName}",
        "${eventType}",
        "${url}",
        "${upperMethod}",
        ${Boolean(requireAuth)},
      );
${storeSnippet.postTrigger}    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isSubmitting}
      className="cursor-pointer font-medium shadow-sm"
    >
      {isSubmitting ? "Executing..." : "${eventName}"}
    </Button>
  );
}

export default ${componentName};
`;
}
