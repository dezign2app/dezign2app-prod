import { Router, type Router as ExpressRouter } from "express";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/backend/_generated/api";
import { createGraph } from "../ai/agent";
import { formatToolCallLog, formatCanvasState } from "../ai/utils";

export const canvasAiRouter: ExpressRouter = Router();

canvasAiRouter.post("/", async (req, res) => {
  try {
    const body = req.body;
    const {
      projectId,
      chatId,
      convexUrl: bodyConvexUrl,
      token,
      viewportCenter,
    } = body;

    if (!chatId || !projectId) {
      res.status(400).send("Missing required fields");
      return;
    }

    const convexUrl = bodyConvexUrl || process.env.CONVEX_URL;
    if (!convexUrl) {
      res.status(500).send("Missing CONVEX_URL environment variable");
      return;
    }

    const client = new ConvexHttpClient(convexUrl);
    if (
      token &&
      typeof token === "string" &&
      token.includes(".") &&
      !token.startsWith("sk_")
    ) {
      client.setAuth(token);
    }

    const messages = await client.query(api.project_chat.getMessages, {
      chatId,
    });

    const agent = createGraph();

    const existingRequirements = await client.query(api.requirements.get, {
      projectId,
    });
    const existingPlan = await client.query(api.requirements.getPlan, {
      projectId,
    });

    // Fetch canvas state directly from backend
    const elements = await client.query(api.canvas.getBackendElements, {
      projectId,
    });
    const backendCanvasState = formatCanvasState(elements);

    // Prepare initial state
    const formattedMessages = messages.map((m) =>
      m.role === "assistant"
        ? new AIMessage(m.content)
        : new HumanMessage(m.content),
    );

    const graphStream = await agent.streamEvents(
      {
        messages: formattedMessages,
        projectId,
        convexUrl,
        token,
        viewportCenter,
        canvasStateContext: backendCanvasState,
        requirements: existingRequirements ?? {
          functional: [],
          nonFunctional: [],
          assumptions: [],
          status: "pending",
        },
        implementationPlan: existingPlan ?? { content: "", status: "none" },
      },
      { version: "v2" },
    );

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const event of graphStream) {
      if (event.event === "on_chat_model_stream") {
        const nodeName = event.metadata?.langgraph_node;
        if (
          nodeName &&
          ![
            "chatAgent",
            "canvasAgent",
            "reflectAgent",
            "requirementsAgent",
            "planAgent",
          ].includes(nodeName)
        ) {
          continue;
        }

        const chunk = event.data.chunk;
        if (chunk.content) {
          res.write(
            JSON.stringify({ type: "text", content: chunk.content }) + "\n",
          );
        }
        if (chunk.tool_calls && chunk.tool_calls.length > 0) {
          for (const call of chunk.tool_calls) {
            const name = call.name;
            const message = formatToolCallLog(name, call.args);
            res.write(
              JSON.stringify({ type: "tool_call", name, message }) + "\n",
            );
          }
        }
      }
    }
    res.end();
  } catch (error) {
    console.error("API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (!res.headersSent) {
      res
        .status(500)
        .send(`Internal Server Error: ${message}`);
    } else {
      res.write(
        JSON.stringify({ type: "error", message: "Internal Server Error" }) +
          "\n",
      );
    }
  }
});
