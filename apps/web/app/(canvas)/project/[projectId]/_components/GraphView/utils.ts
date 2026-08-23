import type {
  BackendNodeType,
  BackendNodeData,
  BackendNode,
} from "@workspace/canvas/types";

export function createGraphNodeData(
  type: BackendNodeType,
  label: string,
  existingNodes: BackendNode[],
): BackendNodeData {
  const baseData: BackendNodeData = {
    label,
  };

  if (type === "service") {
    const existingPorts = new Set(
      existingNodes
        .filter((n) => n.type === "service")
        .map((n) => parseInt(String(n.data?.port || "8080"), 10))
        .filter((p) => !isNaN(p)),
    );
    let nextPort = 8080;
    while (existingPorts.has(nextPort)) {
      nextPort++;
    }

    const existingGrpcPorts = new Set(
      existingNodes
        .filter((n) => n.type === "service")
        .map((n) => parseInt(String(n.data?.grpcPort || "50051"), 10))
        .filter((p) => !isNaN(p)),
    );
    let nextGrpcPort = 50051;
    while (existingGrpcPorts.has(nextGrpcPort)) {
      nextGrpcPort++;
    }

    return {
      ...baseData,
      port: String(nextPort),
      grpcPort: String(nextGrpcPort),
      inputs: [],
      logic: [],
      outputs: [],
    };
  }

  if (type === "transformer") {
    return {
      ...baseData,
      functionName: "transformData",
      scope: "global",
      inputSchema: [
        { name: "name", type: "string", required: true },
      ],
      logicMode: "code",
      code: "return {\n  slug: input.name.toLowerCase().replace(/\\s+/g, '-'),\n};",
      returnSchema: [
        { name: "slug", type: "string", required: true },
      ],
    };
  }

  if (type === "transformer_ref") {
    return {
      ...baseData,
      label: "Transformer Ref",
    };
  }

  if (type === "webClient") {
    return {
      ...baseData,
      events: [],
    };
  }

  if (type === "external") {
    return {
      ...baseData,
      actions: [],
    };
  }

  if (type === "kafka") {
    return {
      ...baseData,
      topics: [],
      kafkaBroker: {},
    };
  }

  if (type === "redis-streams") {
    return {
      ...baseData,
      streams: [],
      redisBroker: {},
    };
  }

  if (type === "sqs") {
    return {
      ...baseData,
      queues: [],
      sqsBroker: {},
    };
  }

  if (type === "redis-pubsub") {
    return {
      ...baseData,
      channels: [],
    };
  }

  if (type === "storage") {
    return {
      ...baseData,
      buckets: [],
    };
  }

  if (type === "worker") {
    return {
      ...baseData,
      tasks: [],
    };
  }

  if (type === "serverless" || type === "api_gateway") {
    return {
      ...baseData,
      endpoints: [],
      ...(type === "api_gateway" ? { authRules: [] } : {}),
    };
  }

  if (type === "search_index") {
    return {
      ...baseData,
      searchSources: [],
    };
  }

  if (type === "load_balancer") {
    return {
      ...baseData,
      targetGroups: [],
    };
  }

  if (type === "llm" || type === "mcp_server") {
    return {
      ...baseData,
      prompts: [],
      tools: [],
      ...(type === "mcp_server" ? { resources: [] } : {}),
    };
  }

  if (type === "langgraph") {
    return {
      ...baseData,
      inputChannels: [],
      stateChannels: [
        {
          key: "messages",
          type: "messages",
          reducer: "add_messages",
          defaultValue: [],
        },
      ],
      graphSteps: [],
      graphEdges: [],
    };
  }

  return baseData;
}
