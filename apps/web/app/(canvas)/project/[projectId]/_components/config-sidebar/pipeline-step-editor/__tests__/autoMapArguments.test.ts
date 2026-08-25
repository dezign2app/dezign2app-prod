import { describe, it, expect, vi } from "vitest";
import { isPathMatch } from "../utils";
import { renderHook, act } from "@testing-library/react";
import { useStepRowState } from "../useStepRowState";
import { PipelineStepDraft } from "../types";
import { Endpoint, BackendNode } from "@workspace/canvas/types";

describe("pipeline-step-editor: isPathMatch", () => {
  it("matches exact path and argument name", () => {
    expect(isPathMatch("name", "name")).toBe(true);
    expect(isPathMatch("email", "email")).toBe(true);
  });

  it("matches dot-delimited nested paths with matching property name", () => {
    expect(isPathMatch("user.email", "email")).toBe(true);
    expect(isPathMatch("data.items.price", "price")).toBe(true);
    expect(isPathMatch("payload.data.userId", "userId")).toBe(true);
  });

  it("matches snake_case paths with camelCase argument names and vice versa", () => {
    expect(isPathMatch("user_id", "userId")).toBe(true);
    expect(isPathMatch("userId", "user_id")).toBe(true);
    expect(isPathMatch("first_name", "firstName")).toBe(true);
    expect(isPathMatch("created_at", "createdAt")).toBe(true);
  });

  it("does not match non-existent or unrelated fields", () => {
    expect(isPathMatch("description", "id")).toBe(false);
    expect(isPathMatch("title", "price")).toBe(false);
    expect(isPathMatch("user_id", "name")).toBe(false);
    expect(isPathMatch("", "field")).toBe(false);
    expect(isPathMatch("field", "")).toBe(false);
  });
});

describe("pipeline-step-editor: useStepRowState handleAutoMapArguments", () => {
  const mockEndpoint: Endpoint = {
    id: "ep-1",
    name: "Create Product",
    type: "POST",
    pathParams: [{ id: "p-1", name: "categoryId", type: "string", required: true }],
    queryParams: [{ id: "q-1", name: "dryRun", type: "boolean", required: false }],
    requestBody: {
      id: "rb-1",
      fields: [
        { id: "f-1", name: "title", type: "string", required: true },
        { id: "f-2", name: "price", type: "number", required: true },
      ],
    },
  };

  const mockTableNode: BackendNode = {
    id: "table-products",
    type: "entity",
    position: { x: 0, y: 0 },
    fractionalIndex: "a0",
    data: {
      label: "Product",
      tableRef: "Product",
      columns: [
        { name: "id", type: "string", isPrimaryKey: true },
        { name: "title", type: "string", isNotNull: true },
        { name: "price", type: "number", isNotNull: true },
        { name: "category_id", type: "string", isNotNull: true },
        { name: "description", type: "string", isNotNull: false },
        { name: "image_url", type: "string", isNotNull: false },
        { name: "in_stock", type: "boolean", isNotNull: false },
        { name: "created_at", type: "string", isNotNull: false },
      ],
    },
  };

  it("only adds fields that exist in request body, params, query, headers, or prior steps", () => {
    const step: PipelineStepDraft = {
      id: "step-db-1",
      name: "createProductResult",
      type: "db_operation",
      enabled: true,
      outputVariable: "createProductResult",
      tableNodeId: "table-products",
      operationId: "createProduct",
      functionRef: { name: "createProduct", importPath: "@workspace/db/helpers/Product" },
      inputBindings: [],
    };

    let updatedStep: PipelineStepDraft = step;
    const onChange = vi.fn((updated) => {
      updatedStep = updated;
    });

    const { result } = renderHook(() =>
      useStepRowState({
        step,
        index: 0,
        priorSteps: [],
        endpoint: mockEndpoint,
        allNodes: [mockTableNode],
        allEdges: [],
        onChange,
      }),
    );

    act(() => {
      result.current.handleAutoMapArguments();
    });

    expect(onChange).toHaveBeenCalled();
    const mappedArgNames = updatedStep.inputBindings.map((b) => b.argName);

    // Should include existing matched fields:
    // 1. title (matched from req_body.title)
    // 2. price (matched from req_body.price)
    // 3. categoryId (matched from req_params.categoryId)
    expect(mappedArgNames).toContain("title");
    expect(mappedArgNames).toContain("price");
    expect(mappedArgNames).toContain("categoryId");

    // Should NOT include fields that do NOT exist in available sources:
    expect(mappedArgNames).not.toContain("description");
    expect(mappedArgNames).not.toContain("imageUrl");
    expect(mappedArgNames).not.toContain("inStock");
    expect(mappedArgNames).not.toContain("createdAt");

    // Verify correct source bindings
    const titleBinding = updatedStep.inputBindings.find((b) => b.argName === "title");
    expect(titleBinding?.source).toEqual({ kind: "req_body", field: "title" });

    const categoryIdBinding = updatedStep.inputBindings.find((b) => b.argName === "categoryId");
    expect(categoryIdBinding?.source).toEqual({ kind: "req_params", field: "categoryId" });
  });

  it("preserves existing configured bindings and custom bindings", () => {
    const step: PipelineStepDraft = {
      id: "step-db-1",
      name: "createProductResult",
      type: "db_operation",
      enabled: true,
      outputVariable: "createProductResult",
      tableNodeId: "table-products",
      operationId: "createProduct",
      functionRef: { name: "createProduct", importPath: "@workspace/db/helpers/Product" },
      inputBindings: [
        {
          argName: "description",
          source: { kind: "literal", value: "Default description" },
        },
        {
          argName: "customExtraField",
          source: { kind: "literal", value: "custom-val" },
        },
      ],
    };

    let updatedStep: PipelineStepDraft = step;
    const onChange = vi.fn((updated) => {
      updatedStep = updated;
    });

    const { result } = renderHook(() =>
      useStepRowState({
        step,
        index: 0,
        priorSteps: [],
        endpoint: mockEndpoint,
        allNodes: [mockTableNode],
        allEdges: [],
        onChange,
      }),
    );

    act(() => {
      result.current.handleAutoMapArguments();
    });

    expect(onChange).toHaveBeenCalled();
    const mappedArgNames = updatedStep.inputBindings.map((b) => b.argName);

    // Existing configured description should be preserved
    expect(mappedArgNames).toContain("description");
    const descBinding = updatedStep.inputBindings.find((b) => b.argName === "description");
    expect(descBinding?.source).toEqual({ kind: "literal", value: "Default description" });

    // Custom extra field should be preserved
    expect(mappedArgNames).toContain("customExtraField");
    const extraBinding = updatedStep.inputBindings.find((b) => b.argName === "customExtraField");
    expect(extraBinding?.source).toEqual({ kind: "literal", value: "custom-val" });

    // Matched fields should still be added
    expect(mappedArgNames).toContain("title");
    expect(mappedArgNames).toContain("price");

    // Non-existent and unconfigured fields should NOT be added
    expect(mappedArgNames).not.toContain("imageUrl");
    expect(mappedArgNames).not.toContain("inStock");
  });
});
