import { PageSection } from "@workspace/canvas/types";
import { EventComponentMeta } from "./eventGenerators";

export interface SectionMeta {
  id: string;
  name: string;
  folderName: string;
  componentName: string;
  renderMode?: "server" | "client";
  actions?: EventComponentMeta[];
}

const CLIENT_ONLY_PACKAGES = new Set([
  "framer-motion",
  "canvas-confetti",
  "@tanstack/react-query",
  "@tanstack/react-table",
  "zustand",
]);

function resolveLibraryImports(libraries?: string[]): {
  libraryImports: string;
  requiresClient: boolean;
} {
  if (!libraries || libraries.length === 0) {
    return { libraryImports: "", requiresClient: false };
  }

  let requiresClient = false;
  const statements: string[] = [];

  for (const lib of libraries) {
    const clean = lib.trim();
    if (!clean) continue;
    if (CLIENT_ONLY_PACKAGES.has(clean)) {
      requiresClient = true;
    }
    const safeIdentifier = clean
      .replace(/^@/, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/^_+/, "");
    statements.push(`import * as ${safeIdentifier} from "${clean}";`);
  }

  return {
    libraryImports: statements.length > 0 ? `${statements.join("\n")}\n` : "",
    requiresClient,
  };
}

export function generateSectionComponent(
  section: PageSection,
  sectionCompName: string,
  eventComponents: EventComponentMeta[],
): string {
  const { libraryImports, requiresClient } = resolveLibraryImports(section.libraries);
  const isClient = section.renderMode === "client" || requiresClient;
  const actionImports = eventComponents
    .map((c) => `import { ${c.componentName} } from "./${c.componentName}";`)
    .join("\n");

  const hasActions = eventComponents.length > 0;
  const isNavOnly =
    hasActions && eventComponents.every((c) => c.eventType === "navigateToPage");

  if (isNavOnly) {
    return `${isClient ? `"use client";\n\n` : ""}import React from "react";
${libraryImports}${actionImports ? `${actionImports}\n` : ""}export interface ${sectionCompName}Props {
  onTrigger?: (
    eventName: string,
    eventType: string,
    url: string,
    method: string,
    requireAuth?: boolean,
    customHeaders?: Record<string, string>,
    queryParams?: Record<string, string>,
    requestBody?: unknown,
  ) => void;
}

export function ${sectionCompName}({ onTrigger }: ${sectionCompName}Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
${eventComponents
  .map((c) => `      <${c.componentName} onTrigger={onTrigger} />`)
  .join("\n")}
    </div>
  );
}

export default ${sectionCompName};
`;
  }

  const descriptionJsx = section.description
    ? `\n        <CardDescription className="text-xs text-muted-foreground">${section.description}</CardDescription>`
    : "";

  const contentJsx = hasActions
    ? `\n      <CardContent>\n        <div className="flex flex-wrap gap-3">\n${eventComponents
        .map((c) => `          <${c.componentName} onTrigger={onTrigger} />`)
        .join("\n")}\n        </div>\n      </CardContent>`
    : "";

  return `${isClient ? `"use client";\n\n` : ""}import React from "react";
import { Card, CardHeader, CardTitle${section.description ? ", CardDescription" : ""}${hasActions ? ", CardContent" : ""} } from "@workspace/ui/components/card";
${libraryImports}${actionImports ? `${actionImports}\n` : ""}export interface ${sectionCompName}Props {
  onTrigger?: (
    eventName: string,
    eventType: string,
    url: string,
    method: string,
    requireAuth?: boolean,
    customHeaders?: Record<string, string>,
    queryParams?: Record<string, string>,
    requestBody?: unknown,
  ) => void;
}

export function ${sectionCompName}({ onTrigger }: ${sectionCompName}Props) {
  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-card-foreground">${section.name || "Section"}</CardTitle>${descriptionJsx}
      </CardHeader>${contentJsx}
    </Card>
  );
}

export default ${sectionCompName};
`;
}
