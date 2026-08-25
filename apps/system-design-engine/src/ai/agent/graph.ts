import { StateGraph } from "@langchain/langgraph";
import { GraphAnnotation } from "../state";
import { createAgentNodes } from "./agentNodes";
import { createRequirementsAndPlanNodes } from "./requirementsAndPlanNodes";
import {
  routeAfterIntent,
  shouldContinue,
  afterTools,
  shouldContinueReflect,
} from "./router";
import { createChatModel } from "../llmFactory";

export function createGraph() {
  const llm = createChatModel({ temperature: 0, maxTokens: 4000 });

  const agentNodes = createAgentNodes(llm);
  const reqPlanNodes = createRequirementsAndPlanNodes(llm);

  const workflow = new StateGraph(GraphAnnotation)
    .addNode("intentIdentifier", agentNodes.intentIdentifier)
    .addNode("chatAgent", agentNodes.chatAgent)
    .addNode("requirementsAgent", reqPlanNodes.requirementsAgent)
    .addNode("syncRequirements", reqPlanNodes.syncRequirements)
    .addNode("planAgent", reqPlanNodes.planAgent)
    .addNode("approvePlan", reqPlanNodes.approvePlan)
    .addNode("approveSchema", reqPlanNodes.approveSchema)
    .addNode("approveNodes", reqPlanNodes.approveNodes)
    .addNode("canvasAgent", agentNodes.canvasAgent)
    .addNode("tools", agentNodes.customToolNode)
    .addNode("reflectAgent", agentNodes.reflectAgent)

    .addEdge("__start__", "intentIdentifier")
    .addConditionalEdges("intentIdentifier", routeAfterIntent)

    .addEdge("chatAgent", "__end__")
    .addEdge("requirementsAgent", "__end__")
    .addEdge("syncRequirements", "planAgent")
    .addEdge("planAgent", "__end__")
    .addEdge("approvePlan", "canvasAgent")
    .addEdge("approveSchema", "canvasAgent")
    .addEdge("approveNodes", "canvasAgent")

    .addConditionalEdges("canvasAgent", shouldContinue)
    .addConditionalEdges("tools", afterTools)
    .addConditionalEdges("reflectAgent", shouldContinueReflect);

  return workflow.compile();
}
