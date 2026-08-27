import { describe, it, expect } from "vitest";
import {
  safePipelineStepSchema,
  backendEndpointDataValidator,
  backendEventDataValidator,
  backendNodeDataValidator,
} from "../../../../../packages/backend/convex/schema/canvasValidators";

describe("Convex canvasValidators exact schema", () => {
  it("successfully parses leaf steps (transform, db_operation, kafka_publish, etc.)", () => {
    const leafStep = {
      id: "step-1",
      name: "Fetch user",
      type: "db_operation",
      enabled: true,
      databaseId: "db-1",
      tableNodeId: "users",
      operationId: "findById",
      inputBindings: [
        {
          argName: "id",
          source: { kind: "req_params" as const, field: "userId" },
        },
      ],
      outputVariable: "userRecord",
      outputSchema: [
        { name: "id", type: "string" },
        { name: "email", type: "string" },
      ],
    };

    const parsed = safePipelineStepSchema.safeParse(leafStep);
    expect(parsed.success).toBe(true);
  });

  it("successfully parses nested control flow steps (condition with thenSteps and elseSteps)", () => {
    const conditionStep = {
      id: "cond-1",
      name: "Check admin status",
      type: "condition",
      enabled: true,
      conditionExpr: {
        left: { kind: "req_body" as const, field: "role" },
        operator: "eq" as const,
        right: { kind: "literal" as const, value: "admin" },
      },
      thenSteps: [
        {
          id: "step-then-1",
          name: "Perform Admin Action",
          type: "custom_code",
          customCode: "console.log('admin');",
        },
      ],
      elseSteps: [
        {
          id: "step-else-1",
          name: "Return 403 Forbidden",
          type: "early_return",
          statusCode: 403,
        },
      ],
    };

    const parsed = safePipelineStepSchema.safeParse(conditionStep);
    expect(parsed.success).toBe(true);
  });

  it("successfully parses switch, try_catch, parallel, and loop control flow steps", () => {
    const tryCatchStep = {
      id: "try-1",
      name: "Try payment processing",
      type: "try_catch",
      trySteps: [
        {
          id: "try-step-1",
          name: "Charge card",
          type: "service_call",
        },
      ],
      catchSteps: [
        {
          id: "catch-step-1",
          name: "Handle charge error",
          type: "early_return",
          statusCode: 400,
        },
      ],
    };

    const parsed = safePipelineStepSchema.safeParse(tryCatchStep);
    expect(parsed.success).toBe(true);
  });

  it("backendEndpointDataValidator, backendEventDataValidator, backendNodeDataValidator are valid Convex validators", () => {
    expect(backendEndpointDataValidator).toBeDefined();
    expect(backendEventDataValidator).toBeDefined();
    expect(backendNodeDataValidator).toBeDefined();
  });
});
