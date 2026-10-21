import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentAddStepToolbar } from "../AgentAddStepToolbar";
import { ADDABLE_LANGGRAPH_STEP_TYPES, LANGGRAPH_STEP_META } from "../stepTypes";
import type { LangGraphNodePipelineStep } from "@workspace/canvas";

describe("AgentAddStepToolbar", () => {
  it("renders all addable step buttons with their labels", () => {
    const handleAddStep = vi.fn();
    const activeSteps: LangGraphNodePipelineStep[] = [];

    render(
      <AgentAddStepToolbar
        stepCount={0}
        activePipelineSteps={activeSteps}
        onAddStep={handleAddStep}
      />
    );

    // Verify key step types from PipelineStepEditor are rendered
    expect(screen.getByText("LLM Agent")).toBeDefined();
    expect(screen.getByText("Transformer")).toBeDefined();
    expect(screen.getByText("DB Operation")).toBeDefined();
    expect(screen.getByText("Redis")).toBeDefined();
    expect(screen.getByText("Storage")).toBeDefined();
    expect(screen.getByText("Kafka Publish")).toBeDefined();
    expect(screen.getByText("External API Call")).toBeDefined();
    expect(screen.getByText("Service Call")).toBeDefined();
    expect(screen.getByText("Variable")).toBeDefined();
    expect(screen.queryByText("Custom Code")).toBeNull();
    expect(screen.getByText("If / Else")).toBeDefined();
    expect(screen.getByText("Try / Catch")).toBeDefined();
    expect(screen.queryByText("Push to Client")).toBeNull();

    // Verify total count matches ADDABLE_LANGGRAPH_STEP_TYPES
    expect(ADDABLE_LANGGRAPH_STEP_TYPES.length).toBe(11);
  });

  it("calls onAddStep with the correct type when clicked", () => {
    const handleAddStep = vi.fn();
    const activeSteps: LangGraphNodePipelineStep[] = [];

    render(
      <AgentAddStepToolbar
        stepCount={0}
        activePipelineSteps={activeSteps}
        onAddStep={handleAddStep}
      />
    );

    // Click DB Operation button
    const dbBtn = screen.getByText("DB Operation").closest("button");
    expect(dbBtn).not.toBeNull();
    fireEvent.click(dbBtn!);
    expect(handleAddStep).toHaveBeenCalledWith("db_operation");

    // Click Kafka Publish button
    const kafkaBtn = screen.getByText("Kafka Publish").closest("button");
    expect(kafkaBtn).not.toBeNull();
    fireEvent.click(kafkaBtn!);
    expect(handleAddStep).toHaveBeenCalledWith("kafka_publish");

    // Click External API button
    const apiBtn = screen.getByText("External API Call").closest("button");
    expect(apiBtn).not.toBeNull();
    fireEvent.click(apiBtn!);
    expect(handleAddStep).toHaveBeenCalledWith("external_call");
  });

  it("displays step counts when steps are already configured", () => {
    const activeSteps: LangGraphNodePipelineStep[] = [
      { id: "db_1", type: "db_operation", label: "DB Operation 1", name: "DB Operation 1" },
      { id: "db_2", type: "db_operation", label: "DB Operation 2", name: "DB Operation 2" },
      { id: "kafka_1", type: "kafka_publish", label: "Kafka Publish 1", name: "Kafka Publish 1" },
    ];

    render(
      <AgentAddStepToolbar
        stepCount={activeSteps.length}
        activePipelineSteps={activeSteps}
        onAddStep={vi.fn()}
      />
    );

    expect(screen.getByText("3 Steps Configured")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined(); // DB count badge
    expect(screen.getByText("1")).toBeDefined(); // Kafka count badge
  });
});
