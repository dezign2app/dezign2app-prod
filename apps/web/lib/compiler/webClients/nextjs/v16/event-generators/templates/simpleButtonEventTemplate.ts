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
  };
}): string {
  const libImports = resolveActionLibImports(libraries);
  const rawStoreName = storeActionBinding?.storeName?.replace(/Store$/i, "");
  const storeHookName = rawStoreName
    ? `use${rawStoreName.charAt(0).toUpperCase() + rawStoreName.slice(1)}Store`
    : "";
  const storeActionName =
    storeActionBinding?.actionName ||
    (storeActionBinding?.actionType === "reset"
      ? "reset"
      : storeActionBinding?.actionType === "populate"
      ? "populate"
      : "set");
  const storeImport = storeHookName ? `import { ${storeHookName} } from "@/lib/stores";\n` : "";

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
${storeHookName ? `      ${storeHookName}.getState().${storeActionName}();\n` : ""}      await onTrigger?.(
        "${eventName}",
        "${eventType}",
        "${url}",
        "${upperMethod}",
        ${Boolean(requireAuth)},
      );
    } finally {
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
