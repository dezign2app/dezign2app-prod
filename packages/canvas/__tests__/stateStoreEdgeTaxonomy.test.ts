import { describe, it, expect } from "vitest";
import { classifyHandle } from "../utils";
import { isValidConnection } from "../validators";
import { CONNECTION_RULES, EDGE_TYPE_MAP } from "../graph-rules";

describe("StateStore and Section State Handle Taxonomy", () => {
  it("classifies all handles in state subscription workflow", () => {
    // store-field-out
    expect(classifyHandle("state_store", "store-field-out-f123", "source")).toBe("store-out");
    // store-field-in
    expect(classifyHandle("state_store", "store-field-in-f123", "target")).toBe("store-in");
    // section-state-in
    expect(classifyHandle("webPage", "section-state-in-sec1-st1", "target")).toBe("page-section-in");
    // type-out
    expect(classifyHandle("types", "type-out-chat", "source")).toBe("type-out");
  });

  it("verifies graph rules and edge types", () => {
    // store-out can connect to page-section-in
    expect(CONNECTION_RULES["store-out"]).toContain("page-section-in");

    // type-out can connect to store-in and page-section-in
    expect(CONNECTION_RULES["type-out"]).toContain("store-in");
    expect(CONNECTION_RULES["type-out"]).toContain("page-section-in");

    // edge types mapped
    expect(EDGE_TYPE_MAP["store-out→page-section-in"]).toBe("connection");
    expect(EDGE_TYPE_MAP["type-out→page-section-in"]).toBe("type-reference");
    expect(EDGE_TYPE_MAP["type-out→store-in"]).toBe("type-reference");
  });

  it("validates connections through isValidConnection", () => {
    const storeToSection = isValidConnection(
      "state_store",
      "store-field-out-chats",
      "webPage",
      "section-state-in-main-chats",
    );
    expect(storeToSection.valid).toBe(true);

    const typeToSection = isValidConnection(
      "types",
      "type-out-Chat",
      "webPage",
      "section-state-in-main-chats",
    );
    expect(typeToSection.valid).toBe(true);

    const typeToStore = isValidConnection(
      "types",
      "type-out-Chat",
      "state_store",
      "store-field-in-chats",
    );
    expect(typeToStore.valid).toBe(true);
  });
});
