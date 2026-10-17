import React from "react";
import { NodeProps } from "@xyflow/react";
import type { CanvasNode } from "@workspace/canvas";
import {
  useLangGraphCanvasNode,
  NodeHandles,
  NodeHeader,
  NodeResourceBadges,
} from "./langgraph-canvas-node";

export const LangGraphCanvasNode = (props: NodeProps<CanvasNode>) => {
  const { data, selected } = props;
  const {
    isEditingName,
    setIsEditingName,
    nameValue,
    setNameValue,
    handleDelete,
    handleNameSave,
    boundLLMs,
    boundTools,
    boundMiddlewares,
    boundStateReducers,
    llmConfig,
    middlewareConfig,
  } = useLangGraphCanvasNode(props);

  return (
    <div
      className={`rounded-xl bg-card border-2 min-w-[340px] max-w-[440px] flex flex-col transition-all duration-200 shadow-md relative group ${
        selected
          ? "border-sky-500 ring-2 ring-sky-500/20 shadow-sky-500/10"
          : "border-border hover:border-sky-500/40 hover:shadow-sky-500/5"
      }`}
    >
      <NodeHandles />

      <NodeHeader
        isEditingName={isEditingName}
        setIsEditingName={setIsEditingName}
        nameValue={nameValue}
        setNameValue={setNameValue}
        handleNameSave={handleNameSave}
        dataName={data.name}
        handleDelete={handleDelete}
      />

      {/* Body */}
      <div className="p-3 flex flex-col gap-3">
        <NodeResourceBadges
          boundLLMs={boundLLMs}
          boundTools={boundTools}
          boundMiddlewares={boundMiddlewares}
          boundStateReducers={boundStateReducers}
          llmConfig={llmConfig}
          middlewareConfig={middlewareConfig}
        />
      </div>
    </div>
  );
};
