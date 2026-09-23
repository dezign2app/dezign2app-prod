import { describe, it, expect } from "vitest";
import {
  getStateManipulators,
  applyManipulator,
} from "../types";
import type {
  GlobalStoreField,
  GlobalStoreAction,
} from "@workspace/canvas/types";

describe("stateStoreManipulators", () => {
  const sampleFields: GlobalStoreField[] = [
    { id: "f1", name: "count", type: "number", defaultValue: 0 },
    { id: "f2", name: "user", type: "object", defaultValue: null },
  ];

  it("returns default built-in manipulators when no custom overrides exist", () => {
    const manipulators = getStateManipulators(sampleFields, []);

    const names = manipulators.map((m) => m.name);
    expect(names).toContain("reset");
    expect(names).toContain("populate");
    expect(names).toContain("setCount");
    expect(names).toContain("setUser");

    const populate = manipulators.find((m) => m.name === "populate");
    expect(populate?.category).toBe("builtin");
    expect(populate?.isCustomized).toBe(false);

    const reset = manipulators.find((m) => m.name === "reset");
    expect(reset?.category).toBe("builtin");
    expect(reset?.isCustomized).toBe(false);

    const setCount = manipulators.find((m) => m.name === "setCount");
    expect(setCount?.category).toBe("auto_setter");
    expect(setCount?.isCustomized).toBe(false);
  });

  it("handles customized populate and reset without duplicating them", () => {
    const customActions: GlobalStoreAction[] = [
      {
        id: "act-load",
        name: "loadUserData",
        actionType: "populate",
        code: "set({ count: 99 });",
        defaultManipulatorType: "populate",
      } as any,
      {
        id: "act-reset",
        name: "clearSession",
        actionType: "reset",
        code: "set({ user: null });",
        defaultManipulatorType: "reset",
      } as any,
      {
        id: "act-setter-count",
        name: "setCount",
        targetFieldId: "f1",
        actionType: "set",
        code: "set({ count: Math.max(0, payload) });",
        defaultManipulatorType: "setter",
      } as any,
    ];

    const manipulators = getStateManipulators(sampleFields, customActions);

    // Should include customized names
    expect(manipulators.some((m) => m.name === "loadUserData")).toBe(true);
    expect(manipulators.some((m) => m.name === "clearSession")).toBe(true);

    // Should not duplicate built-in populate or reset
    expect(manipulators.filter((m) => m.name === "populate").length).toBe(0);
    expect(manipulators.filter((m) => m.name === "reset").length).toBe(0);

    // setCount should be customized and appear once
    const setCountManipulators = manipulators.filter((m) => m.name === "setCount");
    expect(setCountManipulators.length).toBe(1);
    expect(setCountManipulators[0]?.isCustomized).toBe(true);

    // setUser should still appear as default auto_setter
    const setUser = manipulators.find((m) => m.name === "setUser");
    expect(setUser).toBeDefined();
    expect(setUser?.isCustomized).toBe(false);
  });

  it("respects disabledDefaultManipulators", () => {
    const manipulators = getStateManipulators(sampleFields, [], ["reset", "setCount"]);

    const names = manipulators.map((m) => m.name);
    expect(names).not.toContain("reset");
    expect(names).not.toContain("setCount");
    expect(names).toContain("populate");
    expect(names).toContain("setUser");
  });

  it("respects deletedDefaultManipulators (omitted completely)", () => {
    const manipulators = getStateManipulators(sampleFields, [], [], ["populate", "reset", "setCount"]);

    const names = manipulators.map((m) => m.name);
    expect(names).not.toContain("populate");
    expect(names).not.toContain("reset");
    expect(names).not.toContain("setCount");
    expect(names).toContain("setUser");
  });

  it("executes custom code in applyManipulator", () => {
    const customManipulator = {
      id: "m-custom",
      name: "loadData",
      label: "loadData()",
      category: "builtin" as const,
      actionType: "populate" as const,
      code: "set({ count: 42, user: { name: 'Alice' } });",
    };

    const res = applyManipulator({
      manipulator: customManipulator,
      payload: {},
      currentState: { count: 0, user: null },
      fields: sampleFields,
    });

    expect(res.error).toBeUndefined();
    expect(res.newState.count).toBe(42);
    expect(res.newState.user).toEqual({ name: "Alice" });
  });
});
