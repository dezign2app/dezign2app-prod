import { StateGraph } from "@langchain/langgraph";
import { UiEditorAnnotation } from "./state";
import { createUiEditorNodes } from "./nodes";
import { shouldRepairOrFinish } from "./router";
import { createChatModel } from "../llmFactory";

/**
 * Creates and compiles a new dedicated LangGraph StateGraph instance for UI editing.
 * Uses Google Gemini (or Groq fallback) via createChatModel.
 */
export function createUiEditorGraph() {
  const llm = createChatModel({
    temperature: 0.2,
    maxTokens: 8192,
    streaming: true,
  });

  const nodes = createUiEditorNodes(llm);

  const workflow = new StateGraph(UiEditorAnnotation)
    .addNode("uiPlanner", nodes.uiPlanner)
    .addNode("uiCodeGenerator", nodes.uiCodeGenerator)
    .addNode("uiValidator", nodes.uiValidator)
    .addNode("uiRepair", nodes.uiRepair)

    .addEdge("__start__", "uiPlanner")
    .addEdge("uiPlanner", "uiCodeGenerator")
    .addEdge("uiCodeGenerator", "uiValidator")
    .addConditionalEdges("uiValidator", shouldRepairOrFinish)
    .addEdge("uiRepair", "uiValidator");

  return workflow.compile();
}
