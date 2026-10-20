import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (val: string) => void }) => (
    <div data-testid="mock-select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`item-${value}`}>{children}</div>
  ),
  SelectSeparator: () => <hr />,
}));

import {
  derivePromptSources,
  extractPromptVariables,
  AgentPromptVariablePicker,
  PromptActiveVariablesBar,
} from "../AgentPromptVariablePicker";
import type {
  LangGraphStateChannel,
  LangGraphNodePipelineStep,
} from "@workspace/canvas";

describe("AgentPromptVariablePicker logic", () => {
  it("derives state source and channels correctly", () => {
    const channels: LangGraphStateChannel[] = [
      { key: "msg", type: "string", reducer: "replace" },
      { key: "user", type: "object", reducer: "merge_object" },
    ];

    const sources = derivePromptSources(channels, [], []);
    expect(sources.length).toBe(1);
    expect(sources[0]?.id).toBe("state");
    expect(sources[0]?.fields.some((f) => f.value === "msg")).toBe(true);
    expect(sources[0]?.fields.some((f) => f.value === "user")).toBe(true);
  });

  it("derives prior step sources only when prior steps exist", () => {
    const priorSteps: LangGraphNodePipelineStep[] = [
      {
        id: "step_trans_1",
        name: "Data Prep",
        type: "transformer",
        label: "Data Prep",
        outputVariable: "step1Result",
        outputSchema: [
          { name: "field1", type: "string", required: true },
          { name: "field2", type: "number", required: false },
        ],
      },
    ];

    const sources = derivePromptSources([], priorSteps, []);
    expect(sources.length).toBe(2); // state + 1 prior step
    const stepSource = sources.find((s) => s.id === "step_trans_1");
    expect(stepSource).toBeDefined();
    expect(stepSource?.outVar).toBe("step1Result");
    expect(stepSource?.fields.some((f) => f.value === "field1")).toBe(true);
  });

  it("does NOT include any step sources when priorSteps is empty", () => {
    const sources = derivePromptSources([], [], []);
    expect(sources.length).toBe(1);
    expect(sources[0]?.id).toBe("state");
    expect(sources.some((s) => s.category === "step")).toBe(false);
  });

  it("extracts unique variables from a prompt string", () => {
    const prompt =
      "Hello! Here is the user message: ${state.msg}. And step data: ${step1Result.field1}. Again: ${state.msg}";
    const extracted = extractPromptVariables(prompt);

    expect(extracted).toEqual(["${state.msg}", "${step1Result.field1}"]);
  });
});

describe("AgentPromptVariablePicker UI Component", () => {
  it("renders cascading selector and inserts variable on Add button click", () => {
    const onInsert = vi.fn();
    const channels: LangGraphStateChannel[] = [
      { key: "msg", type: "string", reducer: "replace" },
    ];

    render(
      <AgentPromptVariablePicker
        stateChannels={channels}
        priorSteps={[]}
        onInsertVariable={onInsert}
      />,
    );

    expect(screen.getByText("Variable:")).toBeDefined();
    const addBtn = screen.getByText("Add ${state.msg}");
    expect(addBtn).toBeDefined();

    fireEvent.click(addBtn);
    expect(onInsert).toHaveBeenCalledWith("${state.msg}");
  });

  it("renders active prompt variables indicator bar", () => {
    render(
      <PromptActiveVariablesBar currentPrompt="Query: ${state.msg} with result: ${step1Result.field1}" />,
    );

    expect(screen.getByText("Interpolated in prompt:")).toBeDefined();
    expect(screen.getByText("${state.msg}")).toBeDefined();
    expect(screen.getByText("${step1Result.field1}")).toBeDefined();
  });
});
