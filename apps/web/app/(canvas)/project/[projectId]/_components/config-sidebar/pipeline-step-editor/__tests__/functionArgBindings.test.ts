import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStepRowState } from "../useStepRowState";
import { getAvailableSources } from "../sourcePaths";
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

  it("surfaces array length and indexed item paths for findAllConversations without message or success attributes", () => {
    const findAllStep: PipelineStepDraft = {
      id: "step-1",
      name: "findAllConversationsResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-find-all-conversations",
      functionRef: {
        name: "findAllConversations",
        importPath: "@workspace/db/helpers/conversations",
        returnIsArray: true,
      },
      outputVariable: "findAllConversationsResult",
    };

    const sources = getAvailableSources(mockEndpoint, [findAllStep], [mockTableNode]);
    const stepSource = sources.find((s) => s.id === "step:step-1");

    expect(stepSource).toBeDefined();
    expect(stepSource?.variableName).toBe("findAllConversationsResult");

    const paths = (stepSource?.paths || []).map((p) => p.path);

    // Array operations must expose length and element paths
    expect(paths).toContain("length");
    expect(paths).toContain("[0].id");
    expect(paths).toContain("[0].title");
    expect(paths).toContain("[0].description");

    // Must NOT expose operational message or success because the function returns Promise<Conversation[]>
    expect(paths).not.toContain("message");
    expect(paths).not.toContain("success");
    expect(paths).not.toContain("id"); // Flat id is replaced by indexed [0].id
  });

  it("resolves db_ref node pointer to master entity node and surfaces table columns", () => {
    const dbRefNode: BackendNode = {
      id: "node-ref-conversations",
      type: "db_ref",
      position: { x: 50, y: 50 },
      fractionalIndex: "a1",
      data: {
        label: "conversations",
        tableRef: "table-conversations",
      },
    };

    const findByIdStep: PipelineStepDraft = {
      id: "step-by-id",
      name: "findConversationByIdResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "node-ref-conversations",
      functionRef: {
        name: "findConversationById",
        importPath: "@workspace/db/helpers/conversations",
      },
      outputVariable: "findConversationByIdResult",
    };

    const sources = getAvailableSources(mockEndpoint, [findByIdStep], [mockTableNode, dbRefNode]);
    const stepSource = sources.find((s) => s.id === "step:step-by-id");

    expect(stepSource).toBeDefined();
    const paths = (stepSource?.paths || []).map((p) => p.path);

    // Primary key at front
    expect(paths[0]).toBe("id");
    expect(paths).toContain("title");
    expect(paths).toContain("description");

    // findById does not return message or success
    expect(paths).not.toContain("message");
    expect(paths).not.toContain("success");
  });
});
