import {
  GlobalStoreDefinition,
  GlobalStoreField,
  GlobalStoreAction,
  StateStoreTestCase,
  Parameter,
  JsonValue,
} from "@workspace/canvas/types";

export type StoreState = Record<string, JsonValue>;

export interface StorePreset {
  name: string;
  description: string;
  storage: "memory" | "localStorage" | "sessionStorage";
  fields: Array<Omit<GlobalStoreField, "id">>;
  actions: Array<
    Omit<GlobalStoreAction, "id"> & {
      targetFieldName?: string;
    }
  >;
}

export const STORE_PRESETS: StorePreset[] = [
  {
    name: "Cart",
    description: "E-commerce shopping cart with items, quantity, and price calculation",
    storage: "localStorage",
    fields: [
      { name: "items", type: "array", defaultValue: [] },
      { name: "total", type: "number", defaultValue: 0 },
      { name: "itemCount", type: "number", defaultValue: 0 },
      { name: "discountCode", type: "string", defaultValue: "" },
    ],
    actions: [
      {
        name: "addItem",
        actionType: "custom",
        targetFieldName: "items",
        parameters: [
          { id: "p1", name: "item", type: "object", required: true },
          { id: "p2", name: "quantity", type: "number", required: false },
        ],
        code: `// Add item and auto-recalculate total\nconst items = get().items || [];\nconst qty = payload?.quantity || 1;\nconst existing = items.find((i) => i.id === payload?.item?.id);\nlet nextItems;\nif (existing) {\n  nextItems = items.map((i) => i.id === payload?.item?.id ? { ...i, qty: (i.qty || 1) + qty } : i);\n} else {\n  nextItems = [...items, { ...payload?.item, qty }];\n}\nconst newTotal = nextItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.qty || 1), 0);\nset({ items: nextItems, total: newTotal, itemCount: nextItems.length });`,
      },
      { name: "setTotal", actionType: "set", targetFieldName: "total" },
      { name: "resetCart", actionType: "reset", targetFieldName: "items" },
    ],
  },
  {
    name: "UserSession",
    description: "User authentication session and preferences",
    storage: "memory",
    fields: [
      { name: "userId", type: "string", defaultValue: "" },
      { name: "isAuthenticated", type: "boolean", defaultValue: false },
      { name: "user", type: "object", defaultValue: null },
      { name: "theme", type: "string", defaultValue: "system" },
    ],
    actions: [
      {
        name: "loginSuccess",
        actionType: "custom",
        targetFieldName: "user",
        parameters: [
          { id: "p1", name: "userData", type: "object", required: true },
        ],
        code: `// Set user and mark authenticated\nconst data = payload?.userData || payload;\nset({\n  user: data,\n  userId: data?.id || data?.userId || "usr_123",\n  isAuthenticated: true,\n});`,
      },
      { name: "logout", actionType: "reset", targetFieldName: "isAuthenticated" },
      { name: "setTheme", actionType: "set", targetFieldName: "theme" },
    ],
  },
  {
    name: "UIState",
    description: "Global modal, sidebar, notifications, and navigation state",
    storage: "memory",
    fields: [
      { name: "isSidebarOpen", type: "boolean", defaultValue: true },
      { name: "activeModal", type: "string", defaultValue: "" },
      { name: "notificationsCount", type: "number", defaultValue: 0 },
      { name: "searchQuery", type: "string", defaultValue: "" },
    ],
    actions: [
      { name: "toggleSidebar", actionType: "toggle", targetFieldName: "isSidebarOpen" },
      { name: "setActiveModal", actionType: "set", targetFieldName: "activeModal" },
      { name: "incrementNotifications", actionType: "increment", targetFieldName: "notificationsCount" },
      { name: "resetUI", actionType: "reset", targetFieldName: "isSidebarOpen" },
    ],
  },
];

export function formatInitialFieldValue(field: GlobalStoreField): JsonValue {
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    return field.defaultValue;
  }
  switch (field.type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    case "string":
    default:
      return "";
  }
}

export interface StateManipulator {
  id: string;
  name: string;
  label: string;
  category: "custom_action" | "standard_action" | "auto_setter" | "builtin";
  targetFieldId?: string;
  targetFieldName?: string;
  parameters?: Parameter[];
  code?: string;
  actionType?: GlobalStoreAction["actionType"];
  defaultPayload?: JsonValue;
}

export function getStateManipulators(
  fields: GlobalStoreField[],
  actions: GlobalStoreAction[],
): StateManipulator[] {
  const list: StateManipulator[] = [];

  // 1. Actions declared by user
  actions.forEach((act) => {
    const targetField = fields.find((f) => f.id === act.targetFieldId);
    let defaultPayload: JsonValue = "";

    if (act.parameters && act.parameters.length > 0) {
      const mockObj: Record<string, JsonValue> = {};
      act.parameters.forEach((p) => {
        if (p.type === "number") mockObj[p.name] = 1;
        else if (p.type === "boolean") mockObj[p.name] = true;
        else if (p.type === "array") mockObj[p.name] = [];
        else if (p.type === "object") mockObj[p.name] = { id: "item_1", name: "Sample Item", price: 29.99 };
        else mockObj[p.name] = `sample_${p.name}`;
      });
      defaultPayload = mockObj;
    } else if (targetField) {
      if (targetField.type === "number") defaultPayload = 1;
      else if (targetField.type === "boolean") defaultPayload = true;
      else if (targetField.type === "array") defaultPayload = [{ id: "item_1", title: "New Item", price: 19.99 }];
      else if (targetField.type === "object") defaultPayload = { key: "value" };
      else defaultPayload = "Sample Value";
    }

    list.push({
      id: act.id,
      name: act.name,
      label: `${act.name}()`,
      category: act.actionType === "custom" ? "custom_action" : "standard_action",
      targetFieldId: act.targetFieldId,
      targetFieldName: targetField?.name,
      parameters: act.parameters,
      code: act.code,
      actionType: act.actionType,
      defaultPayload,
    });
  });

  // 2. Built-in actions (reset, populate)
  list.push({
    id: "builtin-reset",
    name: "reset",
    label: "reset()",
    category: "builtin",
    actionType: "reset",
    defaultPayload: undefined,
  });

  list.push({
    id: "builtin-populate",
    name: "populate",
    label: "populate(data)",
    category: "builtin",
    actionType: "populate",
    defaultPayload: fields.reduce<StoreState>(
      (acc, f) => ({ ...acc, [f.name]: formatInitialFieldValue(f) }),
      {},
    ),
  });

  // 3. Auto-generated setters (setField)
  fields.forEach((f) => {
    const capitalized = f.name.charAt(0).toUpperCase() + f.name.slice(1);
    const setterName = `set${capitalized}`;
    if (!list.some((m) => m.name === setterName)) {
      let defaultSetterVal: JsonValue = "";
      if (f.type === "number") defaultSetterVal = 100;
      else if (f.type === "boolean") defaultSetterVal = true;
      else if (f.type === "array") defaultSetterVal = [{ id: "1", title: "Example" }];
      else if (f.type === "object") defaultSetterVal = { active: true };
      else defaultSetterVal = "Updated string";

      list.push({
        id: `setter-${f.id}`,
        name: setterName,
        label: `${setterName}(value)`,
        category: "auto_setter",
        targetFieldId: f.id,
        targetFieldName: f.name,
        actionType: "set",
        defaultPayload: defaultSetterVal,
      });
    }
  });

  return list;
}

export function applyManipulator({
  manipulator,
  payload,
  currentState,
  fields,
}: {
  manipulator: StateManipulator;
  payload: JsonValue | undefined;
  currentState: StoreState;
  fields: GlobalStoreField[];
}): { newState: StoreState; error?: string } {
  try {
    let nextState: StoreState = { ...currentState };

    if (manipulator.category === "auto_setter" && manipulator.targetFieldName) {
      const fieldVal = payload !== undefined ? payload : currentState[manipulator.targetFieldName];
      if (fieldVal !== undefined) {
        nextState[manipulator.targetFieldName] = fieldVal;
      }
      return { newState: nextState };
    }

    const targetField = fields.find((f) => f.id === manipulator.targetFieldId) || fields[0];
    const targetName = targetField?.name || "value";

    switch (manipulator.actionType) {
      case "set": {
        const valToSet = payload !== undefined ? payload : currentState[targetName];
        if (valToSet !== undefined) {
          nextState[targetName] = valToSet;
        }
        break;
      }
      case "append": {
        const currentArr = currentState[targetName];
        const arr = Array.isArray(currentArr) ? currentArr : [];
        const itemToAppend = payload !== undefined ? payload : null;
        nextState[targetName] = [...arr, itemToAppend];
        break;
      }
      case "remove": {
        const currentArr = currentState[targetName];
        if (Array.isArray(currentArr)) {
          nextState[targetName] = currentArr.filter(
            (it, idx) =>
              idx !== payload &&
              !(typeof it === "object" && it !== null && "id" in it && it.id === payload),
          );
        }
        break;
      }
      case "toggle":
        nextState[targetName] = !currentState[targetName];
        break;
      case "increment": {
        const amt = typeof payload === "number" ? payload : 1;
        const currentVal = currentState[targetName];
        nextState[targetName] =
          typeof currentVal === "number"
            ? currentVal + amt
            : amt;
        break;
      }
      case "reset":
        fields.forEach((f) => {
          nextState[f.name] = formatInitialFieldValue(f);
        });
        break;
      case "populate":
        if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
          nextState = { ...nextState, ...(payload as StoreState) };
        }
        break;
      case "custom":
      default:
        if (manipulator.code && manipulator.code.trim()) {
          const setFn = (updater: StoreState | ((prev: StoreState) => StoreState)) => {
            const patch = typeof updater === "function" ? updater(nextState) : updater;
            if (patch && typeof patch === "object") {
              nextState = { ...nextState, ...patch };
            }
          };
          const getFn = () => nextState;
          const runner = new Function("payload", "{ set, get }", manipulator.code);
          runner(payload, { set: setFn, get: getFn });
        } else {
          const valToSet = payload !== undefined ? payload : currentState[targetName];
          if (valToSet !== undefined) {
            nextState[targetName] = valToSet;
          }
        }
        break;
    }

    return { newState: nextState };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { newState: currentState, error: errorMsg };
  }
}

export function generateDefaultTestCases(
  manipulators: StateManipulator[],
): StateStoreTestCase[] {
  return manipulators.map((m, idx) => ({
    id: `tc-${Date.now()}-${idx}`,
    name: `Test ${m.name}() execution`,
    manipulatorName: m.name,
    payload: m.defaultPayload,
    status: "idle",
  }));
}

export interface TestHistoryEntry {
  id: string;
  timestamp: string;
  manipulatorName: string;
  category: string;
  changedKeys: string[];
  beforeState: StoreState;
  afterState: StoreState;
  error?: string;
}
