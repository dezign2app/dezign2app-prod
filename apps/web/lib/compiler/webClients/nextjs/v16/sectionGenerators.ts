import { PageSection, ComponentPropMappings } from "@workspace/canvas/types";
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
  const hasComponentBindings = Array.isArray(section.componentBindings) && section.componentBindings.length > 0;

  // Track bound action IDs and names to suppress duplicate default action buttons
  const boundActionIds = new Set<string>();
  const boundActionNames = new Set<string>();
  if (hasComponentBindings) {
    (section.componentBindings || []).forEach((comp) => {
      if (comp.actionId) boundActionIds.add(comp.actionId);
      if (comp.actionName) boundActionNames.add(comp.actionName.trim().toLowerCase());
      if (comp.elements) {
        comp.elements.forEach((el) => {
          if (el.actionId) boundActionIds.add(el.actionId);
          if (el.actionName) boundActionNames.add(el.actionName.trim().toLowerCase());
        });
      }
    });
  }

  const isActionBound = (c: EventComponentMeta) => {
    if (c.eventItem?.scope === "item") return true;
    if (c.eventItem?.id && boundActionIds.has(c.eventItem.id)) return true;
    if (boundActionNames.has(c.eventName.trim().toLowerCase())) return true;
    const baseName = c.componentName.replace(/Action$/i, "").trim().toLowerCase();
    if (boundActionNames.has(baseName)) return true;
    return false;
  };

  const unmappedEventComponents = hasComponentBindings
    ? eventComponents.filter((c) => !isActionBound(c))
    : eventComponents;
  const hasUnmappedActions = unmappedEventComponents.length > 0;

  // Track bound state variable names and IDs to suppress duplicate debug state badges/cards
  const boundStateIds = new Set<string>();
  const boundStateVarNames = new Set<string>();
  if (hasComponentBindings) {
    (section.componentBindings || []).forEach((comp) => {
      if (comp.valueStateId) boundStateIds.add(comp.valueStateId);
      if (comp.valueStateName) boundStateVarNames.add(toCamelCase(comp.valueStateName));
      if (comp.disabledStateName) boundStateVarNames.add(toCamelCase(comp.disabledStateName));
      if (comp.loadingStateName) boundStateVarNames.add(toCamelCase(comp.loadingStateName));
      if (comp.elements) {
        comp.elements.forEach((el) => {
          if (el.valueStateId) boundStateIds.add(el.valueStateId);
          if (el.valueStateName) boundStateVarNames.add(toCamelCase(el.valueStateName));
          if (el.disabledStateName) boundStateVarNames.add(toCamelCase(el.disabledStateName));
          if (el.loadingStateName) boundStateVarNames.add(toCamelCase(el.loadingStateName));
        });
      }
    });
  }

  const isStateBound = (st: { id: string; name: string }) => {
    if (boundStateIds.has(st.id)) return true;
    if (boundStateVarNames.has(toCamelCase(st.name || "state"))) return true;
    return false;
  };

  const unmappedStateObjects = hasComponentBindings
    ? renderedStateObjects.filter((st) => !isStateBound(st))
    : renderedStateObjects;
  const hasUnmappedStateObjects = unmappedStateObjects.length > 0;

  const boundStores = (section.actions || [])
    .flatMap((a) => a.storeActionBindings || (a.storeActionBinding ? [a.storeActionBinding] : []))
    .filter((b): b is NonNullable<typeof b> => Boolean(b && b.storeName));
  const hasStoreBindings = boundStores.length > 0;

  const isClient =
    section.renderMode === "client" ||
    libRequiresClient ||
    hasStates ||
    hasStateObjects ||
    hasStoreBindings ||
    hasComponentBindings;

  // Only import action components that are actually rendered as unmapped fallbacks
  const actionImports = unmappedEventComponents
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
  const labelStoreNames = (section.stateObjects || []).flatMap((s) => {
    const cfg = s.renderConfig;
    return cfg?.labelMode === "store_var" && cfg.labelStoreName
      ? [cfg.labelStoreName]
      : [];
  });

  const findStoreNameForState = (stateName?: string, stateId?: string): string | undefined => {
    if (!stateName && !stateId) return undefined;
    const found = (section.stateObjects || []).find(
      (s) => (stateId && s.id === stateId) || (stateName && s.name === stateName),
    );
    return found?.storeName;
  };

  const componentStoreNames = (section.componentBindings || []).flatMap((comp) => {
    const list: string[] = [];
    const valStore =
      comp.propMappings?.sidebarNavStoreName ||
      comp.valueStoreName ||
      findStoreNameForState(comp.valueStateName, comp.valueStateId);
    if (valStore) list.push(valStore);
    const disStore = comp.disabledStoreName || findStoreNameForState(comp.disabledStateName);
    if (disStore) list.push(disStore);
    const loadStore = comp.loadingStoreName || findStoreNameForState(comp.loadingStateName);
    if (loadStore) list.push(loadStore);

    if (comp.elements) {
      comp.elements.forEach((el) => {
        const elValStore = el.valueStoreName || findStoreNameForState(el.valueStateName, el.valueStateId);
        if (elValStore) list.push(elValStore);
        const elDisStore = el.disabledStoreName || findStoreNameForState(el.disabledStateName);
        if (elDisStore) list.push(elDisStore);
        const elLoadStore = el.loadingStoreName || findStoreNameForState(el.loadingStateName);
        if (elLoadStore) list.push(elLoadStore);
      });
    }
    return list;
  });

  const uniqueStoreNames = Array.from(new Set([
    ...actionStoreNames,
    ...stateStoreNames,
    ...guardStoreNames,
    ...copyStoreNames,
    ...labelStoreNames,
    ...componentStoreNames,
  ]));

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

  const declaredVars = new Set<string>();
  const declaredSetters = new Set<string>();

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
    if (
      cfg?.labelMode === "store_var" &&
      cfg.labelStoreVar
    ) {
      const cleanVar = toCamelCase(cfg.labelStoreVar);
      const storeName = cfg.labelStoreName || st.storeName;
      if (storeName && !declaredVars.has(cleanVar)) {
        declaredVars.add(cleanVar);
        const cleanStore = storeName.replace(/Store$/i, "");
        const hookName = `use${cleanStore.charAt(0).toUpperCase() + cleanStore.slice(1)}Store`;
        guardHookCalls.push(`  const ${cleanVar} = ${hookName}((s) => s.${cfg.labelStoreVar});`);
      }
    }
  });

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

    // Check if this state is used by an interactive component in componentBindings
    const isBoundToInteractiveComponent = (section.componentBindings || []).some((comp) => {
      const matchComp = (comp.valueStateName && toCamelCase(comp.valueStateName) === varName) || comp.valueStateId === st.id;
      if (matchComp && ["input", "switch", "checkbox", "textarea", "select"].includes(comp.componentType || "")) return true;
      return (comp.elements || []).some((el) => {
        const matchEl = (el.valueStateName && toCamelCase(el.valueStateName) === varName) || el.valueStateId === st.id;
        return matchEl && ["input", "switch", "checkbox", "textarea", "select"].includes(el.elementType || "");
      });
    });

    const needsSetter = isInteractiveInput || isBoundToInteractiveComponent;

    if (st.storeName) {
      const clean = st.storeName.replace(/Store$/i, "");
      const hookName = `use${clean.charAt(0).toUpperCase() + clean.slice(1)}Store`;
      const lines: string[] = [];

      if (!declaredVars.has(varName)) {
        declaredVars.add(varName);
        lines.push(`  const ${varName} = ${hookName}((s) => s.${st.name});`);
      }

      if (needsSetter && !declaredSetters.has(setterName)) {
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
    if (!declaredVars.has(varName)) {
      declaredVars.add(varName);
      if (needsSetter && !declaredSetters.has(setterName)) {
        declaredSetters.add(setterName);
        return `  const [${varName}, ${setterName}] = useState<${tsType}>(${defaultVal});`;
      }
      return `  const [${varName}] = useState<${tsType}>(${defaultVal});`;
    }
    return "";
  }).filter(Boolean);

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
    !hasStoreBindings &&
    !hasComponentBindings;

  // Generate useState statements for section.states
  const stateDeclarations = hasStates
    ? (section.states || [])
        .map((st) => {
          const varName = toCamelCase(st.name || "state");
          const setterName = `set${toPascalCase(st.name || "state")}`;
          declaredVars.add(varName);
          declaredSetters.add(setterName);
          const tsType = mapStateTypeToTs(st.type || "string");
          const defaultVal = formatStateDefaultValue(st.type || "string", st.defaultValue);
          return `  const [${varName}, ${setterName}] = useState<${tsType}>(${defaultVal});`;
        })
        .join("\n")
    : "";

  const debugStateSetup = hasUnmappedStateObjects
    ? `  const showDebugState =
    process.env.NEXT_PUBLIC_ENABLE_DEBUG_STATE?.trim().toLowerCase() === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_DEBUG_UI?.trim().toLowerCase() === "true";`
    : "";

  let needsExtraUseState = false;
  const componentHookCalls: string[] = [];

  const processComponentBindingState = (item: {
    valueStateName?: string;
    valueStateId?: string;
    valueStoreName?: string;
    disabledStateName?: string;
    disabledStoreName?: string;
    loadingStateName?: string;
    loadingStoreName?: string;
    type?: string;
  }) => {
    // 1. Value state
    if (item.valueStateName) {
      const cleanVar = toCamelCase(item.valueStateName);
      const setterName = `set${toPascalCase(item.valueStateName)}`;
      const storeName = item.valueStoreName || findStoreNameForState(item.valueStateName, item.valueStateId);
      const isInteractive = ["input", "switch", "checkbox", "textarea", "select"].includes(item.type || "");

      if (storeName) {
        const cleanStore = storeName.replace(/Store$/i, "");
        const hookName = `use${cleanStore.charAt(0).toUpperCase() + cleanStore.slice(1)}Store`;
        if (!declaredVars.has(cleanVar)) {
          declaredVars.add(cleanVar);
          componentHookCalls.push(`  const ${cleanVar} = ${hookName}((s) => s.${item.valueStateName});`);
        }
        if (isInteractive && !declaredSetters.has(setterName)) {
          declaredSetters.add(setterName);
          componentHookCalls.push(`  const ${setterName} = ${hookName}((s) => s.${setterName});`);
        }
      } else {
        if (!declaredVars.has(cleanVar)) {
          declaredVars.add(cleanVar);
          needsExtraUseState = true;
          const defaultVal = item.type === "switch" || item.type === "checkbox" ? "false" : '""';
          const tsType = item.type === "switch" || item.type === "checkbox" ? "boolean" : "string";
          if (isInteractive) {
            declaredSetters.add(setterName);
            componentHookCalls.push(`  const [${cleanVar}, ${setterName}] = useState<${tsType}>(${defaultVal});`);
          } else {
            componentHookCalls.push(`  const [${cleanVar}] = useState<${tsType}>(${defaultVal});`);
          }
        }
      }
    }

    // 2. Disabled state
    if (item.disabledStateName) {
      const cleanVar = toCamelCase(item.disabledStateName);
      const storeName = item.disabledStoreName || findStoreNameForState(item.disabledStateName);
      if (!declaredVars.has(cleanVar)) {
        declaredVars.add(cleanVar);
        if (storeName) {
          const cleanStore = storeName.replace(/Store$/i, "");
          const hookName = `use${cleanStore.charAt(0).toUpperCase() + cleanStore.slice(1)}Store`;
          componentHookCalls.push(`  const ${cleanVar} = ${hookName}((s) => s.${item.disabledStateName});`);
        } else {
          needsExtraUseState = true;
          componentHookCalls.push(`  const [${cleanVar}] = useState<boolean>(false);`);
        }
      }
    }

    // 3. Loading state
    if (item.loadingStateName) {
      const cleanVar = toCamelCase(item.loadingStateName);
      const storeName = item.loadingStoreName || findStoreNameForState(item.loadingStateName);
      if (!declaredVars.has(cleanVar)) {
        declaredVars.add(cleanVar);
        if (storeName) {
          const cleanStore = storeName.replace(/Store$/i, "");
          const hookName = `use${cleanStore.charAt(0).toUpperCase() + cleanStore.slice(1)}Store`;
          componentHookCalls.push(`  const ${cleanVar} = ${hookName}((s) => s.${item.loadingStateName});`);
        } else {
          needsExtraUseState = true;
          componentHookCalls.push(`  const [${cleanVar}] = useState<boolean>(false);`);
        }
      }
    }
  };

  (section.componentBindings || []).forEach((comp) => {
    const valState = comp.propMappings?.sidebarNavBinding || comp.valueStateName;
    const valStore = comp.propMappings?.sidebarNavStoreName || comp.valueStoreName;
    processComponentBindingState({
      valueStateName: valState,
      valueStateId: comp.valueStateId,
      valueStoreName: valStore,
      disabledStateName: comp.disabledStateName,
      disabledStoreName: comp.disabledStoreName,
      loadingStateName: comp.loadingStateName,
      loadingStoreName: comp.loadingStoreName,
      type: comp.componentType,
    });
    if (comp.elements) {
      comp.elements.forEach((el) => {
        processComponentBindingState({
          valueStateName: el.valueStateName,
          valueStateId: el.valueStateId,
          valueStoreName: el.valueStoreName,
          disabledStateName: el.disabledStateName,
          disabledStoreName: el.disabledStoreName,
          loadingStateName: el.loadingStateName,
          loadingStoreName: el.loadingStoreName,
          type: el.elementType,
        });
      });
    }
  });

  const needsUseState =
    hasStates ||
    needsExtraUseState ||
    hasDebouncedStateObject ||
    (section.stateObjects || []).some((st) => !st.storeName);

  const needsUseEffect = hasDebouncedStateObject;

  const reactImport = needsUseEffect
    ? `import React, { useState, useEffect } from "react";`
    : needsUseState
    ? `import React, { useState } from "react";`
    : `import React from "react";`;

  const combinedSetupLines = [
    debugStateSetup,
    stateDeclarations,
    ...stateObjectHookCalls,
    ...guardHookCalls,
    ...componentHookCalls,
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

  const stateObjectsJsx = hasUnmappedStateObjects
    ? `\n        <div className="flex flex-wrap gap-2${hasComponentBindings ? " mt-3" : ""}">\n${unmappedStateObjects
        .map((st) => {
          const varName = toCamelCase(st.name || "state");
          const cfg = st.renderConfig;
          const props = cfg?.propMappings;

          const isStoreLabel = cfg?.labelMode === "store_var" && Boolean(cfg.labelStoreVar);
          const labelVar = isStoreLabel ? toCamelCase(cfg!.labelStoreVar!) : "";
          const staticLabel = cfg?.label || st.name;
          const label = staticLabel;
          const labelInline = isStoreLabel ? `{String(${labelVar})}: ` : `${staticLabel}: `;

          const valExprWithAffix = `typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})`;

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
            const actUrl = act?.url || "";
            const actMethod = act?.method || "POST";
            clickAttr = ` onClick={() => onTrigger?.("${actName}", "${actEvent}", "${actUrl}", "${actMethod}")}`;
          } else if (cfg?.clickAction === "navigate" && cfg.targetRoute) {
            clickAttr = ` onClick={() => { window.location.href = "${cfg.targetRoute}"; }}`;
          }

          const isArrayState =
            st.type === "array" ||
            st.type?.endsWith("[]") ||
            st.type?.includes("[]");
          const itemActions = (section.actions || []).filter(
            (act) => act.scope === "item" && act.itemSourceStateId === st.id,
          );
          const primaryItemAct =
            itemActions[0] ||
            (cfg?.clickAction === "trigger_event" && cfg.targetActionId
              ? (section.actions || []).find(
                  (a) => a.id === cfg.targetActionId && a.scope === "item",
                )
              : undefined);

          if (isArrayState && primaryItemAct) {
            const keyField = primaryItemAct.itemContextFields?.[0] || "id";
            const actName = primaryItemAct.name || "itemClick";
            const actEvent = primaryItemAct.event || "click";
            const actUrl = primaryItemAct.url || "";
            const actMethod = primaryItemAct.method || "POST";
            const itemClickAttr = ` onClick={() => onTrigger?.("${actName}", "${actEvent}", "${actUrl}", "${actMethod}", false, undefined, undefined, { ${keyField}: item?.${keyField} ?? item })}`;

            if (comp === "badge") {
              neededShadcnImports.add('import { Badge } from "@workspace/ui/components/badge";');
              return `          {Array.isArray(${varName}) && (${varName} || []).map((item: any, idx: number) => (
            <Badge key={item?.${keyField} ?? idx} variant="${variant}" className="text-xs cursor-pointer"${itemClickAttr}>
              {showDebugState && <span className="text-muted-foreground mr-1">${labelInline}</span>}
              {typeof item === "object" ? (item?.name || item?.title || item?.label || item?.${keyField} || JSON.stringify(item)) : String(item)}
            </Badge>
          ))}`;
            }
            if (comp === "button") {
              neededShadcnImports.add('import { Button } from "@workspace/ui/components/button";');
              const btnSize = props?.buttonSize || "sm";
              const disabledAttr = resolveDisabledAttr(props);
              return `          {Array.isArray(${varName}) && (${varName} || []).map((item: any, idx: number) => (
            <Button key={item?.${keyField} ?? idx} variant="${variant}" size="${btnSize}"${disabledAttr} className="cursor-pointer"${itemClickAttr}>
              {showDebugState && <>{${isStoreLabel ? `String(${labelVar})` : `"${staticLabel}"`}}: </>}
              {typeof item === "object" ? (item?.name || item?.title || item?.label || item?.${keyField} || JSON.stringify(item)) : String(item)}
            </Button>
          ))}`;
            }
            if (comp === "card") {
              const cardTitle = isStoreLabel ? `{String(${labelVar})}` : (props?.titleBinding || staticLabel);
              return `          {Array.isArray(${varName}) && (${varName} || []).map((item: any, idx: number) => (
            <div key={item?.${keyField} ?? idx} className="p-3 rounded-lg border bg-card text-card-foreground shadow-xs cursor-pointer hover:border-primary/50 transition-colors"${itemClickAttr}>
              {showDebugState && <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">${cardTitle}</div>}
              <div className="text-sm font-bold mt-0.5 font-mono">
                {typeof item === "object" ? (item?.title || item?.name || item?.label || item?.${keyField} || JSON.stringify(item)) : String(item)}
              </div>
            </div>
          ))}`;
            }
            return `          {Array.isArray(${varName}) && (${varName} || []).map((item: any, idx: number) => (
            <div key={item?.${keyField} ?? idx} className="text-xs px-2.5 py-1 rounded bg-secondary/50 border border-border text-foreground font-mono cursor-pointer hover:bg-secondary transition-colors"${itemClickAttr}>
              {showDebugState && <span className="text-muted-foreground">${labelInline}</span>}
              {typeof item === "object" ? (item?.name || item?.title || item?.label || item?.${keyField} || JSON.stringify(item)) : String(item)}
            </div>
          ))}`;
          }

          if (comp === "badge") {
            neededShadcnImports.add('import { Badge } from "@workspace/ui/components/badge";');
            return `          <Badge key="${st.id}" variant="${variant}" className="text-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>{showDebugState && <span className="text-muted-foreground mr-1">${labelInline}</span>}{${valExprWithAffix}}</Badge>`;
          }
          if (comp === "button") {
            neededShadcnImports.add('import { Button } from "@workspace/ui/components/button";');
            const btnSize = props?.buttonSize || "sm";
            const disabledAttr = resolveDisabledAttr(props);
            return `          <Button key="${st.id}" variant="${variant}" size="${btnSize}"${disabledAttr}${clickAttr}>{showDebugState && <>{${isStoreLabel ? `String(${labelVar})` : `"${staticLabel}"`}}: </>}{${valExprWithAffix}}</Button>`;
          }
          if (comp === "switch") {
            neededShadcnImports.add('import { Switch } from "@workspace/ui/components/switch";');
            const disabledAttr = resolveDisabledAttr(props);
            return `          <div key="${st.id}" className="flex items-center gap-2 text-xs"><Switch checked={Boolean(${varName})}${disabledAttr} />{showDebugState && <span>${labelInline}</span>}</div>`;
          }
          if (comp === "progress") {
            neededShadcnImports.add('import { Progress } from "@workspace/ui/components/progress";');
            const maxVal = props?.max || 100;
            const showPct = props?.showPercent !== false;
            const progLabelExpr = isStoreLabel ? `{String(${labelVar})}` : `"${staticLabel}"`;
            return `          <div key="${st.id}" className="flex flex-col gap-1 min-w-[120px] text-xs"><span>{showDebugState && ${progLabelExpr}}{showPct ? (showDebugState ? \`: \${String(${varName})}%\` : \`\${String(${varName})}%\`) : ""}</span><Progress value={Number(${varName}) || 0} max={${maxVal}} /></div>`;
          }
          if (comp === "alert") {
            neededShadcnImports.add('import { Alert, AlertDescription } from "@workspace/ui/components/alert";');
            const alertTitle = props?.alertTitle ? `<strong>${props.alertTitle}</strong> ` : "";
            const alertLabelExpr = isStoreLabel ? `{String(${labelVar})}` : `"${staticLabel}"`;
            return `          <Alert key="${st.id}" className="py-2 px-3 text-xs"${clickAttr}><AlertDescription>${alertTitle}{showDebugState && <strong>{${alertLabelExpr}}: </strong>}{typeof ${varName} === "object" ? JSON.stringify(${varName}) : String(${varName})}</AlertDescription></Alert>`;
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
              const actUrl = act?.url || "";
              const actMethod = act?.method || "POST";
              return `          <Input key="${st.id}" type="${inType}" value={${valExpr}} onChange={(e) => onTrigger?.("${actName}", "change", "${actUrl}", "${actMethod}", false, undefined, undefined, { value: e.target.value })}${ph}${readOnlyAttr}${dis}${uxAttrs} className="h-8 text-xs max-w-xs" />`;
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
            const cardTitle = isStoreLabel ? `{String(${labelVar})}` : (props?.titleBinding || staticLabel);
            const cardDesc = props?.descriptionBinding ? `\n            <div className="text-[10px] text-muted-foreground">${props.descriptionBinding}</div>` : "";
            return `          <div key="${st.id}" className="p-3 rounded-lg border bg-card text-card-foreground shadow-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>{showDebugState && <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">${cardTitle}</div>}${cardDesc}\n            <div className="text-sm font-bold mt-0.5 font-mono">{${valExprWithAffix}}</div>\n          </div>`;
          }

          return `          <div key="${st.id}" className="text-xs px-2.5 py-1 rounded bg-secondary/50 border border-border text-foreground font-mono${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>{showDebugState && <span className="text-muted-foreground">${labelInline}</span>}{${valExprWithAffix}}</div>`;
        })
        .join("\n")}\n        </div>`
    : "";

  const renderComponentItem = (
    item: {
      id: string;
      name: string;
      type: string;
      label?: string;
      placeholder?: string;
      variant?: string;
      valueStateName?: string;
      disabledStateName?: string;
      actionId?: string;
      actionName?: string;
      triggerEvent?: string;
      description?: string;
      propMappings?: ComponentPropMappings;
    },
    isChild: boolean = false,
  ): string => {
    const act = (section.actions || []).find((a) => a.id === item.actionId || a.name === item.actionName);
    const actName = act?.name || item.actionName || "action";
    const actEvent = act?.event || item.triggerEvent || "click";
    const actUrl = act?.url || "";
    const actMethod = act?.method || "POST";
    const hasAction = Boolean(item.actionId || item.actionName);

    const clickAttr = hasAction
      ? ` onClick={() => onTrigger?.("${actName}", "${actEvent}", "${actUrl}", "${actMethod}")}`
      : "";

    const disabledAttr = item.disabledStateName
      ? ` disabled={Boolean(${toCamelCase(item.disabledStateName)})}`
      : "";

    const valVar = item.valueStateName ? toCamelCase(item.valueStateName) : "";
    const setterVar = item.valueStateName ? `set${toPascalCase(item.valueStateName)}` : "";
    const hasSetter = valVar && declaredSetters.has(setterVar);

    const labelText = item.label || item.name;

    if (item.type === "button") {
      neededShadcnImports.add('import { Button } from "@workspace/ui/components/button";');
      return `<Button key="${item.id}" variant="${item.variant || "default"}" size="sm"${disabledAttr}${clickAttr}>${labelText}</Button>`;
    }

    if (item.type === "input") {
      neededShadcnImports.add('import { Input } from "@workspace/ui/components/input";');
      const ph = item.propMappings?.placeholder || item.placeholder || item.label || "Enter text...";
      if (valVar && hasSetter) {
        let changeAttr = ` onChange={(e) => ${setterVar}(e.target.value)}`;
        if (hasAction) {
          changeAttr = ` onChange={(e) => { ${setterVar}(e.target.value); onTrigger?.("${actName}", "change", "${actUrl}", "${actMethod}", false, undefined, undefined, { value: e.target.value }); }}`;
        }
        return `<Input key="${item.id}" placeholder="${ph}" value={String(${valVar} ?? "")}${changeAttr}${disabledAttr} className="h-8 text-xs max-w-xs" />`;
      }
      if (valVar) {
        return `<Input key="${item.id}" placeholder="${ph}" defaultValue={String(${valVar} ?? "")}${disabledAttr} className="h-8 text-xs max-w-xs" />`;
      }
      return `<Input key="${item.id}" placeholder="${ph}"${disabledAttr} className="h-8 text-xs max-w-xs" />`;
    }

    if (item.type === "switch") {
      neededShadcnImports.add('import { Switch } from "@workspace/ui/components/switch";');
      if (valVar && hasSetter) {
        let changeAttr = ` onCheckedChange={(checked) => ${setterVar}(checked)}`;
        if (hasAction) {
          changeAttr = ` onCheckedChange={(checked) => { ${setterVar}(checked); onTrigger?.("${actName}", "change", "${actUrl}", "${actMethod}", false, undefined, undefined, { checked }); }}`;
        }
        return `<div key="${item.id}" className="flex items-center gap-2 text-xs"><Switch checked={Boolean(${valVar})}${changeAttr}${disabledAttr} /><span>${labelText}</span></div>`;
      }
      const checkedExpr = valVar ? `Boolean(${valVar})` : "false";
      return `<div key="${item.id}" className="flex items-center gap-2 text-xs"><Switch checked={${checkedExpr}}${disabledAttr} /><span>${labelText}</span></div>`;
    }

    if (item.type === "checkbox") {
      neededShadcnImports.add('import { Checkbox } from "@workspace/ui/components/checkbox";');
      if (valVar && hasSetter) {
        const changeAttr = ` onCheckedChange={(checked) => ${setterVar}(Boolean(checked))}`;
        return `<div key="${item.id}" className="flex items-center gap-2 text-xs"><Checkbox checked={Boolean(${valVar})}${changeAttr}${disabledAttr} /><span>${labelText}</span></div>`;
      }
      const checkedExpr = valVar ? `Boolean(${valVar})` : "false";
      return `<div key="${item.id}" className="flex items-center gap-2 text-xs"><Checkbox checked={${checkedExpr}}${disabledAttr} /><span>${labelText}</span></div>`;
    }

    if (item.type === "badge") {
      neededShadcnImports.add('import { Badge } from "@workspace/ui/components/badge";');
      if (valVar) {
        const prefix = item.label ? `<span className="text-muted-foreground mr-1">${item.label}:</span>` : "";
        return `<Badge key="${item.id}" variant="${item.variant || "secondary"}" className="text-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>${prefix}{typeof ${valVar} === "object" ? JSON.stringify(${valVar}) : String(${valVar})}</Badge>`;
      }
      return `<Badge key="${item.id}" variant="${item.variant || "secondary"}" className="text-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>${labelText}</Badge>`;
    }

    if (item.type === "card") {
      if (valVar) {
        return `<div key="${item.id}" className="p-3 rounded-lg border bg-card text-card-foreground shadow-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>\n            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">${labelText}</div>\n            <div className="text-sm font-bold mt-0.5 font-mono">{typeof ${valVar} === "object" ? JSON.stringify(${valVar}) : String(${valVar})}</div>\n          </div>`;
      }
      return `<div key="${item.id}" className="p-3 rounded-lg border bg-card text-card-foreground shadow-xs${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>\n            <div className="text-xs font-semibold text-card-foreground">${labelText}</div>\n          </div>`;
    }

    if (item.type === "progress") {
      neededShadcnImports.add('import { Progress } from "@workspace/ui/components/progress";');
      const valExpr = valVar ? `Number(${valVar}) || 0` : "50";
      return `<div key="${item.id}" className="flex flex-col gap-1 min-w-[120px] text-xs"><span>${labelText}</span><Progress value={${valExpr}} /></div>`;
    }

    if (item.type === "alert") {
      neededShadcnImports.add('import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";');
      const desc = valVar ? `{typeof ${valVar} === "object" ? JSON.stringify(${valVar}) : String(${valVar})}` : (item.description || item.name);
      return `<Alert key="${item.id}" className="py-2 px-3 text-xs"${clickAttr}><AlertTitle className="text-xs font-semibold">${labelText}</AlertTitle><AlertDescription className="text-xs">${desc}</AlertDescription></Alert>`;
    }

    if (item.type === "avatar") {
      neededShadcnImports.add('import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";');
      const fallback = labelText.slice(0, 2).toUpperCase();
      return `<Avatar key="${item.id}" className="h-8 w-8"><AvatarFallback>${fallback}</AvatarFallback></Avatar>`;
    }

    if (item.type === "skeleton") {
      neededShadcnImports.add('import { Skeleton } from "@workspace/ui/components/skeleton";');
      return `<Skeleton key="${item.id}" className="h-8 w-24" />`;
    }

    if (item.type === "textarea") {
      neededShadcnImports.add('import { Textarea } from "@workspace/ui/components/textarea";');
      const ph = item.placeholder || item.label || "Enter text...";
      if (valVar && hasSetter) {
        return `<Textarea key="${item.id}" placeholder="${ph}" value={String(${valVar} ?? "")} onChange={(e) => ${setterVar}(e.target.value)}${disabledAttr} className="text-xs max-w-sm" />`;
      }
      return `<Textarea key="${item.id}" placeholder="${ph}"${disabledAttr} className="text-xs max-w-sm" />`;
    }

    if (item.type === "sidebar") {
      neededShadcnImports.add(
        'import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@workspace/ui/components/sidebar";',
      );
      neededShadcnImports.add('import Link from "next/link";');

      const title = item.propMappings?.sidebarTitle || item.label || item.name || "App";
      const collapsible = item.propMappings?.sidebarCollapsible || "offcanvas";
      const variant = item.propMappings?.sidebarVariant || "sidebar";
      const navMode = item.propMappings?.sidebarNavMode || "dynamic";
      const activeNavVar = item.propMappings?.sidebarNavBinding
        ? toCamelCase(item.propMappings.sidebarNavBinding)
        : valVar;

      if (navMode === "dynamic" && activeNavVar) {
        return `<div key="${item.id}" className="w-full max-w-xs border rounded-lg overflow-hidden bg-card text-card-foreground">
            <SidebarProvider>
              <Sidebar collapsible="${collapsible}" variant="${variant}" className="w-full">
                <SidebarHeader className="p-3 border-b text-xs font-bold">${title}</SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px]">Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {(${activeNavVar} || []).map((navItem: any, idx: number) => (
                          <SidebarMenuItem key={navItem?.id || idx}>
                            <SidebarMenuButton asChild tooltip={navItem?.name}>
                              <Link href={navItem?.link || "#"} className="text-xs">
                                <span>{navItem?.name || "Nav"}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>
          </div>`;
      }

      const staticItems =
        item.propMappings?.sidebarStaticItems && item.propMappings.sidebarStaticItems.length > 0
          ? item.propMappings.sidebarStaticItems
          : [
              { id: "nav-1", name: "Dashboard", link: "/dashboard" },
              { id: "nav-2", name: "Settings", link: "/settings" },
            ];

      const staticItemsJsx = staticItems
        .map(
          (sItem) => `                        <SidebarMenuItem key="${sItem.id}">
                          <SidebarMenuButton asChild tooltip="${sItem.name}">
                            <Link href="${sItem.link || "#"}" className="text-xs">
                              <span>${sItem.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>`,
        )
        .join("\n");

      return `<div key="${item.id}" className="w-full max-w-xs border rounded-lg overflow-hidden bg-card text-card-foreground">
            <SidebarProvider>
              <Sidebar collapsible="${collapsible}" variant="${variant}" className="w-full">
                <SidebarHeader className="p-3 border-b text-xs font-bold">${title}</SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px]">Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
${staticItemsJsx}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>
          </div>`;
    }

    // Default fallback
    if (valVar) {
      return `<div key="${item.id}" className="text-xs px-2.5 py-1 rounded bg-secondary/50 border border-border text-foreground font-mono${clickAttr ? " cursor-pointer" : ""}"${clickAttr}><span className="text-muted-foreground mr-1">${labelText}:</span>{typeof ${valVar} === "object" ? JSON.stringify(${valVar}) : String(${valVar})}</div>`;
    }
    return `<div key="${item.id}" className="text-xs px-2.5 py-1 rounded bg-secondary/50 border border-border text-foreground font-mono${clickAttr ? " cursor-pointer" : ""}"${clickAttr}>${labelText}</div>`;
  };

  const componentBindingsJsx = hasComponentBindings
    ? `\n        <div className="flex flex-wrap items-center gap-2.5">\n${(section.componentBindings || [])
        .map((comp) => {
          if (comp.elements && comp.elements.length > 0) {
            const childElementsJsx = comp.elements
              .map((el) => `              ${renderComponentItem({
                id: el.id,
                name: el.name,
                type: el.elementType || "input",
                label: el.label,
                placeholder: el.placeholder,
                variant: el.variant,
                valueStateName: el.valueStateName,
                disabledStateName: el.disabledStateName,
                actionId: el.actionId,
                actionName: el.actionName,
                triggerEvent: el.triggerEvent,
                description: el.description,
                propMappings: el.propMappings,
              }, true)}`)
              .join("\n");

            const descJsx = comp.description
              ? `\n            <div className="text-[10px] text-muted-foreground">${comp.description}</div>`
              : "";

            return `          <div key="${comp.id}" className="flex flex-col gap-2 p-3 rounded-lg border bg-card text-card-foreground shadow-xs">\n            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">${comp.label || comp.name}</div>${descJsx}\n            <div className="flex flex-wrap items-center gap-2">\n${childElementsJsx}\n            </div>\n          </div>`;
          }

          return `          ${renderComponentItem({
            id: comp.id,
            name: comp.name,
            type: comp.componentType || "button",
            label: comp.label,
            variant: comp.variant,
            valueStateName: comp.valueStateName,
            disabledStateName: comp.disabledStateName,
            actionId: comp.actionId,
            actionName: comp.actionName,
            triggerEvent: comp.triggerEvent,
            description: comp.description,
            propMappings: comp.propMappings,
          }, false)}`;
        })
        .join("\n")}\n        </div>`
    : "";

  const extraComponentImports = Array.from(neededShadcnImports).join("\n");
  const toastImport = needsToast ? `import { toast } from "sonner";\n` : "";

  const hasContent = hasUnmappedActions || hasUnmappedStateObjects || hasComponentBindings;
  let contentJsx = "";
  if (hasContent) {
    const actionsPart = hasUnmappedActions
      ? `\n        <div className="flex flex-wrap gap-3${hasComponentBindings || hasUnmappedStateObjects ? " mt-3" : ""}">\n${unmappedEventComponents
          .map((c) => `          <${c.componentName} onTrigger={onTrigger} />`)
          .join("\n")}\n        </div>`
      : "";
    contentJsx = `\n      <CardContent>${componentBindingsJsx}${stateObjectsJsx}${actionsPart}\n      </CardContent>`;
  }

  return `${isClient ? `"use client";\n\n` : ""}${reactImport}
import { Card, CardHeader, CardTitle${section.description ? ", CardDescription" : ""}${hasContent ? ", CardContent" : ""} } from "@workspace/ui/components/card";
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
