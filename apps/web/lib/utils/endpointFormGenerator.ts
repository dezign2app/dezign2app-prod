import {
  BackendNode,
  BackendEdge,
  PageSection,
  SectionComponentBinding,
  ComponentElementBinding,
  GlobalStoreField,
  GlobalStoreAction,
  PageStateObject,
  SectionStateVariable,
  UIEventItem,
  ComponentBindingType,
} from "@/types/canvas";
import { Endpoint, Parameter } from "@workspace/canvas";
import { toCamelCase, toPascalCase, toHumanLabel } from "@/lib/utils";
import { generateKeyBetween } from "fractional-indexing";
import { getLastIndex } from "@/lib/stores/backendCanvas/utils";

export interface ExtractedEndpointField {
  id: string;
  name: string;
  source: "body" | "path" | "query";
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
  suggestedComponentType: ComponentBindingType;
  suggestedInputType: "text" | "number" | "email" | "password" | "tel" | "url" | "date";
  label: string;
  placeholder: string;
  enumValues?: string[];
}

/**
 * Extracts and classifies all input parameters (Body fields, Path params, Query params)
 * declared on an endpoint contract.
 */
export function extractEndpointFields(endpoint: Endpoint): ExtractedEndpointField[] {
  const result: ExtractedEndpointField[] = [];
  const seenNames = new Set<string>();

  const inferInputType = (name: string, type: string): "text" | "number" | "email" | "password" | "tel" | "url" | "date" => {
    const lower = name.toLowerCase();
    if (lower.includes("email")) return "email";
    if (lower.includes("password") || lower.includes("secret") || lower.includes("token")) return "password";
    if (lower.includes("phone") || lower.includes("tel") || lower.includes("mobile")) return "tel";
    if (lower.includes("url") || lower.includes("website") || lower.includes("link")) return "url";
    if (lower.includes("date") || lower.includes("birth") || lower.endsWith("at")) return "date";
    if (type === "number" || type === "integer" || type === "float") return "number";
    return "text";
  };

  const inferComponentType = (name: string, type: string, enumValues?: string[]): ComponentBindingType => {
    if (enumValues && enumValues.length > 0) return "select";
    const lower = name.toLowerCase();
    if (
      type === "boolean" ||
      lower.startsWith("is") ||
      lower.startsWith("has") ||
      lower.startsWith("enable") ||
      lower.startsWith("allow") ||
      lower.startsWith("agree")
    ) {
      return "switch";
    }
    return "input";
  };

  // 1. Request Body Fields
  const bodyFields = endpoint.requestBody?.fields || [];
  bodyFields.forEach((f: Parameter) => {
    const rawName = f.name || f.key || "";
    if (!rawName.trim()) return;
    const cleanName = rawName.trim();
    const lower = cleanName.toLowerCase();
    if (seenNames.has(lower)) return;
    seenNames.add(lower);

    const fType = f.type || "string";
    const label = toHumanLabel(cleanName);
    const inputType = inferInputType(cleanName, fType);
    const compType = inferComponentType(cleanName, fType, f.enumValues);

    let placeholder = `Enter ${label.toLowerCase()}...`;
    if (inputType === "email") placeholder = "name@example.com";
    else if (inputType === "password") placeholder = "Enter password...";
    else if (inputType === "number") placeholder = "0";

    result.push({
      id: f.id || `field-${cleanName}`,
      name: cleanName,
      source: "body",
      type: fType,
      required: Boolean(f.required),
      description: f.description,
      defaultValue: f.defaultValue || f.value,
      suggestedComponentType: compType,
      suggestedInputType: inputType,
      label,
      placeholder,
      enumValues: f.enumValues,
    });
  });

  // 1b. Fallback: Parse rawJson if field_builder was empty
  if (result.length === 0 && endpoint.requestBody?.rawJson) {
    try {
      const parsed = JSON.parse(endpoint.requestBody.rawJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([key, val]) => {
          const lower = key.toLowerCase();
          if (seenNames.has(lower)) return;
          seenNames.add(lower);

          const valType =
            typeof val === "number" ? "number" : typeof val === "boolean" ? "boolean" : "string";
          const label = toHumanLabel(key);
          const inputType = inferInputType(key, valType);
          const compType = inferComponentType(key, valType);

          result.push({
            id: `raw-${key}`,
            name: key,
            source: "body",
            type: valType,
            required: true,
            defaultValue: String(val ?? ""),
            suggestedComponentType: compType,
            suggestedInputType: inputType,
            label,
            placeholder: `Enter ${label.toLowerCase()}...`,
          });
        });
      }
    } catch {
      // Ignore invalid JSON in rawJson
    }
  }

  // 2. Path Parameters
  (endpoint.pathParams || []).forEach((p: Parameter) => {
    const rawName = p.name || p.key || "";
    if (!rawName.trim()) return;
    const cleanName = rawName.replace(/^:/, "").trim();
    const lower = cleanName.toLowerCase();
    if (seenNames.has(lower)) return;
    seenNames.add(lower);

    const pType = p.type || "string";
    const label = toHumanLabel(cleanName);
    const inputType = inferInputType(cleanName, pType);

    result.push({
      id: p.id || `path-${cleanName}`,
      name: cleanName,
      source: "path",
      type: pType,
      required: true, // Path params are required in HTTP routes
      description: p.description,
      defaultValue: p.defaultValue,
      suggestedComponentType: "input",
      suggestedInputType: inputType,
      label,
      placeholder: `Enter ${label.toLowerCase()}...`,
    });
  });

  // 3. Query Parameters (exclude internal/external auth queries)
  (endpoint.queryParams || []).forEach((q: Parameter) => {
    const rawName = q.name || q.key || "";
    if (!rawName.trim()) return;
    const cleanName = rawName.trim();
    const lower = cleanName.toLowerCase();
    if (lower === "auth-query-external" || lower === "authorization" || seenNames.has(lower)) {
      return;
    }
    seenNames.add(lower);

    const qType = q.type || "string";
    const label = toHumanLabel(cleanName);
    const inputType = inferInputType(cleanName, qType);
    const compType = inferComponentType(cleanName, qType, q.enumValues);

    result.push({
      id: q.id || `query-${cleanName}`,
      name: cleanName,
      source: "query",
      type: qType,
      required: Boolean(q.required),
      description: q.description,
      defaultValue: q.defaultValue,
      suggestedComponentType: compType,
      suggestedInputType: inputType,
      label,
      placeholder: `Filter by ${label.toLowerCase()}...`,
      enumValues: q.enumValues,
    });
  });

  return result;
}

export interface SelectedEndpointFormField {
  name: string;
  source: "body" | "path" | "query";
  type: string;
  required: boolean;
  componentType: ComponentBindingType;
  inputType?: "text" | "number" | "email" | "password" | "tel" | "url" | "date";
  label: string;
  placeholder?: string;
  stateVarName: string;
}

export interface EndpointFormGeneratorOptions {
  endpoint: Endpoint;
  serviceNode: BackendNode;
  webPageNode: BackendNode;
  sectionId: string;
  formName: string;
  submitButtonLabel: string;
  stateStorageMode?: "store" | "local";
  targetStoreNodeId?: string; // Existing store node ID or "__new__"
  newStoreName?: string;
  selectedFields: SelectedEndpointFormField[];
  existingComponentId?: string;
  nodes: BackendNode[];
  edges: BackendEdge[];
}

export interface EndpointFormGeneratorResult {
  updatedWebPageNode: BackendNode;
  updatedStoreNode?: BackendNode;
  newStoreNode?: BackendNode;
  newEdges: BackendEdge[];
  createdActionId: string;
  createdActionName: string;
  createdComponentBindingId: string;
  summaryMessage: string;
}

/**
 * 1-Click Form & State Store Generator:
 * Generates typed state store variables, creates/wires interactive form UI components,
 * and attaches the submit button to the endpoint action.
 */
export function generateFormFromEndpoint({
  endpoint,
  serviceNode,
  webPageNode,
  sectionId,
  formName,
  submitButtonLabel,
  stateStorageMode = "store",
  targetStoreNodeId,
  newStoreName,
  selectedFields,
  existingComponentId,
  nodes,
  edges,
}: EndpointFormGeneratorOptions): EndpointFormGeneratorResult {
  const newEdges: BackendEdge[] = [];
  let updatedStoreNode: BackendNode | undefined;
  let newStoreNode: BackendNode | undefined;

  let activeStoreName: string | undefined;
  let activeStoreId: string | undefined;

  // 1. Process Zustand State Store if store mode is selected
  if (stateStorageMode === "store") {
    if (targetStoreNodeId && targetStoreNodeId !== "__new__") {
      // Use existing state store
      const storeNode = nodes.find((n) => n.id === targetStoreNodeId);
      if (storeNode) {
        activeStoreId = storeNode.id;
        activeStoreName = storeNode.data?.storeName || storeNode.data?.label || "Store";

        const existingFields: GlobalStoreField[] = [...(storeNode.data?.fields || [])];
        const existingActions: GlobalStoreAction[] = [...(storeNode.data?.actions || [])];
        const fieldMap = new Map(existingFields.map((f) => [f.name.toLowerCase(), f]));

        selectedFields.forEach((field, idx) => {
          const cleanVar = toCamelCase(field.stateVarName);
          const lower = cleanVar.toLowerCase();

          if (!fieldMap.has(lower)) {
            const newFId = `f-${Date.now()}-${idx}-${cleanVar}`;
            const newField: GlobalStoreField = {
              id: newFId,
              name: cleanVar,
              type: field.type === "number" ? "number" : field.type === "boolean" ? "boolean" : "string",
              defaultValue:
                field.type === "number" ? 0 : field.type === "boolean" ? false : "",
              required: field.required,
              description: `Bound to ${field.label}`,
            };
            existingFields.push(newField);
            fieldMap.set(lower, newField);

            // Add default setter action
            const setterName = `set${toPascalCase(cleanVar)}`;
            if (!existingActions.some((a) => a.name.toLowerCase() === setterName.toLowerCase())) {
              existingActions.push({
                id: `act-${Date.now()}-${idx}-set-${cleanVar}`,
                name: setterName,
                targetFieldName: cleanVar,
                targetFieldId: newFId,
                actionType: "set",
                defaultManipulatorType: "setter",
              });
            }
          }
        });

        updatedStoreNode = {
          ...storeNode,
          data: {
            ...storeNode.data,
            fields: existingFields,
            actions: existingActions,
          },
        };

        // Ensure canvas edge exists between state_store and webPage
        const edgeExists = edges.some(
          (e) =>
            (e.source === storeNode.id && e.target === webPageNode.id) ||
            (e.target === storeNode.id && e.source === webPageNode.id),
        );
        if (!edgeExists) {
          newEdges.push({
            id: `edge-store-${storeNode.id}-${webPageNode.id}`,
            source: storeNode.id,
            target: webPageNode.id,
            sourceHandle: "mutate-out",
            targetHandle: "page-in",
            type: "connection",
            fractionalIndex:"a1"
          });
        }
      }
    } else {
      // Create a brand new state_store node
      const rawStoreName = newStoreName?.trim() || `${toPascalCase(formName)}Store`;
      const storeLabel = rawStoreName.endsWith("Store") ? rawStoreName : `${rawStoreName}Store`;
      const cleanStoreName = storeLabel.replace(/Store$/i, "");
      activeStoreName = cleanStoreName;

      const newStoreId = `store-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      activeStoreId = newStoreId;

      const storeFields: GlobalStoreField[] = [];
      const storeActions: GlobalStoreAction[] = [];

      selectedFields.forEach((field, idx) => {
        const cleanVar = toCamelCase(field.stateVarName);
        const fId = `f-${Date.now()}-${idx}-${cleanVar}`;
        storeFields.push({
          id: fId,
          name: cleanVar,
          type: field.type === "number" ? "number" : field.type === "boolean" ? "boolean" : "string",
          defaultValue: field.type === "number" ? 0 : field.type === "boolean" ? false : "",
          required: field.required,
          description: `Bound to ${field.label}`,
        });

        storeActions.push({
          id: `act-${Date.now()}-${idx}-set-${cleanVar}`,
          name: `set${toPascalCase(cleanVar)}`,
          targetFieldName: cleanVar,
          targetFieldId: fId,
          actionType: "set",
          defaultManipulatorType: "setter",
        });
      });

      const pageX = webPageNode.position?.x ?? 0;
      const pageY = webPageNode.position?.y ?? 0;

      newStoreNode = {
        id: newStoreId,
        type: "state_store",
        position: {
          x: Math.max(0, pageX - 340),
          y: pageY,
        },
        data: {
          label: storeLabel,
          storeName: cleanStoreName,
          scope: "global",
          storage: "memory",
          fields: storeFields,
          actions: storeActions,
        },
        fractionalIndex: generateKeyBetween(getLastIndex(nodes), null),
      };

      // Edge from new state_store to webPage
      newEdges.push({
        id: `edge-store-${newStoreId}-${webPageNode.id}`,
        source: newStoreId,
        target: webPageNode.id,
        sourceHandle: "mutate-out",
        targetHandle: "page-in",
        type: "connection",
        fractionalIndex:"a0"
      });
    }
  }

  // 2. Prepare WebPage Section
  const currentSections: PageSection[] = [...(webPageNode.data?.sections || [])];
  let targetSection = currentSections.find((s) => s.id === sectionId);

  if (!targetSection) {
    targetSection = currentSections[0] || {
      id: `sec-${Date.now()}`,
      name: "Main Section",
      renderMode: "client",
      actions: [],
      componentBindings: [],
    };
    if (!currentSections.some((s) => s.id === targetSection!.id)) {
      currentSections.push(targetSection);
    }
  }

  // 3. Find or Create Endpoint Action & Wire Canvas Edge
  const currentActions: UIEventItem[] = [...(targetSection.actions || [])];

  // Check if an existing action connects to this endpoint
  const existingConnectingEdge = edges.find(
    (e) =>
      e.source === webPageNode.id &&
      e.target === serviceNode.id &&
      (e.targetHandle === `endpoint-in-${endpoint.id}` || e.targetHandle?.includes(endpoint.id)) &&
      currentActions.some((a) => e.sourceHandle === `events-${a.id}`),
  );

  let targetAction: UIEventItem | undefined;
  if (existingConnectingEdge) {
    targetAction = currentActions.find((a) => `events-${a.id}` === existingConnectingEdge.sourceHandle);
  }

  if (!targetAction) {
    const cleanRouteName = endpoint.name.replace(/[^a-zA-Z0-9]/g, "");
    const actionName = `${endpoint.type.toLowerCase()}${toPascalCase(cleanRouteName || "Submit")}Action`;
    const newActId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    targetAction = {
      id: newActId,
      name: actionName,
      event: "click",
      actionSteps: [],
    };
    currentActions.push(targetAction);

    // Add canvas edge connecting action to service endpoint
    newEdges.push({
      id: `edge-${Date.now()}-${newActId}-${endpoint.id}`,
      fractionalIndex:"a6",
      source: webPageNode.id,
      target: serviceNode.id,
      sourceHandle: `events-${newActId}`,
      targetHandle: `endpoint-in-${endpoint.id}`,
      type: "connection",
      data: {
        label: "1",
        sequenceOrder: 1,
      },
    });
  }

  // 4. Update Section State Subscriptions
  let updatedStateObjects: PageStateObject[] = [...(targetSection.stateObjects || [])];
  let updatedStates: SectionStateVariable[] = [...(targetSection.states || [])];

  if (stateStorageMode === "store" && activeStoreName) {
    selectedFields.forEach((field) => {
      const cleanVar = toCamelCase(field.stateVarName);
      if (!updatedStateObjects.some((s) => s.name === cleanVar && s.storeName === activeStoreName)) {
        updatedStateObjects.push({
          id: `st-obj-${Date.now()}-${cleanVar}`,
          name: cleanVar,
          type: field.type,
          storeName: activeStoreName,
          storeId: activeStoreId,
        });
      }
    });
  } else {
    // Local section useState variables
    selectedFields.forEach((field) => {
      const cleanVar = toCamelCase(field.stateVarName);
      if (!updatedStates.some((s) => s.name === cleanVar)) {
        updatedStates.push({
          id: `st-local-${Date.now()}-${cleanVar}`,
          name: cleanVar,
          type: field.type as any,
          defaultValue: field.type === "number" ? 0 : field.type === "boolean" ? false : "",
        });
      }
    });
  }

  // 5. Generate Component Elements
  const generatedElements: ComponentElementBinding[] = selectedFields.map((field, idx) => {
    const cleanVar = toCamelCase(field.stateVarName);
    const pascalName = `${toPascalCase(cleanVar)}Input`;
    const label = field.label || toHumanLabel(cleanVar);
    const ph = field.placeholder || `Enter ${label.toLowerCase()}...`;

    return {
      id: `el-${Date.now()}-${idx}-${cleanVar}`,
      name: pascalName,
      elementType: field.componentType,
      label,
      placeholder: ph,
      valueStateName: cleanVar,
      valueStoreName: stateStorageMode === "store" ? activeStoreName : undefined,
      valueSourceType: stateStorageMode === "store" ? "store" : "local",
      triggerEvent: field.componentType === "button" ? "click" : "change",
      propMappings: {
        inputType: field.inputType || "text",
        placeholder: ph,
        onChangeMode: "two_way",
        valueBinding: cleanVar,
      },
    };
  });

  // Append Submit Button Element
  generatedElements.push({
    id: `el-submit-${Date.now()}`,
    name: "SubmitButton",
    elementType: "button",
    label: submitButtonLabel?.trim() || "Submit",
    variant: "default",
    actionId: targetAction.id,
    actionName: targetAction.name,
    triggerEvent: "click",
  });

  // 6. Update or Create Component Binding
  const currentBindings: SectionComponentBinding[] = [...(targetSection.componentBindings || [])];
  let targetComponentId = existingComponentId;

  const resolvedFormName = toPascalCase(formName) || `${toPascalCase(endpoint.name.replace(/[^a-zA-Z0-9]/g, "") || "Data")}Form`;
  const resolvedFormLabel = formName?.trim() || `${toHumanLabel(endpoint.name.replace(/[^a-zA-Z0-9]/g, "") || "Data")} Form`;

  if (targetComponentId) {
    const existingIdx = currentBindings.findIndex((c) => c.id === targetComponentId);
    if (existingIdx !== -1) {
      currentBindings[existingIdx] = {
        ...currentBindings[existingIdx]!,
        name: resolvedFormName,
        label: resolvedFormLabel,
        componentType: "card",
        elements: generatedElements,
        actionId: targetAction.id,
        actionName: targetAction.name,
        triggerEvent: "submit",
        valueStateName: generatedElements[0]?.valueStateName,
        valueStoreName: stateStorageMode === "store" ? activeStoreName : undefined,
        valueSourceType: stateStorageMode === "store" ? "store" : "local",
      };
    }
  } else {
    targetComponentId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    currentBindings.push({
      id: targetComponentId,
      name: resolvedFormName,
      label: resolvedFormLabel,
      componentType: "card",
      elements: generatedElements,
      actionId: targetAction.id,
      actionName: targetAction.name,
      triggerEvent: "submit",
      valueStateName: generatedElements[0]?.valueStateName,
      valueStoreName: stateStorageMode === "store" ? activeStoreName : undefined,
      valueSourceType: stateStorageMode === "store" ? "store" : "local",
    });
  }

  // 7. Assemble Updated WebPage Node
  const updatedSections = currentSections.map((sec) =>
    sec.id === targetSection!.id
      ? {
          ...sec,
          renderMode: "client" as const, // Form with inputs requires client interactivity
          actions: currentActions,
          stateObjects: updatedStateObjects,
          states: updatedStates,
          componentBindings: currentBindings,
        }
      : sec,
  );

  const updatedWebPageNode: BackendNode = {
    ...webPageNode,
    data: {
      ...webPageNode.data,
      sections: updatedSections,
    },
  };

  const storeInfo = stateStorageMode === "store" ? `in ${activeStoreName}` : "as local state";
  const summaryMessage = `Generated "${resolvedFormName}" with ${selectedFields.length} inputs and wired to ${endpoint.type} ${endpoint.name} (${storeInfo})!`;

  return {
    updatedWebPageNode,
    updatedStoreNode,
    newStoreNode,
    newEdges,
    createdActionId: targetAction.id,
    createdActionName: targetAction.name,
    createdComponentBindingId: targetComponentId,
    summaryMessage,
  };
}
