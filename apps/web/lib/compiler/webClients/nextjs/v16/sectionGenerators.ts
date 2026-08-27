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

  const actionButtonsJsx =
    eventComponents.length === 0
      ? `<p className="text-muted-foreground text-sm italic">No actions configured in this section.</p>`
      : `<div className="flex flex-wrap gap-3">\n${eventComponents
          .map((c) => `          <${c.componentName} onTrigger={onTrigger} />`)
          .join("\n")}\n        </div>`;

  return `${isClient ? `"use client";\n\n` : ""}import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@workspace/ui/components/card";
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
        <CardTitle className="text-lg font-bold text-card-foreground">${section.name || "Section"}</CardTitle>
        ${
          section.description
            ? `<CardDescription className="text-xs text-muted-foreground">${section.description}</CardDescription>`
            : `<CardDescription className="text-xs text-muted-foreground">Interactive section component</CardDescription>`
        }
      </CardHeader>
      <CardContent>
        ${actionButtonsJsx}
      </CardContent>
    </Card>
  );
}

export default ${sectionCompName};
`;
}
