// ─── Backend Canvas Main Node Types ───────────────────────────────────────────
export const BACKEND_NODE_SERVICE = "service" as const;
export const BACKEND_NODE_DATABASE = "database" as const;
export const BACKEND_NODE_QUEUE = "queue" as const;
export const BACKEND_NODE_PUBSUB = "pubsub" as const;
export const BACKEND_NODE_EVENTSTREAM = "eventstream" as const;
export const BACKEND_NODE_KAFKA = "kafka" as const;
export const BACKEND_NODE_REDIS_STREAMS = "redis-streams" as const;
export const BACKEND_NODE_SQS = "sqs" as const;
export const BACKEND_NODE_REDIS_PUBSUB = "redis-pubsub" as const;
export const BACKEND_NODE_REDIS_CACHE = "redis-cache" as const;
export const BACKEND_NODE_ENTITY = "entity" as const;
export const BACKEND_NODE_WEB_CLIENT = "webClient" as const;
export const BACKEND_NODE_EXTERNAL = "external" as const;
export const BACKEND_NODE_GROUP = "group" as const;
export const BACKEND_NODE_DB_REF = "db_ref" as const;
export const BACKEND_NODE_STORAGE = "storage" as const;
export const BACKEND_NODE_WORKER = "worker" as const;
export const BACKEND_NODE_SERVERLESS = "serverless" as const;
export const BACKEND_NODE_SEARCH_INDEX = "search_index" as const;
export const BACKEND_NODE_API_GATEWAY = "api_gateway" as const;
export const BACKEND_NODE_LOAD_BALANCER = "load_balancer" as const;
export const BACKEND_NODE_WEBHOOK = "webhook" as const;
export const BACKEND_NODE_LLM = "llm" as const;
export const BACKEND_NODE_MCP_SERVER = "mcp_server" as const;
export const BACKEND_NODE_VECTOR_DB_REF = "vector_db_ref" as const;
export const BACKEND_NODE_IDENTITY_PROVIDER = "identity_provider" as const;
export const BACKEND_NODE_AUTH = "auth" as const;
export const BACKEND_NODE_PAYMENTS = "payments" as const;
export const BACKEND_NODE_LANGGRAPH = "langgraph" as const;
export const BACKEND_NODE_LANGGRAPH_STEP = "langgraph_step" as const;

export const NODE_TYPE_TO_RESOURCE_KIND: Record<string, string | undefined> = {
  kafka: "kafka",
  sqs: "sqs",
  "redis-streams": "redis-stream",
  "redis-pubsub": "redis-pubsub",
  queue: "generic-queue",
  pubsub: "generic-pubsub",
  eventstream: "generic-eventstream",
  storage: "storage",
  worker: "worker",
  serverless: "serverless",
  search_index: "search_index",
  api_gateway: "api_gateway",
  load_balancer: "load_balancer",
  webhook: "webhook",
  llm: "llm",
  mcp_server: "mcp_server",
  langgraph: "langgraph",
  langgraph_step: "langgraph_step",
};

export const BACKEND_NODE_TYPES = {
  SERVICE: BACKEND_NODE_SERVICE,
  DATABASE: BACKEND_NODE_DATABASE,
  QUEUE: BACKEND_NODE_QUEUE,
  PUBSUB: BACKEND_NODE_PUBSUB,
  EVENTSTREAM: BACKEND_NODE_EVENTSTREAM,
  KAFKA: BACKEND_NODE_KAFKA,
  REDIS_STREAMS: BACKEND_NODE_REDIS_STREAMS,
  SQS: BACKEND_NODE_SQS,
  REDIS_PUBSUB: BACKEND_NODE_REDIS_PUBSUB,
  REDIS_CACHE: BACKEND_NODE_REDIS_CACHE,
  ENTITY: BACKEND_NODE_ENTITY,
  WEB_CLIENT: BACKEND_NODE_WEB_CLIENT,
  EXTERNAL: BACKEND_NODE_EXTERNAL,
  GROUP: BACKEND_NODE_GROUP,
  DB_REF: BACKEND_NODE_DB_REF,
  STORAGE: BACKEND_NODE_STORAGE,
  WORKER: BACKEND_NODE_WORKER,
  SERVERLESS: BACKEND_NODE_SERVERLESS,
  SEARCH_INDEX: BACKEND_NODE_SEARCH_INDEX,
  API_GATEWAY: BACKEND_NODE_API_GATEWAY,
  LOAD_BALANCER: BACKEND_NODE_LOAD_BALANCER,
  WEBHOOK: BACKEND_NODE_WEBHOOK,
  LLM: BACKEND_NODE_LLM,
  MCP_SERVER: BACKEND_NODE_MCP_SERVER,
  VECTOR_DB_REF: BACKEND_NODE_VECTOR_DB_REF,
  IDENTITY_PROVIDER: BACKEND_NODE_IDENTITY_PROVIDER,
  AUTH: BACKEND_NODE_AUTH,
  PAYMENTS: BACKEND_NODE_PAYMENTS,
  LANGGRAPH: BACKEND_NODE_LANGGRAPH,
  LANGGRAPH_STEP: BACKEND_NODE_LANGGRAPH_STEP,
} as const;

// ─── Backend Canvas Main Edge Types ───────────────────────────────────────────
export const BACKEND_EDGE_FOREIGN_KEY = "foreign-key" as const;
export const BACKEND_EDGE_DATABASE_CONNECTION = "database-connection" as const;
export const BACKEND_EDGE_IDENTITY_CONNECTION = "identity-connection" as const;
export const BACKEND_EDGE_MESSAGE = "message" as const;
export const BACKEND_EDGE_CONNECTION = "connection" as const;

export const BACKEND_EDGE_TYPES = {
  FOREIGN_KEY: BACKEND_EDGE_FOREIGN_KEY,
  DATABASE_CONNECTION: BACKEND_EDGE_DATABASE_CONNECTION,
  IDENTITY_CONNECTION: BACKEND_EDGE_IDENTITY_CONNECTION,
  MESSAGE: BACKEND_EDGE_MESSAGE,
  CONNECTION: BACKEND_EDGE_CONNECTION,
} as const;
