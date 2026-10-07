import { describe, it, expect } from "vitest";
import { renderPipeline, renderPipelineStep } from "../generators/routeGenerator/pipeline";
import { PipelineStep } from "@workspace/canvas/types";
import { getAvailableSources, getPriorMutableVariables } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/pipeline-step-editor/utils";

describe("compileVariablePipelineStep", () => {
  it("renders a mutable variable declaration (let)", () => {
    const step: PipelineStep = {
      id: "var-1",
      name: "Initialize count",
      type: "variable",
      outputVariable: "count",
      declarationKind: "let",
      variableOperation: "declare",
      variableDataType: "number",
      variableSource: { kind: "inline", value: 0 },
    };

    const lines = renderPipelineStep(step, {
      priorOutputs: new Map(),
      bodyVar: "body",
    });

    expect(lines).toEqual(["let count: number = 0;"]);
  });

  it("renders an immutable variable declaration (const)", () => {
    const step: PipelineStep = {
      id: "var-2",
      name: "Tax rate",
      type: "variable",
      outputVariable: "taxRate",
      declarationKind: "const",
      variableOperation: "declare",
      variableDataType: "number",
      variableSource: { kind: "inline", value: 0.08 },
    };

    const lines = renderPipelineStep(step, {
      priorOutputs: new Map(),
      bodyVar: "body",
    });

    expect(lines).toEqual(["const taxRate: number = 0.08;"]);
  });

  it("renders an uninitialized mutable variable declaration", () => {
    const step: PipelineStep = {
      id: "var-3",
      name: "Result placeholder",
      type: "variable",
      outputVariable: "pendingOrder",
      declarationKind: "let",
      variableOperation: "declare",
      variableDataType: "Order | null",
    };

    const lines = renderPipelineStep(step, {
      priorOutputs: new Map(),
      bodyVar: "body",
    });

    expect(lines).toEqual(["let pendingOrder: Order | null;"]);
  });

  it("renders variable declaration mapped from request body", () => {
    const step: PipelineStep = {
      id: "var-4",
      name: "Extract user status",
      type: "variable",
      outputVariable: "currentStatus",
      declarationKind: "let",
      variableOperation: "declare",
      variableSource: { kind: "req_body", field: "initialStatus" },
    };

    const lines = renderPipelineStep(step, {
      priorOutputs: new Map(),
      bodyVar: "body",
    });

    expect(lines).toEqual(["let currentStatus = body.initialStatus;"]);
  });

  it("renders variable assignment / update step", () => {
    const step: PipelineStep = {
      id: "var-5",
      name: "Increment counter",
      type: "variable",
      outputVariable: "count",
      variableOperation: "assign",
      variableOperator: "+=",
      variableSource: { kind: "inline", value: 1 },
    };

    const lines = renderPipelineStep(step, {
      priorOutputs: new Map(),
      bodyVar: "body",
    });

    expect(lines).toEqual(["count += 1;"]);
  });

  it("renders transform step with declarationKind = 'reassign'", () => {
    const step: PipelineStep = {
      id: "step-transform-1",
      name: "Format user",
      type: "transform",
      outputVariable: "userData",
      declarationKind: "reassign",
      functionRef: {
        name: "formatUserData",
        importPath: "@/transformers/formatUserData",
      },
      inputBindings: [
        { argName: "data", source: { kind: "req_body", field: "user" } },
      ],
    };

    const lines = renderPipelineStep(step, {
      priorOutputs: new Map(),
      bodyVar: "body",
    });

    expect(lines.join("\n")).toContain("userData = formatUserData(");
    expect(lines.join("\n")).toContain("data: body.user");
  });

  it("renders async operation with declarationKind = 'reassign'", () => {
    const step: PipelineStep = {
      id: "step-db-1",
      name: "Update order",
      type: "db_operation",
      outputVariable: "order",
      declarationKind: "reassign",
      functionRef: {
        name: "updateOrder",
        importPath: "@/db/orderOperations",
      },
      inputBindings: [
        { argName: "id", source: { kind: "req_params", field: "orderId" } },
      ],
    };

    const lines = renderPipelineStep(step, {
      priorOutputs: new Map(),
      bodyVar: "body",
    });

    expect(lines.join("\n")).toContain("order = await updateOrder(");
    expect(lines.join("\n")).toContain("id: req.params.orderId");
  });

  it("renders complete real-world pipeline with variable declaration, mutation, and response", () => {
    const steps: PipelineStep[] = [
      {
        id: "v1",
        name: "Declare total",
        type: "variable",
        outputVariable: "total",
        declarationKind: "let",
        variableOperation: "declare",
        variableDataType: "number",
        variableSource: { kind: "inline", value: 0 },
      },
      {
        id: "t1",
        name: "Calculate tax",
        type: "transform",
        outputVariable: "tax",
        declarationKind: "const",
        functionRef: {
          name: "calculateTax",
          importPath: "@/utils/tax",
        },
        inputBindings: [
          { argName: "baseAmount", source: { kind: "req_body", field: "amount" } },
        ],
      },
      {
        id: "v2",
        name: "Update total with tax",
        type: "variable",
        outputVariable: "total",
        variableOperation: "assign",
        variableOperator: "=",
        variableSource: { kind: "step_output", stepId: "t1" },
      },
      {
        id: "r1",
        name: "Return response",
        type: "return_response",
        statusCode: 200,
        inputBindings: [
          { argName: "total", source: { kind: "step_output", stepId: "v1" } },
        ],
      },
    ];

    const lines = renderPipeline(steps, "body");
    const code = lines.join("\n");

    expect(code).toContain("let total: number = 0;");
    expect(code).toContain("const tax = calculateTax(");
    expect(code).toContain("total = tax;");
    expect(code).toContain("return res.status(200).json({");
  });

  it("adds declared variables to getAvailableSources for downstream steps", () => {
    const priorSteps: PipelineStep[] = [
      {
        id: "v-declared",
        name: "Order total",
        type: "variable",
        outputVariable: "orderTotal",
        declarationKind: "let",
        variableOperation: "declare",
        variableDataType: "number",
      },
      {
        id: "v-assigned",
        name: "Mutate total",
        type: "variable",
        outputVariable: "orderTotal",
        variableOperation: "assign",
      },
    ];

    const sources = getAvailableSources(undefined, priorSteps, []);
    const varSource = sources.find((s) => s.variableName === "orderTotal");

    expect(varSource).toBeDefined();
    expect(varSource?.label).toContain("Variable: orderTotal (let)");
  });

  it("collects prior mutable variables correctly via getPriorMutableVariables", () => {
    const priorSteps: PipelineStep[] = [
      {
        id: "v1",
        name: "Let variable",
        type: "variable",
        outputVariable: "counter",
        declarationKind: "let",
        variableOperation: "declare",
        variableDataType: "number",
      },
      {
        id: "v2",
        name: "Const variable",
        type: "variable",
        outputVariable: "MAX_LIMIT",
        declarationKind: "const",
        variableOperation: "declare",
      },
      {
        id: "s1",
        name: "Let operation",
        type: "db_operation",
        outputVariable: "activeUser",
        declarationKind: "let",
      },
    ];

    const mutables = getPriorMutableVariables(priorSteps);
    expect(mutables.map((m) => m.name)).toEqual(["counter", "activeUser"]);
  });
});
