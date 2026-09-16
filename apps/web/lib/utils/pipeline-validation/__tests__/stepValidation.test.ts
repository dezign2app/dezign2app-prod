import { describe, it, expect } from "vitest";
import { isBindingSourceConfigured, isStepInputUnconfigured } from "../stepValidation";
import { PipelineStepDraft } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/pipeline-step-editor/types";

describe("pipeline-validation: isBindingSourceConfigured", () => {
  it("treats whole payload (field: '') as configured for req_body", () => {
    expect(
      isBindingSourceConfigured({
        argName: "payload",
        source: { kind: "req_body", field: "" },
      }),
    ).toBe(true);
  });

  it("treats specific field path as configured for req_body", () => {
    expect(
      isBindingSourceConfigured({
        argName: "message",
        source: { kind: "req_body", field: "message" },
      }),
    ).toBe(true);
  });

  it("treats whole step output (field: '') as configured for step_output", () => {
    expect(
      isBindingSourceConfigured({
        argName: "payload",
        source: { kind: "step_output", stepId: "step-1", field: "" },
      }),
    ).toBe(true);
  });

  it("treats empty stepId as unconfigured for step_output", () => {
    expect(
      isBindingSourceConfigured({
        argName: "payload",
        source: { kind: "step_output", stepId: "", field: "" },
      }),
    ).toBe(false);
  });

  it("treats non-empty inline value as configured", () => {
    expect(
      isBindingSourceConfigured({
        argName: "key",
        source: { kind: "inline", value: "custom-value" },
      }),
    ).toBe(true);
  });

  it("treats empty inline value as unconfigured", () => {
    expect(
      isBindingSourceConfigured({
        argName: "key",
        source: { kind: "inline", value: "" },
      }),
    ).toBe(false);
  });
});

describe("pipeline-validation: isStepInputUnconfigured for push_to_client", () => {
  it("returns false (configured) when bound to whole event payload", () => {
    const step: PipelineStepDraft = {
      id: "step-push-1",
      name: "pushDelivery",
      type: "push_to_client",
      enabled: true,
      clientDeliveryTargetPageId: "webpage-root",
      clientDeliveryProtocol: "SSE",
      clientDeliveryEventName: "message.sent.notification",
      inputBindings: [
        {
          argName: "payload",
          source: { kind: "req_body", field: "" },
        },
      ],
    };

    expect(isStepInputUnconfigured(step, [])).toBe(false);
  });

  it("returns false (configured) when bound to individual schema fields", () => {
    const step: PipelineStepDraft = {
      id: "step-push-1",
      name: "pushDelivery",
      type: "push_to_client",
      enabled: true,
      clientDeliveryTargetPageId: "webpage-root",
      clientDeliveryProtocol: "SSE",
      clientDeliveryEventName: "message.sent.notification",
      inputBindings: [
        {
          argName: "message",
          source: { kind: "req_body", field: "message" },
        },
        {
          argName: "sender",
          source: { kind: "req_body", field: "sender" },
        },
        {
          argName: "conversation_id",
          source: { kind: "req_body", field: "conversation_id" },
        },
      ],
    };

    expect(isStepInputUnconfigured(step, [])).toBe(false);
  });

  it("returns true (unconfigured) when no input bindings exist", () => {
    const step: PipelineStepDraft = {
      id: "step-push-1",
      name: "pushDelivery",
      type: "push_to_client",
      enabled: true,
      clientDeliveryTargetPageId: "webpage-root",
      clientDeliveryProtocol: "SSE",
      inputBindings: [],
    };

    expect(isStepInputUnconfigured(step, [])).toBe(true);
  });

  it("returns true (unconfigured) when target page is missing", () => {
    const step: PipelineStepDraft = {
      id: "step-push-1",
      name: "pushDelivery",
      type: "push_to_client",
      enabled: true,
      clientDeliveryProtocol: "SSE",
      inputBindings: [
        {
          argName: "payload",
          source: { kind: "req_body", field: "" },
        },
      ],
    };

    expect(isStepInputUnconfigured(step, [])).toBe(true);
  });
});

describe("pipeline-validation: isStepInputUnconfigured for db_operation", () => {
  const mockTableNode = {
    id: "table-conversations",
    type: "entity",
    data: {
      label: "conversations",
      tableRef: "conversations",
      columns: [
        { name: "id", type: "string", isPrimaryKey: true },
        { name: "title", type: "string", isNotNull: true },
        { name: "description", type: "string", isNotNull: false },
      ],
    },
  } as any;

  it("returns false (configured, no error) for findAll function with zero arguments", () => {
    const step: PipelineStepDraft = {
      id: "step-db-1",
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

    expect(isStepInputUnconfigured(step, [mockTableNode])).toBe(false);
  });

  it("returns false (configured) for findAll function when optional limit/offset are mapped", () => {
    const step: PipelineStepDraft = {
      id: "step-db-1",
      name: "findAllConversationsResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-find-all-conversations",
      functionRef: {
        name: "findAllConversations",
        importPath: "@workspace/db/helpers/conversations",
      },
      inputBindings: [
        { argName: "limit", source: { kind: "inline", value: "20" } },
      ],
    };

    expect(isStepInputUnconfigured(step, [mockTableNode])).toBe(false);
  });

  it("returns true (unconfigured error) when create operation has fields with empty map (unconfigured source)", () => {
    const step: PipelineStepDraft = {
      id: "step-db-2",
      name: "createConversationResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-create-conversations",
      functionRef: {
        name: "createConversation",
        importPath: "@workspace/db/helpers/conversations",
      },
      // Pre-populated fields with empty map
      inputBindings: [
        { argName: "title", source: { kind: "req_body", field: "" } },
        { argName: "description", source: { kind: "req_body", field: "" } },
      ],
    };

    expect(isStepInputUnconfigured(step, [mockTableNode])).toBe(true);
  });

  it("returns false (configured, no error) when create operation fields are properly mapped", () => {
    const step: PipelineStepDraft = {
      id: "step-db-2",
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

    expect(isStepInputUnconfigured(step, [mockTableNode])).toBe(false);
  });

  it("returns true (unconfigured error) when findById has empty map pk binding", () => {
    const step: PipelineStepDraft = {
      id: "step-db-3",
      name: "findConversationByIdResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-find-by-id-conversations",
      functionRef: {
        name: "findConversationById",
        importPath: "@workspace/db/helpers/conversations",
      },
      inputBindings: [
        { argName: "id", source: { kind: "req_params", field: "" } },
      ],
    };

    expect(isStepInputUnconfigured(step, [mockTableNode])).toBe(true);
  });

  it("returns false (configured, no error) when findById has properly mapped pk binding", () => {
    const step: PipelineStepDraft = {
      id: "step-db-3",
      name: "findConversationByIdResult",
      type: "db_operation",
      enabled: true,
      tableNodeId: "table-conversations",
      operationId: "auto-find-by-id-conversations",
      functionRef: {
        name: "findConversationById",
        importPath: "@workspace/db/helpers/conversations",
      },
      inputBindings: [
        { argName: "id", source: { kind: "req_params", field: "id" } },
      ],
    };

    expect(isStepInputUnconfigured(step, [mockTableNode])).toBe(false);
  });
});

describe("pipeline-validation: isStepInputUnconfigured for zero-arg transformer & redis", () => {
  it("returns false for transformer with empty inputSchema and zero bindings", () => {
    const step: PipelineStepDraft = {
      id: "step-tr-1",
      name: "transformResult",
      type: "transform",
      enabled: true,
      functionRef: {
        name: "noArgTransformer",
        importPath: "@/lib/transformers/noArgTransformer",
        inputSchema: [],
        returnSchema: [],
      },
      inputBindings: [],
    };

    expect(isStepInputUnconfigured(step, [])).toBe(false);
  });

  it("returns false for redis ping command with zero bindings", () => {
    const step: PipelineStepDraft = {
      id: "step-redis-1",
      name: "pingResult",
      type: "redis_operation",
      enabled: true,
      operationId: "ping",
      functionRef: {
        name: "redis.ping",
        importPath: "@workspace/primary-redis-cache",
      },
      inputBindings: [],
    };

    expect(isStepInputUnconfigured(step, [])).toBe(false);
  });
});
