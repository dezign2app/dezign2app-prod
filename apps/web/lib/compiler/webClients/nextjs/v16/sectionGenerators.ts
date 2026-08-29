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

export function generateSectionComponent(
  section: PageSection,
  sectionCompName: string,
  eventComponents: EventComponentMeta[],
): string {
  const isClient = section.renderMode === "client";
  const actionImports = eventComponents
    .map((c) => `import { ${c.componentName} } from "./${c.componentName}";`)
    .join("\n");

  const hasActions = eventComponents.length > 0;
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
${actionImports ? `${actionImports}\n` : ""}export interface ${sectionCompName}Props {
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
