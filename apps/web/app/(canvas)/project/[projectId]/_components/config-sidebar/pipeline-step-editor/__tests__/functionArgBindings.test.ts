import { describe, it, expect, vi } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import React from "react";
import { useStepRowState } from "../useStepRowState";
import { getAvailableSources } from "../sourcePaths";
import { PipelineStepDraft } from "../types";
import { BackendNode, Endpoint } from "@workspace/canvas/types";
import { computeDbOpBindings } from "@/lib/utils/entityOperationsHelper";
import { renderAsyncOperationStep } from "@/lib/compiler/generators/routeGenerator/pipeline/renderers/compileAsyncOperationStep";
import {
  DbOperationStepSection,
  isDbOperationPaginated,
  isPaginationNeededByOtherSteps,
} from "../DbOperationStepSection";

vi.mock("@workspace/ui/components/combobox", () => ({
  Combobox: ({ children }: any) => React.createElement("div", { "data-testid": "mock-combobox" }, children),
  ComboboxInput: (props: any) => React.createElement("input", { "data-testid": "combobox-input", ...props }),
  ComboboxContent: ({ children }: any) => React.createElement("div", { "data-testid": "combobox-content" }, children),
  ComboboxList: ({ children }: any) =>
    React.createElement("div", { "data-testid": "combobox-list" }, typeof children === "function" ? children([]) : children),
  ComboboxItem: ({ children, value }: any) =>
    React.createElement("div", { "data-testid": "combobox-item", "data-value": value }, children),
  ComboboxEmpty: ({ children }: any) => React.createElement("div", { "data-testid": "combobox-empty" }, children),
}));

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

    // Optional limit & offset are available as expectedArgs
    expect(result.current.expectedArgs.map((a) => a.name)).toEqual(["limit", "offset"]);
    expect(result.current.expectedArgs.every((a) => a.required === false)).toBe(true);
    // 0 configured bindings in inputBindings does not fail configuration for findAll
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

  it("automatically adds createdBy, limit, and offset fields in arguments binding when findAllConversationsByUser is selected", () => {
    const tableWithIndex: BackendNode = {
      id: "table-conversations",
      fractionalIndex:"a1",
      type: "entity",
      position: { x: 0, y: 0 },
      data: {
        label: "conversations",
        tableRef: "conversations",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "title", type: "string", isNotNull: true },
          { name: "description", type: "string", isNotNull: false },
          { name: "created_by", type: "string", isNotNull: true },
        ],
        indexes: [
          { name: "idx_conversations_created_by", columns: "created_by", isUnique: false },
        ],
      },
    };

    const step: PipelineStepDraft = {
      id: "step-find-by-user",
      name: "findAllConversationsByUserResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-index-conversations-idx_conversations_created_by-0",
      functionRef: {
        name: "findAllConversationsByUser",
        importPath: "@workspace/db/helpers/conversations",
        signature:
          "findAllConversationsByUser(createdBy: string, limit?: number, offset?: number): Promise<Conversations[]>",
        returnIsArray: true,
      },
      inputBindings: [],
    };

    const { result } = renderHook(() =>
      useStepRowState({
        step,
        index: 0,
        priorSteps: [],
        endpoint: mockEndpoint,
        allNodes: [tableWithIndex],
        allEdges: [],
        onChange: vi.fn(),
      }),
    );

    // 1. Verify expectedArgs are correctly populated
    expect(result.current.expectedArgs).toHaveLength(3);
    expect(result.current.expectedArgs[0]).toEqual({
      name: "createdBy",
      type: "string",
      required: true,
    });
    expect(result.current.expectedArgs[1]).toEqual({
      name: "limit",
      type: "number",
      required: false,
    });
    expect(result.current.expectedArgs[2]).toEqual({
      name: "offset",
      type: "number",
      required: false,
    });

    // 2. Verify computeDbOpBindings automatically adds the fields
    const ops = (tableWithIndex.data as any)?.dbOperations || [];
    const matchedOp = ops.find((o: any) => o.name === "findAllConversationsByUser") || {
      id: "auto-index-conversations-idx_conversations_created_by-0",
      name: "findAllConversationsByUser",
      kind: "fetchByIndex",
      params: [
        { name: "createdBy", type: "string", required: true },
        { name: "limit", type: "number", required: false, defaultValue: "20" },
        { name: "offset", type: "number", required: false, defaultValue: "0" },
      ],
      signature:
        "findAllConversationsByUser(createdBy: string, limit?: number, offset?: number): Promise<Conversations[]>",
    };

    const bindings = computeDbOpBindings(
      matchedOp as any,
      tableWithIndex,
      [],
      [],
      step.functionRef,
    );

    expect(bindings).toHaveLength(3);
    expect(bindings.map((b) => b.argName)).toEqual(["createdBy", "limit", "offset"]);
    expect(bindings[0]?.source.kind).toBe("req_body");
  });

  it("automatically adds limit and offset in arguments binding when findAllUsers(limit?: number, offset?: number) is selected", () => {
    const usersTableNode: BackendNode = {
      id: "table-users",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "users",
        tableRef: "users",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "name", type: "string", isNotNull: true },
          { name: "email", type: "string", isNotNull: true },
        ],
        dbOperations: [
          {
            id: "auto-find-all-users",
            name: "findAllUsers",
            kind: "findAll",
            description: "Retrieve all rows from users",
            signature: "findAllUsers(limit?: number, offset?: number): Promise<User[]>",
            params: [
              { name: "limit", type: "number", required: false, defaultValue: "20" },
              { name: "offset", type: "number", required: false, defaultValue: "0" },
            ],
            pagination: {
              enabled: true,
              defaultLimit: 20,
              maxLimit: 100,
              mode: "offset",
            },
            returnType: "User[]",
          },
        ],
      },
    };

    const endpointWithQueryParams = {
      id: "ep-get-users",
      name: "Find All Users",
      type: "GET",
      path: "/users",
      pathParams: [],
      queryParams: [
        { id: "qp-1", name: "limit", type: "number", required: false },
        { id: "qp-2", name: "offset", type: "number", required: false },
      ],
    } as any;

    const step: PipelineStepDraft = {
      id: "step-find-all-users",
      name: "findAllUsersResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users",
      operationId: "auto-find-all-users",
      functionRef: {
        name: "findAllUsers",
        importPath: "@workspace/db/helpers/user",
        signature: "findAllUsers(limit?: number, offset?: number): Promise<User[]>",
        returnIsArray: true,
      },
      inputBindings: [],
    };

    const { result } = renderHook(() =>
      useStepRowState({
        step,
        index: 0,
        priorSteps: [],
        endpoint: endpointWithQueryParams,
        allNodes: [usersTableNode],
        allEdges: [],
        onChange: vi.fn(),
      }),
    );

    // 1. Verify expectedArgs are derived with limit & offset (optional)
    expect(result.current.expectedArgs).toHaveLength(2);
    expect(result.current.expectedArgs[0]).toEqual({
      name: "limit",
      type: "number",
      required: false,
    });
    expect(result.current.expectedArgs[1]).toEqual({
      name: "offset",
      type: "number",
      required: false,
    });

    // 2. Pure findAll with optional pagination must NOT be flagged as unconfigured
    expect(result.current.isUnconfigured).toBe(false);

    // 3. Verify computeDbOpBindings auto-maps to query parameters if present
    const availableSources = getAvailableSources(endpointWithQueryParams, [], [usersTableNode]);
    const matchedOp = (usersTableNode.data as any).dbOperations[0];
    const bindingsWithQuery = computeDbOpBindings(
      matchedOp,
      usersTableNode,
      [],
      availableSources,
      step.functionRef,
    );

    expect(bindingsWithQuery).toHaveLength(2);
    expect(bindingsWithQuery[0]).toEqual({
      argName: "limit",
      source: { kind: "req_query", field: "limit" },
    });
    expect(bindingsWithQuery[1]).toEqual({
      argName: "offset",
      source: { kind: "req_query", field: "offset" },
    });

    // 4. Verify computeDbOpBindings still generates limit & offset bindings when no query params exist
    const bindingsNoQuery = computeDbOpBindings(
      matchedOp,
      usersTableNode,
      [],
      [],
      step.functionRef,
    );
    expect(bindingsNoQuery).toHaveLength(2);
    expect(bindingsNoQuery.map((b) => b.argName)).toEqual(["limit", "offset"]);
    expect(bindingsNoQuery[0]?.source.kind).toBe("req_query");
    expect(bindingsNoQuery[1]?.source.kind).toBe("req_query");
  });

  it("compiles findAllUsers positional call correctly with mapped and unmapped pagination arguments", () => {
    const ctx = {
      bodyVar: "body",
      priorOutputs: new Map<string, string>(),
      reusableFunctions: [],
    } as any;

    // Both mapped
    const stepBothMapped: any = {
      name: "findAllUsersStep",
      type: "db_operation",
      outputVariable: "usersResult",
      functionRef: {
        name: "findAllUsers",
        signature: "findAllUsers(limit?: number, offset?: number): Promise<User[]>",
      },
      inputBindings: [
        { argName: "limit", source: { kind: "req_query", field: "limit" } },
        { argName: "offset", source: { kind: "req_query", field: "offset" } },
      ],
    };
    const linesBoth = renderAsyncOperationStep(stepBothMapped, ctx);
    expect(linesBoth.join("\n")).toContain("const usersResult = await findAllUsers(req.query.limit, req.query.offset);");

    // Only limit mapped
    const stepLimitOnly: any = {
      ...stepBothMapped,
      inputBindings: [
        { argName: "limit", source: { kind: "req_query", field: "limit" } },
        { argName: "offset", source: { kind: "req_query", field: "" } },
      ],
    };
    const linesLimitOnly = renderAsyncOperationStep(stepLimitOnly, ctx);
    expect(linesLimitOnly.join("\n")).toContain("const usersResult = await findAllUsers(req.query.limit);");

    // Neither mapped (empty fields) emits clean zero-argument call
    const stepNeitherMapped: any = {
      ...stepBothMapped,
      inputBindings: [
        { argName: "limit", source: { kind: "req_query", field: "" } },
        { argName: "offset", source: { kind: "req_query", field: "" } },
      ],
    };
    const linesNeither = renderAsyncOperationStep(stepNeitherMapped, ctx);
    expect(linesNeither.join("\n")).toContain("const usersResult = await findAllUsers();");
  });

  it("discards stale argument bindings when switching from update operation to findByUser", () => {
    const userTable: BackendNode = {
      id: "table-user",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "user",
        tableRef: "user",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "name", type: "string", isNotNull: true },
          { name: "email", type: "string", isNotNull: true },
        ],
      },
    };

    const findByUserOp: any = {
      id: "auto-find-by-user",
      name: "findByUser",
      kind: "fetchByIndex",
      params: [
        { name: "createdBy", type: "string", required: true },
        { name: "limit", type: "number", required: false, defaultValue: "20" },
        { name: "offset", type: "number", required: false, defaultValue: "0" },
      ],
      signature: "findByUser(createdBy: string, limit?: number, offset?: number): Promise<User[]>",
    };

    // Stale bindings from previous 'update' operation (id and name columns)
    const previousUpdateBindings: any[] = [
      { argName: "id", source: { kind: "req_body", field: "" } },
      { argName: "name", source: { kind: "req_body", field: "" } },
    ];

    const nextBindings = computeDbOpBindings(
      findByUserOp,
      userTable,
      previousUpdateBindings,
      [],
      { name: "findByUser", signature: findByUserOp.signature },
    );

    // Must ONLY contain findByUser's expected args (createdBy, limit, offset)
    // Stale id and name from update must NOT be present!
    expect(nextBindings.map((b) => b.argName)).toEqual(["createdBy", "limit", "offset"]);
    expect(nextBindings.some((b) => b.argName === "id")).toBe(false);
    expect(nextBindings.some((b) => b.argName === "name")).toBe(false);
  });

  it("auto-syncs missing limit and offset query params to endpoint and displays the synced badge", () => {
    const tableWithPagination: BackendNode = {
      id: "table-users-page",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "users",
        tableRef: "users",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "name", type: "string", isNotNull: true },
        ],
        dbOperations: [
          {
            id: "op-find-all",
            name: "findAllUsers",
            kind: "findAll",
            params: [
              { name: "limit", type: "number", required: false, defaultValue: "20" },
              { name: "offset", type: "number", required: false, defaultValue: "0" },
            ],
            pagination: { enabled: true, defaultLimit: 20, maxLimit: 100, mode: "offset" },
            returnType: "Promise<User[]>",
          },
        ],
      },
    };

    const endpointNoQuery: Endpoint = {
      id: "ep-test-sync",
      name: "/users",
      type: "GET",
      pathParams: [],
      queryParams: [],
    };

    const onEndpointChange = vi.fn();

    const step: PipelineStepDraft = {
      id: "step-1",
      name: "findAllUsersResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users-page",
      operationId: "op-find-all",
      functionRef: {
        name: "findAllUsers",
        importPath: "@workspace/db/helpers/user",
      },
      inputBindings: [],
    };

    render(
      React.createElement(DbOperationStepSection, {
        step,
        allNodes: [tableWithPagination],
        allEdges: [],
        selectedDbId: "all",
        showAdvancedSettings: false,
        onToggleAdvancedSettings: vi.fn(),
        onChange: vi.fn(),
        endpoint: endpointNoQuery,
        onEndpointChange,
        expectedArgs: [
          { name: "limit", type: "number", required: false },
          { name: "offset", type: "number", required: false },
        ],
      })
    );

    // 1. Should call onEndpointChange with limit and offset query params
    expect(onEndpointChange).toHaveBeenCalled();
    const calls = onEndpointChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstCall = calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const updatedQueryParams = firstCall[0]?.queryParams;
    expect(updatedQueryParams).toBeDefined();
    if (!updatedQueryParams) return;
    expect(updatedQueryParams).toHaveLength(2);
    expect(updatedQueryParams[0]?.name).toBe("limit");
    expect(updatedQueryParams[0]?.defaultValue).toBe("20");
    expect(updatedQueryParams[0]?.required).toBe(false);
    expect(updatedQueryParams[1]?.name).toBe("offset");
    expect(updatedQueryParams[1]?.defaultValue).toBe("0");
    expect(updatedQueryParams[1]?.required).toBe(false);
  });

  it("isPaginationNeededByOtherSteps detects when pagination query params are needed", () => {
    const paginatedStep: PipelineStepDraft = {
      id: "step-find-all",
      name: "findAllUsersResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users-page",
      operationId: "op-find-all",
      inputBindings: [],
    };

    const boundStep: PipelineStepDraft = {
      id: "step-custom",
      name: "customStep",
      type: "transform",
      enabled: true,
      inputBindings: [
        { argName: "take", source: { kind: "req_query", field: "limit" } },
      ],
    };

    const nonPaginatedStep: PipelineStepDraft = {
      id: "step-create",
      name: "createUserResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users-page",
      operationId: "op-create",
      inputBindings: [],
    };

    const tableNode: BackendNode = {
      id: "table-users-page",
      type: "entity",
      position: { x: 0, y: 0 },
      data: {
        label: "users",
        tableRef: "users",
        dbOperations: [
          {
            id: "op-find-all",
            name: "findAllUsers",
            kind: "findAll",
            pagination: { enabled: true },
          },
          {
            id: "op-create",
            name: "createUser",
            kind: "create",
          },
        ],
      },
      fractionalIndex: "a0",
    };

    // Case 1: Another step is a paginated DB op
    expect(
      isPaginationNeededByOtherSteps(
        "step-current",
        [paginatedStep, nonPaginatedStep],
        [tableNode]
      )
    ).toBe(true);

    // Case 2: Another step binds to query.limit
    expect(
      isPaginationNeededByOtherSteps(
        "step-current",
        [boundStep, nonPaginatedStep],
        [tableNode]
      )
    ).toBe(true);

    // Case 3: Only the current step was paginated, no other steps need it
    expect(
      isPaginationNeededByOtherSteps(
        "step-find-all",
        [paginatedStep, nonPaginatedStep],
        [tableNode]
      )
    ).toBe(false);

    // Case 4: No steps need pagination
    expect(
      isPaginationNeededByOtherSteps("step-create", [nonPaginatedStep], [tableNode])
    ).toBe(false);
  });

  it("auto-prunes limit and offset when changing to a non-fetch operation (create/delete) if no other step needs them", () => {
    const tableWithOps: BackendNode = {
      id: "table-users-ops",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "users",
        tableRef: "users",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "name", type: "string", isNotNull: true },
        ],
        dbOperations: [
          {
            id: "op-find-all",
            name: "findAllUsers",
            kind: "findAll",
            pagination: { enabled: true, defaultLimit: 20 },
            returnType: "Promise<User[]>",
          },
          {
            id: "op-create",
            name: "createUser",
            kind: "create",
            params: [{ name: "name", type: "string", required: true }],
            returnType: "Promise<User>",
          },
        ],
      },
    };

    const initialEndpoint: Endpoint = {
      id: "ep-switch-test",
      name: "/users",
      type: "POST",
      pathParams: [],
      queryParams: [
        { id: "qp-filter", name: "filter", type: "string", required: false },
        { id: "qp-limit", name: "limit", type: "number", required: false, defaultValue: "20" },
        { id: "qp-offset", name: "offset", type: "number", required: false, defaultValue: "0" },
      ],
    };

    const onEndpointChange = vi.fn();

    const paginatedStep: PipelineStepDraft = {
      id: "step-1",
      name: "findAllUsersResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users-ops",
      operationId: "op-find-all",
      functionRef: {
        name: "findAllUsers",
        importPath: "@workspace/db/helpers/user",
      },
      inputBindings: [],
    };

    const { rerender } = render(
      React.createElement(DbOperationStepSection, {
        step: paginatedStep,
        allNodes: [tableWithOps],
        allEdges: [],
        selectedDbId: "all",
        showAdvancedSettings: false,
        onToggleAdvancedSettings: vi.fn(),
        onChange: vi.fn(),
        endpoint: initialEndpoint,
        onEndpointChange,
        expectedArgs: [],
      })
    );

    // Now switch the step to a non-fetch operation (createUser)
    const createStep: PipelineStepDraft = {
      id: "step-1",
      name: "createUserResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users-ops",
      operationId: "op-create",
      functionRef: {
        name: "createUser",
        importPath: "@workspace/db/helpers/user",
      },
      inputBindings: [{ argName: "name", source: { kind: "req_body", field: "name" } }],
    };

    rerender(
      React.createElement(DbOperationStepSection, {
        step: createStep,
        allNodes: [tableWithOps],
        allEdges: [],
        selectedDbId: "all",
        showAdvancedSettings: false,
        onToggleAdvancedSettings: vi.fn(),
        onChange: vi.fn(),
        endpoint: initialEndpoint,
        onEndpointChange,
        expectedArgs: [{ name: "name", type: "string", required: true }],
      })
    );

    // Should call onEndpointChange and remove limit and offset, but keep custom 'filter'
    expect(onEndpointChange).toHaveBeenCalled();
    const calls = onEndpointChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBeDefined();
    if (!lastCall) return;
    const lastCallArg = lastCall[0];
    expect(lastCallArg?.queryParams).toBeDefined();
    if (!lastCallArg?.queryParams) return;
    expect(lastCallArg.queryParams).toHaveLength(1);
    expect(lastCallArg.queryParams[0]?.name).toBe("filter");
  });

  it("preserves limit and offset query params if another step in the pipeline is paginated", () => {
    const tableWithOps: BackendNode = {
      id: "table-users-ops",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "users",
        tableRef: "users",
        dbOperations: [
          {
            id: "op-find-all",
            name: "findAllUsers",
            kind: "findAll",
            pagination: { enabled: true, defaultLimit: 20 },
          },
          {
            id: "op-create",
            name: "createUser",
            kind: "create",
          },
        ],
      },
    };

    const initialEndpoint2: Endpoint = {
      id: "ep-switch-test-2",
      name: "/users",
      type: "POST",
      pathParams: [],
      queryParams: [
        { id: "qp-limit", name: "limit", type: "number", required: false, defaultValue: "20" },
        { id: "qp-offset", name: "offset", type: "number", required: false, defaultValue: "0" },
      ],
    };

    const onEndpointChange = vi.fn();

    // Step 2 is paginated and exists in allSteps
    const anotherPaginatedStep: PipelineStepDraft = {
      id: "step-2",
      name: "findAllUsersResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users-ops",
      operationId: "op-find-all",
      functionRef: {
        name: "findAllUsers",
        importPath: "@workspace/db/helpers/user",
      },
      inputBindings: [],
    };

    const step1Paginated: PipelineStepDraft = {
      id: "step-1",
      name: "findAllUsersResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users-ops",
      operationId: "op-find-all",
      functionRef: {
        name: "findAllUsers",
        importPath: "@workspace/db/helpers/user",
      },
      inputBindings: [],
    };

    const step1Create: PipelineStepDraft = {
      id: "step-1",
      name: "createUserResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-users-ops",
      operationId: "op-create",
      functionRef: {
        name: "createUser",
        importPath: "@workspace/db/helpers/user",
      },
      inputBindings: [],
    };

    const { rerender } = render(
      React.createElement(DbOperationStepSection, {
        step: step1Paginated,
        allSteps: [step1Paginated, anotherPaginatedStep],
        allNodes: [tableWithOps],
        allEdges: [],
        selectedDbId: "all",
        showAdvancedSettings: false,
        onToggleAdvancedSettings: vi.fn(),
        onChange: vi.fn(),
        endpoint: initialEndpoint2,
        onEndpointChange,
        expectedArgs: [],
      })
    );

    onEndpointChange.mockClear();

    // Now switch step 1 to non-fetch (create)
    rerender(
      React.createElement(DbOperationStepSection, {
        step: step1Create,
        allSteps: [step1Create, anotherPaginatedStep],
        allNodes: [tableWithOps],
        allEdges: [],
        selectedDbId: "all",
        showAdvancedSettings: false,
        onToggleAdvancedSettings: vi.fn(),
        onChange: vi.fn(),
        endpoint: initialEndpoint2,
        onEndpointChange,
        expectedArgs: [],
      })
    );

    // Because anotherPaginatedStep is present, onEndpointChange must NOT prune limit and offset
    expect(onEndpointChange).not.toHaveBeenCalled();
  });
});


