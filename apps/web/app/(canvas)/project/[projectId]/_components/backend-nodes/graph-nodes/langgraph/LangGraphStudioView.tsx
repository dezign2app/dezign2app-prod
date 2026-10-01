import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Layout, AlertTriangle } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import type { BackendNode } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { useLangGraphAutoLayout } from "../../../hooks/useAutoLayout";
import { langGraphCanvasNodeTypes } from "./langgraph-canvas/nodes";
import { useLangGraphCanvasState } from "./langgraph-canvas/hooks/useLangGraphCanvasState";
import { LangGraphCanvasHeader } from "./langgraph-canvas/components/LangGraphCanvasHeader";
import { ToolsSidebar } from "./langgraph-canvas/components/ToolsSidebar";
import { InspectorSidebar } from "./langgraph-canvas/components/InspectorSidebar";
import { LangGraphReferenceEdge } from "./langgraph-canvas/components/LangGraphReferenceEdge";
import { Terminal } from "../../../terminal/Terminal";
import { CompilerDialog } from "../../../compiler";
import { compileLangGraph } from "@/lib/compiler";
import { simulateLangGraphTestCase } from "@/lib/simulation/runtime";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import {
  executeBrowserLangGraph,
  type BrowserExecutionResult,
} from "@/lib/simulation/browserLangGraphRunner";
import type { SimulationTestCase } from "@workspace/canvas";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
} from "./langgraph-canvas/types";
import type { LangGraphStepConfig } from "@/types/canvas";
import {
  HANDLE_LLM_IN,
  HANDLE_TOOL_IN,
  HANDLE_MIDDLEWARE_IN,
  HANDLE_MEMORY_IN,
} from "./langgraph-canvas/constants";

import { useConnectedRoutes } from "./LangGraphNode";

const langGraphCanvasEdgeTypes = {
  "langgraph-reference": LangGraphReferenceEdge,
};

interface LangGraphStudioViewProps {
  node: BackendNode;
  onClose: () => void;
  projectId?: string;
}

export function LangGraphStudioView({
  node,
  onClose,
  projectId: propProjectId,
}: LangGraphStudioViewProps) {
  const params = useParams();
  const routeProjectId = (params?.projectId as string) || "";
  const projectId = propProjectId || routeProjectId;

  const terminalOpen = useSidebarStore((s) => s.terminalOpen);
  const toggleTerminal = useSidebarStore((s) => s.toggleTerminal);
  const setProjectFolderModalOpen = useSidebarStore(
    (s) => s.setProjectFolderModalOpen,
  );

  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const connectedRoutes = useConnectedRoutes(node.id);
  const allTestCases = useSimulationStore((state) => state.testCases);
  const graphTestCases = useMemo(
    () => allTestCases.filter((testCase) => testCase.targetNodeId === node.id),
    [allTestCases, node.id],
  );

  const {
    nodes,
    edges,
    setEdges,
    inputChannels,
    setInputChannels,
    stateChannels,
    setStateChannels,
    customReducers,
    handleAddCustomReducer,
    handleUpdateCustomReducer,
    handleDeleteCustomReducer,
    memoryConfig,
    setMemoryConfig,
    selectedNodeId,
    setSelectedNodeId,
    activeSideTab,
    setActiveSideTab,
    selectedStepData,
    selectedLLMData,
    selectedToolData,
    selectedMiddlewareData,
    selectedAgentData,
    selectedMemoryData,
    selectedOutputData,
    selectedStartData,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    handleAddStep,
    updateSelectedStep,
    updateSelectedLLM,
    updateSelectedTool,
    updateSelectedMiddleware,
    updateSelectedAgent,
    updateSelectedMemory,
    updateSelectedOutput,
    handleDeleteStep,
    handleDeleteSelected,
    handleSave,
    saveStatus,
    availableLLMNodes,
    availableToolNodes,
    availableMiddlewareNodes,
    availableMemoryNodes,
    handleSelectLLMForAgent,
    handleToggleToolForAgent,
    handleToggleMiddlewareForAgent,
    handleToggleMemoryForAgent,
    showCompileModal,
    setShowCompileModal,
    suggestedParams,
  } = useLangGraphCanvasState({ node, updateNode, onClose });

  const [outputMode, setOutputMode] = useState<"app" | "package">("app");

  const { handleLayout } = useLangGraphAutoLayout({ nodes, edges, onNodesChange });

  const connectedLLMId = useMemo(() => {
    if (!selectedNodeId) return null;
    const edge = edges.find(
      (e) => e.target === selectedNodeId && e.targetHandle === HANDLE_LLM_IN,
    );
    return edge ? edge.source : null;
  }, [edges, selectedNodeId]);

  const connectedToolIds = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges
      .filter(
        (e) => e.target === selectedNodeId && e.targetHandle === HANDLE_TOOL_IN,
      )
      .map((e) => e.source);
  }, [edges, selectedNodeId]);

  const connectedMiddlewareIds = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges
      .filter(
        (e) =>
          e.target === selectedNodeId &&
          e.targetHandle === HANDLE_MIDDLEWARE_IN,
      )
      .map((e) => e.source);
  }, [edges, selectedNodeId]);

  const connectedMemoryIds = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges
      .filter(
        (e) =>
          e.target === selectedNodeId && e.targetHandle === HANDLE_MEMORY_IN,
      )
      .map((e) => e.source);
  }, [edges, selectedNodeId]);

  const connectedToolsCount = connectedToolIds.length;
  const connectedMiddlewareCount = connectedMiddlewareIds.length;
  const graphSteps = useMemo<LangGraphStepConfig[]>(
    () =>
      nodes
        .filter(
          (canvasNode) =>
            canvasNode.type === "step" ||
            canvasNode.type === "langgraph_node" ||
            canvasNode.type === "langgraph_agent",
        )
        .map((canvasNode) => {
          const data = canvasNode.data as unknown as {
            stepId?: string;
            label?: string;
            name?: string;
            stepType?: LangGraphStepConfig["type"];
            routerConfig?: LangGraphStepConfig["routerConfig"];
            stateUpdates?: LangGraphStepConfig["stateUpdates"];
            modelConfig?: LangGraphStepConfig["modelConfig"];
            customCode?: LangGraphStepConfig["customCode"];
          };
          return {
            id: canvasNode.id,
            name: data.label || data.name || canvasNode.id,
            type: data.stepType || "llm_call",
            routerConfig: data.routerConfig,
            stateUpdates: data.stateUpdates,
            modelConfig: data.modelConfig,
            customCode: data.customCode,
          };
        }),
    [nodes],
  );
  const graphPathEdges = useMemo(
    () =>
      edges.map((edge) => ({
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
      })),
    [edges],
  );
  const graphNodeLabels = useMemo(
    () =>
      Object.fromEntries(
        nodes.map((canvasNode) => [
          canvasNode.id,
          (canvasNode.data as { label?: string }).label || canvasNode.id,
        ]),
      ),
    [nodes],
  );
  const allCanvasNodes = useBackendCanvasStore((s) => s.nodes);
  const checkpointerMissingError = useMemo(() => {
    if (!memoryConfig || memoryConfig.enabled === false || memoryConfig.checkpointer === "memory") return null;
    const isPg = memoryConfig.checkpointer === "postgres";
    const isRedis = memoryConfig.checkpointer === "redis";
    if (!isPg && !isRedis) return null;

    if (!memoryConfig.checkpointerNodeId) {
      return `No ${isPg ? "PostgreSQL database" : "Redis instance"} linked from SchemaView. Please link one in the Memory tab.`;
    }
    const target = allCanvasNodes.find((n) => n.id === memoryConfig.checkpointerNodeId);
    if (!target) {
      return `Linked ${isPg ? "database" : "Redis instance"} was deleted or not found in SchemaView. Please re-link in Memory tab.`;
    }
    return null;
  }, [memoryConfig, allCanvasNodes]);

  const activeNodeIds = useSimulationStore((s) => s.activeNodeIds);
  const activeEdgeIds = useSimulationStore((s) => s.activeEdgeIds);
  const currentNodeId = useSimulationStore((s) => s.currentNodeId);
  const currentEdgeId = useSimulationStore((s) => s.currentEdgeId);

  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      if (edge.type === "langgraph-reference") {
        const isConnectedToSelected = Boolean(
          selectedNodeId &&
            (edge.source === selectedNodeId || edge.target === selectedNodeId),
        );
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        const isNodeSelected = Boolean(
          sourceNode?.selected ||
            targetNode?.selected ||
            isConnectedToSelected ||
            edge.selected,
        );

        return {
          ...edge,
          hidden: !isNodeSelected,
          data: {
            ...edge.data,
            isActive: isNodeSelected,
          },
        };
      }

      const isCurrent = currentEdgeId === edge.id;
      const isActive = activeEdgeIds.includes(edge.id);
      const strokeColor = isCurrent
        ? "#38bdf8"
        : isActive
          ? "#818cf8"
          : edge.style?.stroke || "#a1a1aa";

      return {
        ...edge,
        animated: edge.animated !== undefined ? edge.animated : true,
        style: {
          ...edge.style,
          stroke: strokeColor,
          strokeWidth: isCurrent
            ? 3.5
            : isActive
              ? 2.5
              : edge.style?.strokeWidth || 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: strokeColor,
        },
      };
    });
  }, [edges, nodes, selectedNodeId, activeEdgeIds, currentEdgeId]);

  const displayNodes = useMemo(() => {
    return nodes.map((n) => {
      const isCurrent = currentNodeId === n.id;
      const isActive = activeNodeIds.includes(n.id);
      const isPill =
        n.id === "START" || n.type === "end" || n.id.startsWith("end_");
      const baseRounded = isPill ? "rounded-full" : "rounded-2xl";
      if (!isCurrent && !isActive) {
        return {
          ...n,
          className: `${n.className || ""} ${baseRounded}`,
        };
      }

      const existingClass = n.className || "";
      return {
        ...n,
        className: `${existingClass} ${baseRounded} ${
          isCurrent
            ? "ring-4 ring-sky-400 ring-offset-2 ring-offset-background transition-all duration-300"
            : "ring-2 ring-sky-500/60 transition-all duration-300"
        }`,
      };
    });
  }, [nodes, activeNodeIds, currentNodeId]);

  const runGraphTestCase = async (testCase: SimulationTestCase) => {
    // If the test case has explicit mock overrides configured, simulate with those mocks.
    // Otherwise, execute using the real in-browser execution runner!
    const hasCustomMocks = testCase.mocks && Object.keys(testCase.mocks).length > 0;
    if (!hasCustomMocks) {
      const combinedInputs: Record<string, boolean | number | string | null | undefined> = {};
      if (testCase.initialState) {
        Object.assign(combinedInputs, testCase.initialState);
      }
      if (testCase.request?.body && typeof testCase.request.body === "object") {
        Object.assign(combinedInputs, testCase.request.body);
      }

      let execResult: BrowserExecutionResult | undefined;
      try {
        const response = await fetch("/api/langgraph/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes,
            edges,
            stateChannels,
            inputChannels,
            memoryConfig,
            inputValues: combinedInputs,
            threadId: `test-${testCase.id}`,
            provider: "groq",
            modelName: "openai/gpt-oss-120b",
          }),
        });
        if (response.ok) {
          execResult = await response.json();
        }
      } catch {
        // fallback to in-browser execution
      }

      if (!execResult) {
        execResult = await executeBrowserLangGraph({
          nodes,
          edges,
          stateChannels,
          inputChannels,
          memoryConfig,
          inputValues: combinedInputs,
          threadId: `test-${testCase.id}`,
          provider: "groq",
          modelName: "openai/gpt-oss-120b",
        });
      }

      const assertions = [
        {
          name: "execution error check",
          passed: !execResult.error,
          detail: execResult.error,
        },
        {
          name: "expected status",
          passed:
            testCase.expectedStatus === undefined ||
            testCase.expectedStatus === (execResult.error ? 500 : 200),
          detail:
            testCase.expectedStatus === undefined
              ? undefined
              : `Expected ${testCase.expectedStatus}, received ${execResult.error ? 500 : 200}`,
        },
        {
          name: "expected graph path",
          passed:
            testCase.expectedPath === undefined ||
            JSON.stringify(testCase.expectedPath) ===
              JSON.stringify(execResult.visitedNodes),
          detail:
            testCase.expectedPath === undefined
              ? undefined
              : `Expected ${JSON.stringify(testCase.expectedPath)}, received ${JSON.stringify(execResult.visitedNodes)}`,
        },
      ];

      const passed = assertions.every((a) => a.passed);
      const res = {
        status: execResult.error ? 500 : 200,
        statusText: execResult.error ? "Execution Failed" : "OK",
        headers: { "x-runtime": "browser-real" },
        body: execResult.finalState,
        trace: execResult.trace,
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        assertions,
      };
      useSimulationStore.getState().start(res.trace);
      return res;
    }

    const graphEdges = edges
      .filter(
        (edge) =>
          edge.source !== "STATE_GLOBAL" && edge.target !== "STATE_GLOBAL",
      )
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        targets: [
          {
            id: edge.target,
            kind: edge.target === "END" ? ("end" as const) : ("step" as const),
            targetHandle: edge.targetHandle,
          },
        ],
      }));
    const result = await simulateLangGraphTestCase({
      graph: { ...node, data: { ...node.data, graphSteps, graphEdges } },
      testCase,
    });
    useSimulationStore.getState().start(result.trace);
    return result;
  };

  return (
    <div
      className="flex flex-col h-screen w-screen bg-background text-foreground outline-none overflow-hidden"
      tabIndex={0}
      onKeyDown={(e) => {
        e.stopPropagation();
        const activeEl = document.activeElement as HTMLElement | null;
        if (
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.isContentEditable)
        ) {
          return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          handleDeleteSelected();
        }
      }}
    >
      {/* Header */}
      <LangGraphCanvasHeader
        label={node.data.label}
        onUpdateLabel={(newLabel) =>
          updateNode(node.id, { data: { ...node.data, label: newLabel } })
        }
        onSave={handleSave}
        onClose={onClose}
        onAutoLayout={(dir) => handleLayout(dir || "LR")}
        onCompile={() => setShowCompileModal(true)}
        saveStatus={saveStatus}
        terminalOpen={terminalOpen}
        onToggleTerminal={toggleTerminal}
      />

      {/* Checkpointer Configuration Warning Banner */}
      {checkpointerMissingError && (
        <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2 flex items-center justify-between text-xs text-destructive font-medium backdrop-blur-sm z-20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{checkpointerMissingError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2.5 py-0 border-destructive/40 text-destructive hover:bg-destructive/20"
            onClick={() => setActiveSideTab("memory")}
          >
            Configure Memory
          </Button>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Sidebar Tools */}
        <ToolsSidebar onAddStep={handleAddStep} />

        {/* Center Canvas */}
        <div className="flex-1 relative">
          <style>{`
            .react-flow__node {
              border-radius: 1rem !important;
            }
            .react-flow__node.type-start,
            .react-flow__node.type-end {
              border-radius: 9999px !important;
            }
            .react-flow__node.selected {
              border-radius: 1rem !important;
            }
          `}</style>
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={langGraphCanvasNodeTypes}
            edgeTypes={langGraphCanvasEdgeTypes}
            deleteKeyCode={["Backspace", "Delete"]}
            edgesReconnectable={true}
            edgesFocusable={true}
            elementsSelectable={true}
            minZoom={0.01}
            maxZoom={3}
            onEdgeClick={(_: React.MouseEvent, edge: LangGraphCanvasEdge) => {
              setEdges((eds) =>
                eds.map((e) => ({ ...e, selected: e.id === edge.id })),
              );
            }}
            onNodeClick={(_: React.MouseEvent, n: LangGraphCanvasNode) => {
              setSelectedNodeId(n.id);
              if (n.id === "START") setActiveSideTab("inputs");
              else if (n.id === "STATE_GLOBAL") setActiveSideTab("state");
              else setActiveSideTab("inspector");
            }}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
            }}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 0.85 }}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "#a1a1aa", strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 14,
                height: 14,
                color: "#a1a1aa",
              },
              interactionWidth: 20,
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              color="#3f3f46"
              size={1.5}
            />
            <Controls className="!bg-background !border-border !text-foreground" />
            <MiniMap
              className="!bg-background/90 !border-border"
              nodeColor="#71717a"
            />
            <Panel
              position="top-left"
              className="flex items-center gap-1.5 bg-background/95 backdrop-blur border border-border p-1 rounded-xl shadow-md"
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 font-semibold hover:bg-accent text-foreground"
                onClick={() => handleLayout("LR")}
                title="Auto Layout Left to Right"
              >
                <Layout className="w-3.5 h-3.5 text-primary" />
                Auto Layout
              </Button>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Inspector Sidebar */}
        <InspectorSidebar
          selectedNodeId={selectedNodeId}
          onClose={() => setSelectedNodeId(null)}
          activeSideTab={activeSideTab}
          setActiveSideTab={setActiveSideTab}
          selectedStepData={selectedStepData}
          selectedLLMData={selectedLLMData}
          selectedToolData={selectedToolData}
          selectedMiddlewareData={selectedMiddlewareData}
          selectedAgentData={selectedAgentData}
          selectedMemoryData={selectedMemoryData}
          selectedOutputData={selectedOutputData}
          selectedStartData={selectedStartData}
          graphNodeId={node.id}
          graphSteps={graphSteps}
          graphEdges={graphPathEdges}
          graphNodeLabels={graphNodeLabels}
          onRunTestCase={runGraphTestCase}
          connectedToolsCount={connectedToolsCount}
          connectedMiddlewareCount={connectedMiddlewareCount}
          availableLLMNodes={availableLLMNodes}
          availableToolNodes={availableToolNodes}
          availableMiddlewareNodes={availableMiddlewareNodes}
          availableMemoryNodes={availableMemoryNodes}
          connectedRoutes={connectedRoutes}
          connectedLLMId={connectedLLMId}
          connectedToolIds={connectedToolIds}
          connectedMiddlewareIds={connectedMiddlewareIds}
          connectedMemoryIds={connectedMemoryIds}
          onSelectLLM={(llmId) =>
            selectedNodeId && handleSelectLLMForAgent(selectedNodeId, llmId)
          }
          onToggleTool={(toolId, connect) =>
            selectedNodeId &&
            handleToggleToolForAgent(selectedNodeId, toolId, connect)
          }
          onToggleMiddleware={(mwId, connect) =>
            selectedNodeId &&
            handleToggleMiddlewareForAgent(selectedNodeId, mwId, connect)
          }
          onToggleMemory={(memId, connect) =>
            selectedNodeId &&
            handleToggleMemoryForAgent(selectedNodeId, memId, connect)
          }
          onDeleteStep={handleDeleteStep}
          onUpdateStep={updateSelectedStep}
          onUpdateLLM={updateSelectedLLM}
          onUpdateTool={updateSelectedTool}
          onUpdateMiddleware={updateSelectedMiddleware}
          onUpdateAgent={updateSelectedAgent}
          onUpdateMemory={updateSelectedMemory}
          onUpdateOutput={updateSelectedOutput}
          inputChannels={inputChannels}
          setInputChannels={setInputChannels}
          stateChannels={stateChannels}
          setStateChannels={setStateChannels}
          customReducers={customReducers}
          onAddCustomReducer={handleAddCustomReducer}
          onUpdateCustomReducer={handleUpdateCustomReducer}
          onDeleteCustomReducer={handleDeleteCustomReducer}
          memoryConfig={memoryConfig}
          setMemoryConfig={setMemoryConfig}
          suggestedParams={suggestedParams}
          nodes={nodes}
          edges={edges}
          graphLabel={node.data.label}
        />
      </div>

      {/* Terminal Drawer and Dock Button */}
      {projectId && (
        <Terminal
          projectId={projectId}
          projectName={node.data.label || "LangGraph Agent"}
          onPickDirectory={() => setProjectFolderModalOpen(true)}
        />
      )}

      {/* Compiled Code Dialog */}
      <CompilerDialog
        open={showCompileModal}
        onOpenChange={setShowCompileModal}
        projectName={node.data.label || "LangGraph Agent Project"}
        overrideTitle={`${node.data.label || "LangGraph Agent"} Compiler Engine`}
        outputMode={outputMode}
        onOutputModeChange={setOutputMode}
        overrideFiles={useMemo(() => {
          if (!showCompileModal) return [];
          return compileLangGraph({
            graphLabel: node.data.label || "LangGraph Agent",
            stateChannels,
            inputChannels,
            nodes,
            edges,
            memoryConfig,
            testCases: graphTestCases,
            outputMode,
          });
        }, [
          showCompileModal,
          node.data.label,
          stateChannels,
          inputChannels,
          nodes,
          edges,
          memoryConfig,
          graphTestCases,
          outputMode,
        ])}
      />
    </div>
  );
}
