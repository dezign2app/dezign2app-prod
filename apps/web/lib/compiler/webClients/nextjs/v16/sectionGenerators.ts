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

function mapStateTypeToTs(type: string): string {
  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "unknown[]";
    case "object":
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

function formatStateDefaultValue(type: string, defVal: unknown): string {
  if (defVal !== undefined && defVal !== null) {
    if (typeof defVal === "string") return JSON.stringify(defVal);
    if (typeof defVal === "number" || typeof defVal === "boolean") return String(defVal);
    try {
      return JSON.stringify(defVal);
    } catch {
      // fallback
    }
  }
  switch (type) {
    case "string":
      return '""';
    case "number":
      return "0";
    case "boolean":
      return "false";
    case "array":
      return "[]";
    case "object":
      return "{}";
    default:
      return "null";
  }
}

function toCamelCase(str: string): string {
  const clean = str.trim();
  if (!clean) return "state";
  if (/[\s\-_]/.test(clean)) {
    const words = clean.split(/[\s\-_]+/);
    return words[0]!.toLowerCase() + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  }
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function generateSectionComponent(
  section: PageSection,
  sectionCompName: string,
  eventComponents: EventComponentMeta[],
): string {
  const { libraryImports, requiresClient: libRequiresClient } = resolveLibraryImports(section.libraries);
  const hasStates = Array.isArray(section.states) && section.states.length > 0;
  const hasStateObjects = Array.isArray(section.stateObjects) && section.stateObjects.length > 0;

  const boundStores = (section.actions || [])
    .flatMap((a) => a.storeActionBindings || (a.storeActionBinding ? [a.storeActionBinding] : []))
    .filter((b): b is NonNullable<typeof b> => Boolean(b && b.storeName));
  const hasStoreBindings = boundStores.length > 0;

  const isClient =
    section.renderMode === "client" ||
    libRequiresClient ||
    hasStates ||
    hasStateObjects ||
    hasStoreBindings;

  const actionImports = eventComponents
    .map((c) => `import { ${c.componentName} } from "./${c.componentName}";`)
    .join("\n");

  const actionStoreNames = boundStores.map((b) => b.storeName!);
  const stateStoreNames = (section.stateObjects || [])
    .map((s) => s.storeName)
    .filter((n): n is string => Boolean(n));
  const uniqueStoreNames = Array.from(new Set([...actionStoreNames, ...stateStoreNames]));

  const storeImports = uniqueStoreNames
    .map((sName) => {
      const clean = sName.replace(/Store$/i, "");
      const hookName = `use${clean.charAt(0).toUpperCase() + clean.slice(1)}Store`;
      return `import { ${hookName} } from "@/lib/stores";`;
    })
    .join("\n");

  const actionStoreHookCalls = Array.from(new Set(actionStoreNames)).map((sName) => {
    const clean = sName.replace(/Store$/i, "");
    const hookName = `use${clean.charAt(0).toUpperCase() + clean.slice(1)}Store`;
    return `  const ${toCamelCase(clean)}Store = ${hookName}();`;
  });

  const stateObjectHookCalls = (section.stateObjects || []).map((st) => {
    const varName = toCamelCase(st.name || "state");
    if (st.storeName) {
      const clean = st.storeName.replace(/Store$/i, "");
      const hookName = `use${clean.charAt(0).toUpperCase() + clean.slice(1)}Store`;
      return `  const ${varName} = ${hookName}((s) => s.${st.name});`;
    }
    const tsType = mapStateTypeToTs(st.type || "string");
    const defaultVal = formatStateDefaultValue(st.type || "string", st.defaultValue);
    return `  const [${varName}] = useState<${tsType}>(${defaultVal});`;
  });

  const hasActions = eventComponents.length > 0;
  const isNavOnly =
    hasActions &&
    eventComponents.every((c) => c.eventType === "navigateToPage") &&
    !hasStates &&
    !hasStateObjects &&
    !hasStoreBindings;

  const reactImport = hasStates
    ? `import React, { useState } from "react";`
    : `import React from "react";`;

  // Generate useState statements
  const stateDeclarations = hasStates
    ? (section.states || [])
        .map((st) => {
          const varName = toCamelCase(st.name || "state");
          const setterName = `set${toPascalCase(st.name || "state")}`;
          const tsType = mapStateTypeToTs(st.type || "string");
          const defaultVal = formatStateDefaultValue(st.type || "string", st.defaultValue);
          return `  const [${varName}, ${setterName}] = useState<${tsType}>(${defaultVal});`;
        })
        .join("\n")
    : "";

  const combinedSetupLines = [
    stateDeclarations,
    ...stateObjectHookCalls,
    ...actionStoreHookCalls,
  ].filter(Boolean).join("\n");

  if (isNavOnly) {
    return `${isClient ? `"use client";\n\n` : ""}${reactImport}
${libraryImports}${storeImports ? `${storeImports}\n` : ""}${actionImports ? `${actionImports}\n` : ""}export interface ${sectionCompName}Props {
  onTrigger?: (
    eventName: string,
    eventType: string,
    url: string,
    method: string,
    requireAuth?: boolean,
    customHeaders?: Record<string, string>,
    queryParams?: Record<string, string>,
    requestBody?: Record<string, string | number | boolean | null | undefined>,
  ) => Promise<Record<string, string | number | boolean | null | undefined> | void> | void;
}

export function ${sectionCompName}({ onTrigger }: ${sectionCompName}Props) {
${combinedSetupLines ? `${combinedSetupLines}\n\n` : ""}  return (
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

  const renderedStateObjects = (section.stateObjects || []).filter(
    (st) => st.renderConfig?.enabled !== false,
  );
  const hasRenderedStateObjects = renderedStateObjects.length > 0;

  const neededShadcnImports = new Set<string>();
  let needsToast = false;

  const stateObjectsJsx = hasRenderedStateObjects
    ? `\n        <div className="flex flex-wrap gap-2 mb-3">\n${renderedStateObjects
        .map((st) => {
          const varName = toCamelCase(st.name || "state");
          const cfg = st.renderConfig;
          const label = cfg?.label || st.name;
          const comp = cfg?.component;
          const variant = cfg?.variant || (comp === "badge" ? "secondary" : "default");

          let clickAttr = "";
          if (cfg?.clickAction === "copy_to_clipboard") {
            needsToast = true;
            const toastMsg = cfg.copyToastMessage || `Copied ${st.name} to clipboard!`;
            clickAttr = ` onClick={() => { navigator.clipboard?.writeText(typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})); toast.success("${toastMsg}"); }}`;
          }

          const props = cfg?.propMappings;

          if (comp === "badge") {
            neededShadcnImports.add('import { Badge } from "@workspace/ui/components/badge";');
            return `          <Badge key="${st.id}" variant="${variant}" className="text-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}><span className="text-muted-foreground mr-1">${label}: </span>{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</Badge>`;
          }
          if (comp === "button") {
            neededShadcnImports.add('import { Button } from "@workspace/ui/components/button";');
            const btnSize = props?.buttonSize || "sm";
            const disabledAttr = props?.disabled ? " disabled" : "";
            return `          <Button key="${st.id}" variant="${variant}" size="${btnSize}"${disabledAttr}${clickAttr}>${label}: {typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</Button>`;
          }
          if (comp === "switch") {
            neededShadcnImports.add('import { Switch } from "@workspace/ui/components/switch";');
            const disabledAttr = props?.disabled ? " disabled" : "";
            return `          <div key="${st.id}" className="flex items-center gap-2 text-xs"><Switch checked={Boolean(${varName})}${disabledAttr} /><span>${label}</span></div>`;
          }
          if (comp === "progress") {
            neededShadcnImports.add('import { Progress } from "@workspace/ui/components/progress";');
            const maxVal = props?.max || 100;
            const showPct = props?.showPercent !== false;
            return `          <div key="${st.id}" className="flex flex-col gap-1 min-w-[120px] text-xs"><span>${label}${showPct ? `: {String(${varName})}%` : ""}</span><Progress value={Number(${varName}) || 0} max={${maxVal}} /></div>`;
          }
          if (comp === "alert") {
            neededShadcnImports.add('import { Alert, AlertDescription } from "@workspace/ui/components/alert";');
            const alertTitle = props?.alertTitle ? `<strong>${props.alertTitle}</strong> ` : "";
            return `          <Alert key="${st.id}" className="py-2 px-3 text-xs"${clickAttr}><AlertDescription>${alertTitle}<strong>${label}: </strong>{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</AlertDescription></Alert>`;
          }
          if (comp === "skeleton") {
            neededShadcnImports.add('import { Skeleton } from "@workspace/ui/components/skeleton";');
            const w = props?.skeletonWidth || "w-24";
            const h = props?.skeletonHeight || "h-6";
            return `          <Skeleton key="${st.id}" className="${h} ${w}" />`;
          }
          if (comp === "input") {
            neededShadcnImports.add('import { Input } from "@workspace/ui/components/input";');
            const inType = props?.inputType || "text";
            const ph = props?.placeholder ? ` placeholder="${props.placeholder}"` : "";
            const ro = props?.readOnly !== false ? " readOnly" : "";
            const dis = props?.disabled ? " disabled" : "";
            const valExpr = props?.valueBinding ? props.valueBinding : `String(${varName})`;
            return `          <Input key="${st.id}" type="${inType}" value={${valExpr}}${ph}${ro}${dis} className="h-8 text-xs max-w-xs" />`;
          }
          if (comp === "avatar") {
            const fallbackText = props?.avatarFallback || (label ? label.slice(0, 2).toUpperCase() : "AV");
            if (props?.avatarSrc) {
              neededShadcnImports.add('import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";');
              return `          <Avatar key="${st.id}" className="h-8 w-8"><AvatarImage src="${props.avatarSrc}" alt="${label}" /><AvatarFallback>${fallbackText}</AvatarFallback></Avatar>`;
            }
            neededShadcnImports.add('import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";');
            return `          <Avatar key="${st.id}" className="h-8 w-8"><AvatarFallback>${fallbackText}</AvatarFallback></Avatar>`;
          }
          if (comp === "card") {
            const cardTitle = props?.titleBinding || label;
            const cardDesc = props?.descriptionBinding ? `\n            <div className="text-[10px] text-muted-foreground">${props.descriptionBinding}</div>` : "";
            return `          <div key="${st.id}" className="p-3 rounded-lg border bg-card text-card-foreground shadow-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}><div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">${cardTitle}</div>${cardDesc}\n            <div className="text-sm font-bold mt-0.5 font-mono">{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</div>\n          </div>`;
          }

          return `          <div key="${st.id}" className="text-xs px-2.5 py-1 rounded bg-secondary/50 border border-border text-foreground font-mono${clickAttr ? " cursor-pointer" : ""}"${clickAttr}><span className="text-muted-foreground">${label}: </span>{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</div>`;
        })
        .join("\n")}\n        </div>`
    : "";

  const extraComponentImports = Array.from(neededShadcnImports).join("\n");
  const toastImport = needsToast ? `import { toast } from "sonner";\n` : "";

  const contentJsx = (hasActions || hasRenderedStateObjects)
    ? `\n      <CardContent>${stateObjectsJsx}${hasActions ? `\n        <div className="flex flex-wrap gap-3">\n${eventComponents
        .map((c) => `          <${c.componentName} onTrigger={onTrigger} />`)
        .join("\n")}\n        </div>` : ""}\n      </CardContent>`
    : "";

  return `${isClient ? `"use client";\n\n` : ""}${reactImport}
import { Card, CardHeader, CardTitle${section.description ? ", CardDescription" : ""}${hasActions || hasRenderedStateObjects ? ", CardContent" : ""} } from "@workspace/ui/components/card";
${extraComponentImports ? `${extraComponentImports}\n` : ""}${toastImport}${libraryImports}${storeImports ? `${storeImports}\n` : ""}${actionImports ? `${actionImports}\n` : ""}export interface ${sectionCompName}Props {
  onTrigger?: (
    eventName: string,
    eventType: string,
    url: string,
    method: string,
    requireAuth?: boolean,
    customHeaders?: Record<string, string>,
    queryParams?: Record<string, string>,
    requestBody?: Record<string, string | number | boolean | null | undefined>,
  ) => Promise<Record<string, string | number | boolean | null | undefined> | void> | void;
}

export function ${sectionCompName}({ onTrigger }: ${sectionCompName}Props) {
${combinedSetupLines ? `${combinedSetupLines}\n\n` : ""}  return (
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
