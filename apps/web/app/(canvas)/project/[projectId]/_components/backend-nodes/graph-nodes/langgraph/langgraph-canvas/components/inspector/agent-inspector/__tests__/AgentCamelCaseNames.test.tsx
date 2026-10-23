import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toCamelCase } from "../AgentPromptVariablePicker";
import { deriveInitialPipelineSteps } from "../stepTypes";
import { AgentPipelineHeader } from "../AgentPipelineHeader";
import type { AgentNodeData, LangGraphNodePipelineStep } from "@workspace/canvas";

describe("CamelCase formatting for Node and Step names", () => {
  describe("toCamelCase utility", () => {
    it("converts node names to camelCase", () => {
      expect(toCamelCase("Demo Node")).toBe("demoNode");
      expect(toCamelCase("AI Agent")).toBe("aiAgent");
      expect(toCamelCase("search_assistant")).toBe("searchAssistant");
      expect(toCamelCase("My Agent Node")).toBe("myAgentNode");
    });

    it("converts step names and labels to camelCase", () => {
      expect(toCamelCase("LLM Agent")).toBe("llmAgent");
      expect(toCamelCase("Data Preparation")).toBe("dataPreparation");
      expect(toCamelCase("Response Transform")).toBe("responseTransform");
      expect(toCamelCase("Pre-processing")).toBe("preProcessing");
      expect(toCamelCase("Post-processing")).toBe("postProcessing");
      expect(toCamelCase("DB Operation 1")).toBe("dbOperation1");
      expect(toCamelCase("If / Else 1")).toBe("ifElse1");
      expect(toCamelCase("Try / Catch 1")).toBe("tryCatch1");
      expect(toCamelCase("Push to Client 1")).toBe("pushToClient1");
      expect(toCamelCase("Custom Code 1")).toBe("customCode1");
      expect(toCamelCase("External API 1")).toBe("externalApi1");
    });
  });

  describe("deriveInitialPipelineSteps camelCase normalization", () => {
    it("normalizes existing pipeline steps to camelCase", () => {
      const data: AgentNodeData = {
        name: "Demo Node",
        label: "Demo Node",
        pipelineSteps: [
          {
            id: "step_llm_1",
            type: "llm_call",
            label: "LLM Agent",
            name: "LLM Agent",
            outputVariable: "response_data",
          },
          {
            id: "step_db_1",
            type: "db_operation",
            label: "DB Operation 1",
            name: "DB Operation 1",
            outputVariable: "db_result_1",
          },
        ],
      };

      const steps = deriveInitialPipelineSteps(data);
      expect(steps[0]?.label).toBe("llmAgent");
      expect(steps[0]?.name).toBe("llmAgent");
      expect(steps[0]?.outputVariable).toBe("responseData");
      expect(steps[1]?.label).toBe("dbOperation1");
      expect(steps[1]?.name).toBe("dbOperation1");
      expect(steps[1]?.outputVariable).toBe("dbResult1");
    });

    it("creates inferred initial steps in camelCase", () => {
      const data: AgentNodeData = {
        name: "Demo Node",
        label:"Demo Node",
        llmConfig: { enabled: true },
      };

      const steps = deriveInitialPipelineSteps(data);
      expect(steps.length).toBe(1);
      expect(steps[0]?.type).toBe("llm_call");
      expect(steps[0]?.label).toBe("llmAgent");
      expect(steps[0]?.name).toBe("llmAgent");
      expect(steps[0]?.outputVariable).toBe("response");
    });
  });

  describe("AgentPipelineHeader camelCase behavior", () => {
    it("automatically normalizes non-camelCase node name on mount", () => {
      const onUpdateAgent = vi.fn();
      const selectedAgentData: AgentNodeData = {
        name: "Demo Node",
        label: "Demo Node",
      };

      render(
        <AgentPipelineHeader
          selectedAgentData={selectedAgentData}
          onUpdateAgent={onUpdateAgent}
          onDeleteAgent={vi.fn()}
          activePipelineSteps={[]}
          expandedSteps={{}}
          onToggleStep={vi.fn()}
          allOpen={false}
          onCollapseAll={vi.fn()}
          onExpandAll={vi.fn()}
          isStateUpdatesOpen={false}
          onToggleStateUpdates={vi.fn()}
          isStateUpdatesEnabled={false}
        />
      );

      expect(onUpdateAgent).toHaveBeenCalledWith({ name: "demoNode" });
    });

    it("renders stepper navigation pills in camelCase", () => {
      const activeSteps: LangGraphNodePipelineStep[] = [
        {
          id: "step_1",
          type: "llm_call",
          label: "LLM Agent",
          name: "LLM Agent",
        },
      ];

      render(
        <AgentPipelineHeader
          selectedAgentData={{ name: "demoNode", label:"Demo Node" }}
          onUpdateAgent={vi.fn()}
          onDeleteAgent={vi.fn()}
          activePipelineSteps={activeSteps}
          expandedSteps={{ step_1: true }}
          onToggleStep={vi.fn()}
          allOpen={true}
          onCollapseAll={vi.fn()}
          onExpandAll={vi.fn()}
          isStateUpdatesOpen={false}
          onToggleStateUpdates={vi.fn()}
          isStateUpdatesEnabled={false}
        />
      );

      // Stepper pill should display "llmAgent" rather than "LLM Agent"
      expect(screen.getByText("llmAgent")).toBeDefined();
    });

    it("formats node name to camelCase on input blur", () => {
      const onUpdateAgent = vi.fn();
      const selectedAgentData: AgentNodeData = {
        name: "demoNode",
        label: "demoNode",
      };

      render(
        <AgentPipelineHeader
          selectedAgentData={selectedAgentData}
          onUpdateAgent={onUpdateAgent}
          onDeleteAgent={vi.fn()}
          activePipelineSteps={[]}
          expandedSteps={{}}
          onToggleStep={vi.fn()}
          allOpen={false}
          onCollapseAll={vi.fn()}
          onExpandAll={vi.fn()}
          isStateUpdatesOpen={false}
          onToggleStateUpdates={vi.fn()}
          isStateUpdatesEnabled={false}
        />
      );

      const input = screen.getByTitle("Edit Node Name");
      fireEvent.change(input, { target: { value: "My New Node" } });
      fireEvent.blur(input);

      expect(onUpdateAgent).toHaveBeenCalledWith({ name: "myNewNode" });
    });
  });
});
