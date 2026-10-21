import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReturnResponseStepRow } from "../pipeline-step-editor/ReturnResponseStepRow";
import { RequestBodyEditor } from "../RequestBodyEditor";
import { ResponseBodyEditor } from "../ResponseBodyEditor";
import { renderResponseStep } from "@/lib/compiler/generators/routeGenerator/pipeline/renderers/compileResponseStep";
import { PipelineStepDraft } from "../pipeline-step-editor/types";
import { Endpoint, Schema } from "@/types/canvas";
import type { PipelineStep } from "@workspace/canvas/types";
import type { PipelineRenderContext } from "@/lib/compiler/generators/routeGenerator/pipeline/types";

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="mock-select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button role="combobox" className={className}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) => (
    <span>{children || placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="mock-select-item" data-value={value}>
      {children}
    </div>
  ),
}));

vi.mock("../pipeline-step-editor/BindingSourceEditor", () => ({
  BindingSourceEditor: () => <div data-testid="mock-binding-source-editor" />,
}));

vi.mock("../TypeCombobox", () => ({
  TypeCombobox: ({ value }: { value: string }) => (
    <div data-testid="mock-type-combobox" data-value={value}>
      {value}
    </div>
  ),
}));

describe("Field Mapping Validation", () => {
  describe("ReturnResponseStepRow", () => {
    it("renders duplicate field key warning when two bindings share the same key name", () => {
      const step: PipelineStepDraft = {
        id: "step_ret",
        name: "Return Response",
        type: "return_response",
        enabled: true,
        statusCode: 201,
        inputBindings: [
          {
            argName: "data",
            source: { kind: "auth", field: "" },
          },
          {
            argName: "data",
            source: { kind: "auth", field: "" },
          },
        ],
      };

      render(
        <ReturnResponseStepRow
          step={step}
          priorSteps={[]}
          allNodes={[]}
          onChange={vi.fn()}
        />,
      );

      const warnings = screen.getAllByText(/Duplicate response field "data"/i);
      expect(warnings.length).toBe(2);
    });

    it("deduplicates fields when syncing to endpoint responseBody", () => {
      const capturedChanges: Partial<Endpoint>[] = [];
      const onEndpointChange = vi.fn((changes: Partial<Endpoint>) => {
        capturedChanges.push(changes);
      });

      let updatedStep: PipelineStepDraft = {
        id: "step_ret",
        name: "Return Response",
        type: "return_response",
        enabled: true,
        statusCode: 201,
        inputBindings: [
          {
            argName: "data",
            source: { kind: "auth", field: "" },
          },
          {
            argName: "data",
            source: { kind: "req_body", field: "" },
          },
        ],
      };

      const onChange = vi.fn((s: PipelineStepDraft) => {
        updatedStep = s;
      });

      render(
        <ReturnResponseStepRow
          step={updatedStep}
          priorSteps={[]}
          allNodes={[]}
          endpoint={{ id: "ep1", name: "/test", type: "POST" }}
          onChange={onChange}
          onEndpointChange={onEndpointChange}
        />,
      );

      const addBtn = screen.getByText("Add field");
      fireEvent.click(addBtn);

      expect(onChange).toHaveBeenCalled();
      expect(onEndpointChange).toHaveBeenCalled();

      // The synced responseBody should have unique field names (deduplicated 'data')
      const lastChange = capturedChanges[capturedChanges.length - 1];
      const fields = lastChange?.responseBody?.fields ?? [];
      const fieldNames = fields.map((f) => f.name);
      const dataOccurrences = fieldNames.filter((name) => name === "data");
      expect(dataOccurrences.length).toBe(1);
    });
  });

  describe("RequestBodyEditor", () => {
    it("renders duplicate field name warning when two fields share the same name", () => {
      const schema: Schema = {
        id: "sch_1",
        fields: [
          { id: "f1", name: "user_id", type: "string", required: true },
          { id: "f2", name: "user_id", type: "string", required: true },
        ],
      };

      render(
        <RequestBodyEditor
          mode="field_builder"
          onModeChange={vi.fn()}
          schema={schema}
          onSchemaChange={vi.fn()}
        />,
      );

      const warnings = screen.getAllByText(/Duplicate field name "user_id"/i);
      expect(warnings.length).toBe(2);
    });

    it("generates a unique field_N name when clicking Add Field", () => {
      let currentSchema: Schema = {
        id: "sch_1",
        fields: [
          { id: "f1", name: "field_1", type: "string", required: true },
          { id: "f2", name: "field_2", type: "string", required: true },
        ],
      };

      const onSchemaChange = vi.fn((s: Schema) => {
        currentSchema = s;
      });

      render(
        <RequestBodyEditor
          mode="field_builder"
          onModeChange={vi.fn()}
          schema={currentSchema}
          onSchemaChange={onSchemaChange}
        />,
      );

      const addBtn = screen.getByText("Add Field");
      fireEvent.click(addBtn);

      expect(onSchemaChange).toHaveBeenCalled();
      expect(currentSchema.fields).toHaveLength(3);
      expect(currentSchema.fields?.[2]?.name).toBe("field_3");
    });
  });

  describe("ResponseBodyEditor", () => {
    it("renders duplicate field name warning when two response fields share the same name", () => {
      const schema: Schema = {
        id: "res_1",
        fields: [
          { id: "r1", name: "status", type: "string", required: true },
          { id: "r2", name: "status", type: "string", required: false },
        ],
      };

      render(
        <ResponseBodyEditor
          mode="field_builder"
          onModeChange={vi.fn()}
          schema={schema}
          onSchemaChange={vi.fn()}
        />,
      );

      const warnings = screen.getAllByText(/Duplicate field name "status"/i);
      expect(warnings.length).toBe(2);
    });
  });

  describe("renderResponseStep Compiler", () => {
    it("deduplicates duplicate field keys when generating response json", () => {
      const step: PipelineStep = {
        id: "s1",
        name: "Return Response",
        type: "return_response",
        enabled: true,
        statusCode: 201,
        inputBindings: [
          {
            argName: "data",
            source: { kind: "auth", field: "" },
          },
          {
            argName: "data",
            source: { kind: "auth", field: "" },
          },
        ],
      };

      const ctx: PipelineRenderContext = {
        priorOutputs: new Map<string, string>(),
        bodyVar: "req.body",
      };

      const lines = renderResponseStep(step, ctx);
      const joined = lines.join("\n");

      // Verify that data is only rendered once
      const matches = joined.match(/data:/g);
      expect(matches?.length).toBe(1);
      expect(joined).toContain("return res.status(201).json({");
    });
  });
});
