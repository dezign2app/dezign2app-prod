import { useMemo } from "react";
import { addEdge, MarkerType } from "@xyflow/react";
import {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  StepNodeData,
  LangGraphLLMNodeData,
  ToolNodeData,
  MiddlewareNodeData,
  AgentNodeData,
  MemoryNodeData,
  OutputNodeData,
  StartNodeData,
  StepNode,
  LangGraphLLMNode,
  ToolNode,
  MiddlewareNode,
  AgentNode,
  MemoryNode,
  OutputNode,
  StartNode,
  TransformerCanvasNode,
  TransformerRefCanvasNode,
  TransformerCanvasNodeData,
  LangGraphTypesNode,
  LangGraphTypesRefNode,
  LangGraphTypesNodeData,
  LangGraphTypesRefNodeData,
  getStepData,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_STEP,
  LANGGRAPH_CANVAS_NODE_LLM,
  LANGGRAPH_CANVAS_NODE_TOOL,
  LANGGRAPH_CANVAS_NODE_MIDDLEWARE,
  LANGGRAPH_CANVAS_NODE_NODE,
  LANGGRAPH_CANVAS_NODE_AGENT,
  LANGGRAPH_CANVAS_NODE_MEMORY,
  LANGGRAPH_CANVAS_NODE_OUTPUT,
  LANGGRAPH_CANVAS_NODE_START,
  LANGGRAPH_CANVAS_NODE_TRANSFORMER,
  LANGGRAPH_CANVAS_NODE_TRANSFORMER_REF,
  LANGGRAPH_CANVAS_NODE_TYPES,
  LANGGRAPH_CANVAS_NODE_TYPES_REF,
} from "../constants";

interface UseSelectedNodeStateProps {
  nodes: LangGraphCanvasNode[];
  selectedNodeId: string | null;
  setNodes: React.Dispatch<React.SetStateAction<LangGraphCanvasNode[]>>;
  setEdges?: React.Dispatch<React.SetStateAction<LangGraphCanvasEdge[]>>;
}

export function useSelectedNodeState({
  nodes,
  selectedNodeId,
  setNodes,
  setEdges,
}: UseSelectedNodeStateProps) {
  const selectedStepData = useMemo((): StepNodeData | null => {
    const found = nodes.find(
      (n) => n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_STEP,
    );
    return found ? getStepData(found) : null;
  }, [nodes, selectedNodeId]);

  const selectedLLMData = useMemo((): LangGraphLLMNodeData | null => {
    const found = nodes.find(
      (n): n is LangGraphLLMNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_LLM,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedToolData = useMemo((): ToolNodeData | null => {
    const found = nodes.find(
      (n): n is ToolNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_TOOL,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedMiddlewareData = useMemo((): MiddlewareNodeData | null => {
    const found = nodes.find(
      (n): n is MiddlewareNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedAgentData = useMemo((): AgentNodeData | null => {
    const found = nodes.find(
      (n): n is AgentNode =>
        n.id === selectedNodeId &&
        (n.type === LANGGRAPH_CANVAS_NODE_NODE ||
          n.type === LANGGRAPH_CANVAS_NODE_AGENT),
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedMemoryData = useMemo((): MemoryNodeData | null => {
    const found = nodes.find(
      (n): n is MemoryNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_MEMORY,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedOutputData = useMemo((): OutputNodeData | null => {
    const found = nodes.find(
      (n): n is OutputNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_OUTPUT,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedStartData = useMemo((): StartNodeData | null => {
    const found = nodes.find(
      (n): n is StartNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_START,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedTransformerData = useMemo((): TransformerCanvasNodeData | null => {
    const found = nodes.find(
      (n): n is TransformerCanvasNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_TRANSFORMER,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedTransformerRefData = useMemo((): TransformerCanvasNodeData | null => {
    const found = nodes.find(
      (n): n is TransformerRefCanvasNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_TRANSFORMER_REF,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedTypesData = useMemo((): LangGraphTypesNodeData | null => {
    const found = nodes.find(
      (n): n is LangGraphTypesNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_TYPES,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const selectedTypesRefData = useMemo((): LangGraphTypesRefNodeData | null => {
    const found = nodes.find(
      (n): n is LangGraphTypesRefNode =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_TYPES_REF,
    );
    return found ? found.data : null;
  }, [nodes, selectedNodeId]);

  const updateSelectedTransformer = (changes: Partial<TransformerCanvasNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId &&
        (n.type === LANGGRAPH_CANVAS_NODE_TRANSFORMER ||
          n.type === LANGGRAPH_CANVAS_NODE_TRANSFORMER_REF)
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const updateSelectedTypes = (changes: Partial<LangGraphTypesNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_TYPES
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const updateSelectedTypesRef = (changes: Partial<LangGraphTypesRefNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_TYPES_REF
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const updateSelectedMiddleware = (changes: Partial<MiddlewareNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const updateSelectedMemory = (changes: Partial<MemoryNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_MEMORY
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const updateSelectedOutput = (changes: Partial<OutputNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_OUTPUT) {
          const updatedNode: OutputNode = {
            ...n,
            type: LANGGRAPH_CANVAS_NODE_OUTPUT,
            data: { ...n.data, ...changes },
          };
          return updatedNode;
        }
        return n;
      }),
    );

    if ("sourceStepId" in changes && setEdges) {
      const targetNodeId = selectedNodeId;
      const newSourceId = changes.sourceStepId;
      setEdges((eds) => {
        const filtered = eds.filter((e) => e.target !== targetNodeId);
        if (newSourceId && typeof newSourceId === "string" && newSourceId.trim().length > 0) {
          const edgeId = `edge_${newSourceId}_to_${targetNodeId}`;
          const newEdge: LangGraphCanvasEdge = {
            id: edgeId,
            source: newSourceId,
            sourceHandle: "out",
            target: targetNodeId,
            targetHandle: "in",
            animated: true,
            style: { stroke: "#a1a1aa", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: "#a1a1aa",
            },
          };
          return addEdge(newEdge, filtered);
        }
        return filtered;
      });
    }
  };

  const updateSelectedAgent = (changes: Partial<AgentNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId &&
        (n.type === LANGGRAPH_CANVAS_NODE_NODE ||
          n.type === LANGGRAPH_CANVAS_NODE_AGENT)
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const updateSelectedStep = (changes: Partial<StepNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_STEP
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const updateSelectedLLM = (changes: Partial<LangGraphLLMNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_LLM
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const updateSelectedTool = (changes: Partial<ToolNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId && n.type === LANGGRAPH_CANVAS_NODE_TOOL
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  return {
    selectedStepData,
    selectedLLMData,
    selectedToolData,
    selectedMiddlewareData,
    selectedAgentData,
    selectedMemoryData,
    selectedOutputData,
    selectedStartData,
    selectedTransformerData,
    selectedTransformerRefData,
    selectedTypesData,
    selectedTypesRefData,
    updateSelectedStep,
    updateSelectedLLM,
    updateSelectedTool,
    updateSelectedMiddleware,
    updateSelectedAgent,
    updateSelectedMemory,
    updateSelectedOutput,
    updateSelectedTransformer,
    updateSelectedTypes,
    updateSelectedTypesRef,
  };
}
