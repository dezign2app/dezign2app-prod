import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStepRowState } from "../useStepRowState";
import { PipelineStepDraft } from "../types";
import { BackendNode } from "@workspace/canvas/types";

describe("pipeline-step-editor: function argument bindings and configuration state", () => {
  const mockTableNode: BackendNode = {
    id: "table-conversations",
    type: "entity",
    position: { x: 0, y: 0 },
    data: {
      label: "conversations",
      tableRef: "conversations",
      columns: [
        { name: "id", type: "string", isPrimaryKey: true },
        { name: "title", type: "string", isNotNull: true },
        { name: "description", type: "string", isNotNull: false },
      ],
    },
    fractionalIndex:"a0"
  };

  const mockEndpoint = {
    id: "ep-1",
    name: "Create Conversation",
    type: "POST",
    path: "/conversations",
    pathParams: [],
    queryParams: [],
    requestBody: {
      id: "rb-1",
      fields: [
        { id: "f-1", name: "title", type: "string", required: true },
        { id: "f-2", name: "description", type: "string", required: false },
      ],
    },
  } as any;

  it("treats findAllConversations with 0 arguments as configured without errors", () => {
    const step: PipelineStepDraft = {
      id: "step-find-all",
      name: "findAllConversationsResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-find-all-conversations",
      functionRef: {
        name: "findAllConversations",
        importPath: "@workspace/db/helpers/conversations",
      },
      inputBindings: [],
    };

    const { result } = renderHook(() =>
      useStepRowState({
        step,
        index: 0,
        priorSteps: [],
        endpoint: mockEndpoint,
        allNodes: [mockTableNode],
        allEdges: [],
        onChange: vi.fn(),
      }),
    );

    expect(result.current.expectedArgs).toEqual([]);
    expect(result.current.isUnconfigured).toBe(false);
  });

  it("flags createConversation as unconfigured when bindings have empty maps", () => {
    const step: PipelineStepDraft = {
      id: "step-create",
      name: "createConversationResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-create-conversations",
      functionRef: {
        name: "createConversation",
        importPath: "@workspace/db/helpers/conversations",
      },
      inputBindings: [
        { argName: "title", source: { kind: "req_body", field: "" } },
        { argName: "description", source: { kind: "req_body", field: "" } },
      ],
    };

    const { result } = renderHook(() =>
      useStepRowState({
        step,
        index: 0,
        priorSteps: [],
        endpoint: mockEndpoint,
        allNodes: [mockTableNode],
        allEdges: [],
        onChange: vi.fn(),
      }),
    );

    expect(result.current.expectedArgs.map((a) => a.name)).toEqual(["title", "description"]);
    expect(result.current.isUnconfigured).toBe(true);
  });

  it("clears unconfigured status when createConversation fields are properly mapped", () => {
    const step: PipelineStepDraft = {
      id: "step-create",
      name: "createConversationResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-create-conversations",
      functionRef: {
        name: "createConversation",
        importPath: "@workspace/db/helpers/conversations",
      },
      inputBindings: [
        { argName: "title", source: { kind: "req_body", field: "title" } },
        { argName: "description", source: { kind: "req_body", field: "description" } },
      ],
    };

    const { result } = renderHook(() =>
      useStepRowState({
        step,
        index: 0,
        priorSteps: [],
        endpoint: mockEndpoint,
        allNodes: [mockTableNode],
        allEdges: [],
        onChange: vi.fn(),
      }),
    );

    expect(result.current.isUnconfigured).toBe(false);
  });

  it("auto-maps unconfigured empty map bindings from available request body", () => {
    const step: PipelineStepDraft = {
      id: "step-create",
      name: "createConversationResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-create-conversations",
      functionRef: {
        name: "createConversation",
        importPath: "@workspace/db/helpers/conversations",
      },
      inputBindings: [
        { argName: "title", source: { kind: "req_body", field: "" } },
        { argName: "description", source: { kind: "req_body", field: "" } },
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
    const titleBinding = (updatedStep.inputBindings || []).find((b) => b.argName === "title");
    expect(titleBinding?.source).toEqual({ kind: "req_body", field: "title" });
  });
});
