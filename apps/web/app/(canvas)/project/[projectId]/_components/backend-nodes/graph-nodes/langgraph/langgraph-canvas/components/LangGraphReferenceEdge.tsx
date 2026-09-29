import React from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  useReactFlow,
} from "@xyflow/react";

export const LangGraphReferenceEdge: React.FC<EdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
  data,
}) => {
  const { getNodes } = useReactFlow();
  const allNodes = getNodes();
  const sourceNode = allNodes.find((n) => n.id === source);
  const targetNode = allNodes.find((n) => n.id === target);

  const isActive = Boolean(
    (data as Record<string, unknown> | undefined)?.isActive,
  );

  const isVisible = Boolean(
    isActive ||
      selected ||
      sourceNode?.selected ||
      targetNode?.selected,
  );

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  if (!isVisible) {
    return null;
  }

  const isLLM = id.includes("llm") || source.startsWith("llm_");
  const color = isLLM ? "#38bdf8" : "#10b981"; // sky-400 for LLM, emerald-500 for Tool
  const glowColor = isLLM ? "#38bdf825" : "#10b98125";

  return (
    <g className="react-flow__edge-langgraph-reference pointer-events-none">
      {/* Background glow */}
      <BaseEdge
        path={edgePath}
        style={{
          strokeWidth: 5,
          stroke: glowColor,
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
      />
      {/* Main dotted reference line */}
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: color,
          strokeDasharray: "4 4",
        }}
      />
    </g>
  );
};
