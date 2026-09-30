import { NextRequest, NextResponse } from "next/server";
import {
  executeServerLangGraph,
  clearServerThread,
  ServerExecutionParams,
} from "@/lib/simulation/serverLangGraphRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (
      body &&
      typeof body === "object" &&
      "action" in body &&
      body.action === "clear" &&
      "threadId" in body &&
      typeof body.threadId === "string"
    ) {
      clearServerThread(body.threadId);
      return NextResponse.json({ success: true, message: `Cleared server thread ${body.threadId}` });
    }

    if (!body || typeof body !== "object" || !("nodes" in body) || !Array.isArray(body.nodes)) {
      return NextResponse.json(
        { error: "Invalid request payload: 'nodes' array is required." },
        { status: 400 },
      );
    }

    const result = await executeServerLangGraph({
      nodes: body.nodes,
      edges: Array.isArray(body.edges) ? body.edges : [],
      stateChannels: Array.isArray(body.stateChannels) ? body.stateChannels : [],
      inputChannels: Array.isArray(body.inputChannels) ? body.inputChannels : [],
      memoryConfig: body.memoryConfig,
      inputValues: body.inputValues && typeof body.inputValues === "object" ? body.inputValues : {},
      threadId: typeof body.threadId === "string" ? body.threadId : "default",
      provider: body.provider,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      modelName: typeof body.modelName === "string" ? body.modelName : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        finalState: {},
        trace: [],
        totalDurationMs: 0,
        visitedNodes: [],
        error: `Server LangGraph Execution Error: ${message}`,
      },
      { status: 500 },
    );
  }
}
