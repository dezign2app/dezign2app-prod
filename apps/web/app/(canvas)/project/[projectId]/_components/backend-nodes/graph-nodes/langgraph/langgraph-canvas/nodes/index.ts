import { LangGraphCanvasStateNode } from "./LangGraphCanvasStateNode";
import { LangGraphCanvasStartNode } from "./LangGraphCanvasStartNode";
import { LangGraphCanvasEndNode } from "./LangGraphCanvasEndNode";
import { LangGraphCanvasPortNode } from "./LangGraphCanvasPortNode";
import { LangGraphCanvasLLMNode } from "./LangGraphCanvasLLMNode";
import { LangGraphCanvasLLMRefNode } from "./LangGraphCanvasLLMRefNode";
import { LangGraphCanvasToolNode } from "./LangGraphCanvasToolNode";
import { LangGraphCanvasToolRefNode } from "./LangGraphCanvasToolRefNode";
import { LangGraphCanvasMiddlewareNode } from "./LangGraphCanvasMiddlewareNode";
import { LangGraphCanvasMiddlewareRefNode } from "./LangGraphCanvasMiddlewareRefNode";
import { LangGraphCanvasNode } from "./LangGraphCanvasNode";
import { LangGraphCanvasStepNode } from "./LangGraphCanvasStepNode";
import { LangGraphCanvasRouterNode } from "./LangGraphCanvasRouterNode";
import { LangGraphCanvasMemoryNode } from "./LangGraphCanvasMemoryNode";
import { LangGraphCanvasMemoryRefNode } from "./LangGraphCanvasMemoryRefNode";
import { LangGraphCanvasOutputNode } from "./LangGraphCanvasOutputNode";

import {
  LANGGRAPH_CANVAS_NODE_STEP,
  LANGGRAPH_CANVAS_NODE_START,
  LANGGRAPH_CANVAS_NODE_END,
  LANGGRAPH_CANVAS_NODE_PORT,
  LANGGRAPH_CANVAS_NODE_STATE_GLOBAL,
  LANGGRAPH_CANVAS_NODE_LLM,
  LANGGRAPH_CANVAS_NODE_LLM_REF,
  LANGGRAPH_CANVAS_NODE_TOOL,
  LANGGRAPH_CANVAS_NODE_TOOL_REF,
  LANGGRAPH_CANVAS_NODE_MIDDLEWARE,
  LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF,
  LANGGRAPH_CANVAS_NODE_NODE,
  LANGGRAPH_CANVAS_NODE_AGENT,
  LANGGRAPH_CANVAS_NODE_MEMORY,
  LANGGRAPH_CANVAS_NODE_MEMORY_REF,
  LANGGRAPH_CANVAS_NODE_OUTPUT,
} from "../constants";

export const langGraphCanvasNodeTypes = {
  [LANGGRAPH_CANVAS_NODE_STEP]: LangGraphCanvasStepNode,
  [LANGGRAPH_CANVAS_NODE_START]: LangGraphCanvasStartNode,
  [LANGGRAPH_CANVAS_NODE_END]: LangGraphCanvasEndNode,
  [LANGGRAPH_CANVAS_NODE_PORT]: LangGraphCanvasPortNode,
  [LANGGRAPH_CANVAS_NODE_STATE_GLOBAL]: LangGraphCanvasStateNode,
  [LANGGRAPH_CANVAS_NODE_LLM]: LangGraphCanvasLLMNode,
  [LANGGRAPH_CANVAS_NODE_LLM_REF]: LangGraphCanvasLLMRefNode,
  [LANGGRAPH_CANVAS_NODE_TOOL]: LangGraphCanvasToolNode,
  [LANGGRAPH_CANVAS_NODE_TOOL_REF]: LangGraphCanvasToolRefNode,
  [LANGGRAPH_CANVAS_NODE_MIDDLEWARE]: LangGraphCanvasMiddlewareNode,
  [LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF]: LangGraphCanvasMiddlewareRefNode,
  [LANGGRAPH_CANVAS_NODE_NODE]: LangGraphCanvasNode,
  [LANGGRAPH_CANVAS_NODE_AGENT]: LangGraphCanvasNode,
  [LANGGRAPH_CANVAS_NODE_MEMORY]: LangGraphCanvasMemoryNode,
  [LANGGRAPH_CANVAS_NODE_MEMORY_REF]: LangGraphCanvasMemoryRefNode,
  [LANGGRAPH_CANVAS_NODE_OUTPUT]: LangGraphCanvasOutputNode,
};

export {
  LangGraphCanvasStateNode,
  LangGraphCanvasStartNode,
  LangGraphCanvasEndNode,
  LangGraphCanvasPortNode,
  LangGraphCanvasLLMNode,
  LangGraphCanvasLLMRefNode,
  LangGraphCanvasToolNode,
  LangGraphCanvasToolRefNode,
  LangGraphCanvasMiddlewareNode,
  LangGraphCanvasMiddlewareRefNode,
  LangGraphCanvasNode,
  LangGraphCanvasStepNode,
  LangGraphCanvasRouterNode,
  LangGraphCanvasMemoryNode,
  LangGraphCanvasMemoryRefNode,
  LangGraphCanvasOutputNode,
};
