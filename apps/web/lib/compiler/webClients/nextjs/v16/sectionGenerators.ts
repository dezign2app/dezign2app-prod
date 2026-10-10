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

function resolveDisabledAttr(props?: {
  disabled?: boolean;
  disabledMode?: "static" | "state_binding" | "expression";
  disabledBinding?: string;
  disabledInverted?: boolean;
  disabledExpression?: string;
}): string {
  if (!props) return "";
  if (props.disabledMode === "expression" && props.disabledExpression?.trim()) {
    return ` disabled={Boolean(${props.disabledExpression.trim()})}`;
  }
  if (props.disabledMode === "state_binding" && props.disabledBinding?.trim()) {
    const rawBinding = props.disabledBinding.trim();
    const isInverted = Boolean(props.disabledInverted || rawBinding.startsWith("!"));
    const cleanVar = toCamelCase(rawBinding.replace(/^!/, ""));
    return isInverted ? ` disabled={!${cleanVar}}` : ` disabled={Boolean(${cleanVar})}`;
  }
  return props.disabled ? " disabled" : "";
}

function resolveReadOnlyAttr(props?: {
  readOnly?: boolean;
  readOnlyMode?: "static" | "state_binding" | "expression";
  readOnlyBinding?: string;
  readOnlyInverted?: boolean;
  readOnlyExpression?: string;
}): string {
  if (!props) return "";
  if (props.readOnlyMode === "expression" && props.readOnlyExpression?.trim()) {
    return ` readOnly={Boolean(${props.readOnlyExpression.trim()})}`;
  }
  if (props.readOnlyMode === "state_binding" && props.readOnlyBinding?.trim()) {
    const rawBinding = props.readOnlyBinding.trim();
    const isInverted = Boolean(props.readOnlyInverted || rawBinding.startsWith("!"));
    const cleanVar = toCamelCase(rawBinding.replace(/^!/, ""));
    return isInverted ? ` readOnly={!${cleanVar}}` : ` readOnly={Boolean(${cleanVar})}`;
  }
  return props.readOnly ? " readOnly" : "";
}

export function generateSectionComponent(
  section: PageSection,
  sectionCompName: string,
  eventComponents: EventComponentMeta[],
): string {
  const { libraryImports, requiresClient: libRequiresClient } = resolveLibraryImports(section.libraries);
  const hasStates = Array.isArray(section.states) && section.states.length > 0;
  const hasStateObjects = Array.isArray(section.stateObjects) && section.stateObjects.length > 0;
  const renderedStateObjects = (section.stateObjects || []).filter(
    (st) => st.renderConfig?.enabled !== false,
  );
  const hasRenderedStateObjects = renderedStateObjects.length > 0;

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
  const guardStoreNames = (section.stateObjects || []).flatMap((s) => {
    const pm = s.renderConfig?.propMappings;
    return [pm?.readOnlyStoreName, pm?.disabledStoreName].filter((n): n is string => Boolean(n));
  });
  const copyStoreNames = (section.stateObjects || []).flatMap((s) => {
    const cfg = s.renderConfig;
    return cfg?.clickAction === "copy_to_clipboard" && cfg.copySourceMode === "store_var" && cfg.copyStoreName
      ? [cfg.copyStoreName]
      : [];
  });
  const uniqueStoreNames = Array.from(new Set([...actionStoreNames, ...stateStoreNames, ...guardStoreNames, ...copyStoreNames]));

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

  const declaredVars = new Set<string>(
    (section.stateObjects || []).map((st) => toCamelCase(st.name || "state"))
  );
  const guardHookCalls: string[] = [];
  (section.stateObjects || []).forEach((st) => {
    const props = st.renderConfig?.propMappings;
    if (props?.disabledMode === "state_binding" && props.disabledBinding) {
      const cleanVar = toCamelCase(props.disabledBinding.replace(/^!/, ""));
      if (props.disabledStoreName && !declaredVars.has(cleanVar)) {
        declaredVars.add(cleanVar);
        const cleanStore = props.disabledStoreName.replace(/Store$/i, "");
        const hookName = `use${cleanStore.charAt(0).toUpperCase() + cleanStore.slice(1)}Store`;
        guardHookCalls.push(`  const ${cleanVar} = ${hookName}((s) => s.${cleanVar});`);
      }
    }
    if (props?.readOnlyMode === "state_binding" && props.readOnlyBinding) {
      const cleanVar = toCamelCase(props.readOnlyBinding.replace(/^!/, ""));
      if (props.readOnlyStoreName && !declaredVars.has(cleanVar)) {
        declaredVars.add(cleanVar);
        const cleanStore = props.readOnlyStoreName.replace(/Store$/i, "");
        const hookName = `use${cleanStore.charAt(0).toUpperCase() + cleanStore.slice(1)}Store`;
        guardHookCalls.push(`  const ${cleanVar} = ${hookName}((s) => s.${cleanVar});`);
      }
    }
    const cfg = st.renderConfig;
    if (
      cfg?.clickAction === "copy_to_clipboard" &&
      cfg.copySourceMode === "store_var" &&
      cfg.copyStoreVar
    ) {
      const cleanVar = toCamelCase(cfg.copyStoreVar);
      const storeName = cfg.copyStoreName || st.storeName;
      if (storeName && !declaredVars.has(cleanVar)) {
        declaredVars.add(cleanVar);
        const cleanStore = storeName.replace(/Store$/i, "");
        const hookName = `use${cleanStore.charAt(0).toUpperCase() + cleanStore.slice(1)}Store`;
        guardHookCalls.push(`  const ${cleanVar} = ${hookName}((s) => s.${cfg.copyStoreVar});`);
      }
    }
  });

  const declaredSetters = new Set<string>();
  const debouncedStateObjectSetups: string[] = [];

  const stateObjectHookCalls = (section.stateObjects || []).map((st) => {
    const varName = toCamelCase(st.name || "state");
    const cfg = st.renderConfig;
    const props = cfg?.propMappings;
    const isInteractiveInput =
      cfg?.component === "input" &&
      (props?.readOnly === false ||
        props?.readOnlyMode === "state_binding" ||
        props?.readOnlyMode === "expression" ||
        Boolean(props?.debounceUpdate) ||
        props?.onChangeMode === "two_way" ||
        props?.onChangeMode === "action");

    const setterName = props?.targetSetterName || `set${toPascalCase(st.name || "state")}`;
    const clickStoreAction =
      cfg?.clickAction === "dispatch_store_action" && cfg.targetStoreActionName
        ? cfg.targetStoreActionName
        : undefined;

    if (st.storeName) {
      const clean = st.storeName.replace(/Store$/i, "");
      const hookName = `use${clean.charAt(0).toUpperCase() + clean.slice(1)}Store`;
      const lines: string[] = [`  const ${varName} = ${hookName}((s) => s.${st.name});`];

      if (isInteractiveInput && !declaredSetters.has(setterName)) {
        declaredSetters.add(setterName);
        lines.push(`  const ${setterName} = ${hookName}((s) => s.${setterName});`);
      }
      if (clickStoreAction && !declaredSetters.has(clickStoreAction)) {
        declaredSetters.add(clickStoreAction);
        lines.push(`  const ${clickStoreAction} = ${hookName}((s) => s.${clickStoreAction});`);
      }
      return lines.join("\n");
    }

    const tsType = mapStateTypeToTs(st.type || "string");
    const defaultVal = formatStateDefaultValue(st.type || "string", st.defaultValue);
    if (isInteractiveInput && !declaredSetters.has(setterName)) {
      declaredSetters.add(setterName);
      return `  const [${varName}, ${setterName}] = useState<${tsType}>(${defaultVal});`;
    }
    return `  const [${varName}] = useState<${tsType}>(${defaultVal});`;
  });

  // Debounced input buffer setups
  (section.stateObjects || []).forEach((st) => {
    const cfg = st.renderConfig;
    const props = cfg?.propMappings;
    if (
      cfg?.component === "input" &&
      (props?.readOnly === false ||
        props?.readOnlyMode === "state_binding" ||
        props?.readOnlyMode === "expression" ||
        Boolean(props?.debounceUpdate) ||
        props?.onChangeMode === "two_way") &&
      Boolean(props?.debounceUpdate)
    ) {
      const varName = toCamelCase(st.name || "state");
      const bufferName = `${varName}Input`;
      const setBufferName = `set${toPascalCase(varName)}Input`;
      const inType = props?.inputType || (st.type === "number" ? "number" : "text");
      const setterName = props?.targetSetterName || `set${toPascalCase(st.name || "state")}`;
      const debounceMs = props?.debounceMs ?? 300;
      const commitCall = inType === "number"
        ? `${setterName}(Number(${bufferName}) || 0);`
        : `${setterName}(${bufferName});`;

      debouncedStateObjectSetups.push(`  const [${bufferName}, ${setBufferName}] = useState<string>(String(${varName} ?? ""));
  useEffect(() => {
    ${setBufferName}(String(${varName} ?? ""));
  }, [${varName}]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (${bufferName} !== String(${varName} ?? "")) {
        ${commitCall}
      }
    }, ${debounceMs});
    return () => clearTimeout(timer);
  }, [${bufferName}]);`);
    }
  });

  const hasDebouncedStateObject = debouncedStateObjectSetups.length > 0;

  const hasActions = eventComponents.length > 0;
  const isNavOnly =
    hasActions &&
    eventComponents.every((c) => c.eventType === "navigateToPage") &&
    !hasStates &&
    !hasStateObjects &&
    !hasStoreBindings;

  const needsUseState =
    hasStates ||
    hasDebouncedStateObject ||
    (section.stateObjects || []).some((st) => !st.storeName);

  const needsUseEffect = hasDebouncedStateObject;

  const reactImport = needsUseEffect
    ? `import React, { useState, useEffect } from "react";`
    : needsUseState
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

  const debugStateSetup = hasRenderedStateObjects
    ? `  const showDebugState =
    process.env.NEXT_PUBLIC_ENABLE_DEBUG_STATE?.trim().toLowerCase() === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_DEBUG_UI?.trim().toLowerCase() === "true";`
    : "";

  const combinedSetupLines = [
    debugStateSetup,
    stateDeclarations,
    ...stateObjectHookCalls,
    ...guardHookCalls,
    ...debouncedStateObjectSetups,
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

  const neededShadcnImports = new Set<string>();
  let needsToast = false;

  const stateObjectsJsx = hasRenderedStateObjects
    ? `\n        <div className="flex flex-wrap gap-2${hasActions ? " mb-3" : ""}">\n${renderedStateObjects
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
            let copyExpr = `typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})`;
            if (cfg.copySourceMode === "static") {
              const staticVal = cfg.copyStaticValue ?? "";
              copyExpr = JSON.stringify(staticVal);
            } else if (cfg.copySourceMode === "store_var" && cfg.copyStoreVar) {
              const cleanVar = toCamelCase(cfg.copyStoreVar);
              copyExpr = `typeof ${cleanVar} === "object" ? JSON.stringify(${cleanVar}) : String(${cleanVar})`;
            }
            clickAttr = ` onClick={() => { navigator.clipboard?.writeText(${copyExpr}); toast.success("${toastMsg}"); }}`;
          } else if (cfg?.clickAction === "dispatch_store_action" && cfg.targetStoreActionName) {
            clickAttr = ` onClick={() => ${cfg.targetStoreActionName}()}`;
          } else if (cfg?.clickAction === "trigger_event" && cfg.targetActionId) {
            const act = (section.actions || []).find((a) => a.id === cfg.targetActionId);
            const actName = act?.name || "action";
            const actEvent = act?.event || "click";
            const actUrl = ((act as Record<string, unknown>)?.url as string) || "";
            const actMethod = ((act as Record<string, unknown>)?.method as string) || "POST";
            clickAttr = ` onClick={() => onTrigger?.("${actName}", "${actEvent}", "${actUrl}", "${actMethod}")}`;
          } else if (cfg?.clickAction === "navigate" && cfg.targetRoute) {
            clickAttr = ` onClick={() => { window.location.href = "${cfg.targetRoute}"; }}`;
          }

          const props = cfg?.propMappings;

          if (comp === "badge") {
            neededShadcnImports.add('import { Badge } from "@workspace/ui/components/badge";');
            return `          <Badge key="${st.id}" variant="${variant}" className="text-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>{showDebugState && <span className="text-muted-foreground mr-1">${label}: </span>}{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</Badge>`;
          }
          if (comp === "button") {
            neededShadcnImports.add('import { Button } from "@workspace/ui/components/button";');
            const btnSize = props?.buttonSize || "sm";
            const disabledAttr = resolveDisabledAttr(props);
            return `          <Button key="${st.id}" variant="${variant}" size="${btnSize}"${disabledAttr}${clickAttr}>{showDebugState && "${label}: "}{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</Button>`;
          }
          if (comp === "switch") {
            neededShadcnImports.add('import { Switch } from "@workspace/ui/components/switch";');
            const disabledAttr = resolveDisabledAttr(props);
            return `          <div key="${st.id}" className="flex items-center gap-2 text-xs"><Switch checked={Boolean(${varName})}${disabledAttr} />{showDebugState && <span>${label}</span>}</div>`;
          }
          if (comp === "progress") {
            neededShadcnImports.add('import { Progress } from "@workspace/ui/components/progress";');
            const maxVal = props?.max || 100;
            const showPct = props?.showPercent !== false;
            return `          <div key="${st.id}" className="flex flex-col gap-1 min-w-[120px] text-xs"><span>{showDebugState && "${label}"}{showPct ? (showDebugState ? \`: \${String(${varName})}%\` : \`\${String(${varName})}%\`) : ""}</span><Progress value={Number(${varName}) || 0} max={${maxVal}} /></div>`;
          }
          if (comp === "alert") {
            neededShadcnImports.add('import { Alert, AlertDescription } from "@workspace/ui/components/alert";');
            const alertTitle = props?.alertTitle ? `<strong>${props.alertTitle}</strong> ` : "";
            return `          <Alert key="${st.id}" className="py-2 px-3 text-xs"${clickAttr}><AlertDescription>${alertTitle}{showDebugState && <strong>${label}: </strong>}{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</AlertDescription></Alert>`;
          }
          if (comp === "skeleton") {
            neededShadcnImports.add('import { Skeleton } from "@workspace/ui/components/skeleton";');
            const w = props?.skeletonWidth || "w-24";
            const h = props?.skeletonHeight || "h-6";
            return `          <Skeleton key="${st.id}" className="${h} ${w}" />`;
          }
          if (comp === "input") {
            neededShadcnImports.add('import { Input } from "@workspace/ui/components/input";');
            const inType = props?.inputType || (st.type === "number" ? "number" : "text");
            const ph = props?.placeholder ? ` placeholder="${props.placeholder}"` : "";
            const dis = resolveDisabledAttr(props);
            const readOnlyAttr = resolveReadOnlyAttr(props);
            const valExpr = props?.valueBinding ? props.valueBinding : `String(${varName})`;
            const setterName = props?.targetSetterName || `set${toPascalCase(st.name || "state")}`;

            const autoFocusAttr = props?.autoFocus ? " autoFocus" : "";
            const autoCompAttr = props?.autoComplete ? ` autoComplete="${props.autoComplete}"` : "";
            const maxLenAttr = props?.maxLength !== undefined ? ` maxLength={${props.maxLength}}` : "";
            const uxAttrs = `${autoFocusAttr}${autoCompAttr}${maxLenAttr}`;

            const isDynamicReadOnly =
              props?.readOnlyMode === "state_binding" || props?.readOnlyMode === "expression";
            const isInteractive =
              isDynamicReadOnly ||
              props?.readOnly === false ||
              Boolean(props?.debounceUpdate) ||
              props?.onChangeMode === "two_way" ||
              props?.onChangeMode === "action";

            if (!isInteractive || (props?.readOnly === true && !isDynamicReadOnly)) {
              return `          <Input key="${st.id}" type="${inType}" value={${valExpr}}${ph}${readOnlyAttr || " readOnly"}${dis}${uxAttrs} className="h-8 text-xs max-w-xs" />`;
            }

            if (props?.debounceUpdate) {
              const bufferName = `${varName}Input`;
              const setBufferName = `set${toPascalCase(varName)}Input`;
              const commitCall = inType === "number"
                ? `${setterName}(Number(${bufferName}) || 0)`
                : `${setterName}(${bufferName})`;
              let enterAttr = "";
              if (props?.commitOnEnter !== false) {
                enterAttr = ` onKeyDown={(e) => { if (e.key === "Enter") { ${commitCall}; } }}`;
              }
              let blurAttr = "";
              if (props?.commitOnBlur !== false) {
                blurAttr = ` onBlur={() => { if (${bufferName} !== String(${varName} ?? "")) { ${commitCall}; } }}`;
              }
              return `          <Input key="${st.id}" type="${inType}" value={${bufferName}} onChange={(e) => ${setBufferName}(e.target.value)}${ph}${readOnlyAttr}${dis}${uxAttrs}${enterAttr}${blurAttr} className="h-8 text-xs max-w-xs" />`;
            }

            if (props?.onChangeMode === "action" && props?.onChangeActionId) {
              const act = (section.actions || []).find((a) => a.id === props.onChangeActionId);
              const actName = act?.name || "inputChange";
              const actUrl = ((act as Record<string, unknown>)?.url as string) || "";
              const actMethod = ((act as Record<string, unknown>)?.method as string) || "POST";
              return `          <Input key="${st.id}" type="${inType}" value={${valExpr}} onChange={(e) => onTrigger?.("${actName}", "change", "${actUrl}", "${actMethod}", { value: e.target.value })}${ph}${readOnlyAttr}${dis}${uxAttrs} className="h-8 text-xs max-w-xs" />`;
            }

            if (props?.onChangeMode === "custom" && props?.customOnChange) {
              return `          <Input key="${st.id}" type="${inType}" value={${valExpr}} onChange={${props.customOnChange}}${ph}${readOnlyAttr}${dis}${uxAttrs} className="h-8 text-xs max-w-xs" />`;
            }

            const commitExpr = inType === "number"
              ? `${setterName}(Number(e.target.value) || 0)`
              : `${setterName}(e.target.value)`;
            return `          <Input key="${st.id}" type="${inType}" value={${valExpr}} onChange={(e) => ${commitExpr}}${ph}${readOnlyAttr}${dis}${uxAttrs} className="h-8 text-xs max-w-xs" />`;
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
            return `          <div key="${st.id}" className="p-3 rounded-lg border bg-card text-card-foreground shadow-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>{showDebugState && <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">${cardTitle}</div>}${cardDesc}\n            <div className="text-sm font-bold mt-0.5 font-mono">{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</div>\n          </div>`;
          }

          return `          <div key="${st.id}" className="text-xs px-2.5 py-1 rounded bg-secondary/50 border border-border text-foreground font-mono${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>{showDebugState && <span className="text-muted-foreground">${label}: </span>}{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</div>`;
        })
        .join("\n")}\n        </div>`
    : "";

  const extraComponentImports = Array.from(neededShadcnImports).join("\n");
  const toastImport = needsToast ? `import { toast } from "sonner";\n` : "";

  let contentJsx = "";
  if (hasActions && hasRenderedStateObjects) {
    contentJsx = `\n      <CardContent>${stateObjectsJsx}\n        <div className="flex flex-wrap gap-3">\n${eventComponents
      .map((c) => `          <${c.componentName} onTrigger={onTrigger} />`)
      .join("\n")}\n        </div>\n      </CardContent>`;
  } else if (hasRenderedStateObjects) {
    contentJsx = `\n      <CardContent>${stateObjectsJsx}\n      </CardContent>`;
  } else if (hasActions) {
    contentJsx = `\n      <CardContent>\n        <div className="flex flex-wrap gap-3">\n${eventComponents
      .map((c) => `          <${c.componentName} onTrigger={onTrigger} />`)
      .join("\n")}\n        </div>\n      </CardContent>`;
  }

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
