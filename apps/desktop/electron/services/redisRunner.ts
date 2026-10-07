import Redis from "ioredis";
import {
  TestDbOperationPayload,
  TestDbOperationResult,
  CheckDbConnectionResult,
  JsonValue,
  JsonObject,
} from "./dbRunner";

export interface ExecuteRedisOptions {
  host: string;
  port: number;
  operation: TestDbOperationPayload["operation"];
  args: Record<string, JsonValue>;
}

export interface CheckRedisOptions {
  host: string;
  port: number;
  connectionString?: string;
}

export function planRedisCommand(
  op: TestDbOperationPayload["operation"],
  args: Record<string, JsonValue>,
): { command: string; args: (string | number)[]; rawCli: string } {
  const code = op.code || "";
  const name = op.name || "";
  const key = String(args.key || args.id || "test:1");

  // 1. Check for explicit redis.call in code
  const callMatch = code.match(
    /redis\.call\(\s*["']([^"']+)["']\s*(?:,\s*([^)]+))?\)/,
  );
  if (callMatch && callMatch[1]) {
    const rawCmd = callMatch[1].toUpperCase();

    if (rawCmd === "JSON.ARRAPPEND") {
      const itemVal = args.item !== undefined ? args.item : { sample: "value" };
      const itemStr = typeof itemVal === "string" ? itemVal : JSON.stringify(itemVal);
      const targetPath = String(args.path || "$");
      return {
        command: "JSON.ARRAPPEND",
        args: [key, targetPath, itemStr],
        rawCli: `JSON.SET ${key} ${targetPath} '[]' NX\nJSON.ARRAPPEND ${key} ${targetPath} '${itemStr}'`,
      };
    }

    if (rawCmd === "JSON.ARRPOP") {
      const targetPath = String(args.path || "$");
      const index = Number(args.index ?? -1);
      return {
        command: "JSON.ARRPOP",
        args: [key, targetPath, index],
        rawCli: `JSON.ARRPOP ${key} ${targetPath} ${index}`,
      };
    }

    if (rawCmd === "JSON.GET") {
      if (args.path) {
        const targetPath = String(args.path);
        return {
          command: "JSON.GET",
          args: [key, targetPath],
          rawCli: `JSON.GET ${key} ${targetPath}`,
        };
      }
      return {
        command: "JSON.GET",
        args: [key],
        rawCli: `JSON.GET ${key}`,
      };
    }

    if (rawCmd === "JSON.SET") {
      const val = args.value !== undefined ? args.value : (args.item ?? { status: "active" });
      const valStr = typeof val === "string" ? val : JSON.stringify(val);
      const targetPath = String(args.path || "$");
      return {
        command: "JSON.SET",
        args: [key, targetPath, valStr],
        rawCli: `JSON.SET ${key} ${targetPath} '${valStr}'`,
      };
    }

    if (rawCmd === "JSON.DEL") {
      const targetPath = String(args.path || "$");
      return {
        command: "JSON.DEL",
        args: [key, targetPath],
        rawCli: `JSON.DEL ${key} ${targetPath}`,
      };
    }
  }

  // 2. Fallbacks based on operation name
  const n = name.toLowerCase();
  if (n.startsWith("get") || n.startsWith("find")) {
    return {
      command: "GET",
      args: [key],
      rawCli: `GET ${key}`,
    };
  }
  if (n.startsWith("set") || n.startsWith("save") || n.startsWith("create")) {
    const val = args.value !== undefined ? args.value : (args.data ?? "sample_value");
    const valStr = typeof val === "string" ? val : JSON.stringify(val);
    return {
      command: "SET",
      args: [key, valStr],
      rawCli: `SET ${key} "${valStr}"`,
    };
  }
  if (n.startsWith("del") || n.startsWith("remove")) {
    return {
      command: "DEL",
      args: [key],
      rawCli: `DEL ${key}`,
    };
  }
  if (n.startsWith("keys") || n.startsWith("list")) {
    return {
      command: "KEYS",
      args: ["*"],
      rawCli: `KEYS *`,
    };
  }

  return {
    command: "GET",
    args: [key],
    rawCli: `GET ${key}`,
  };
}

export async function executeRedisLiveOperation(
  opts: ExecuteRedisOptions,
): Promise<TestDbOperationResult> {
  const { host, port, operation, args } = opts;
  const start = performance.now();
  const plan = planRedisCommand(operation, args);

  let client: Redis | null = null;
  try {
    client = new Redis({
      host,
      port,
      connectTimeout: 2500,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });

    await client.connect();

    if (plan.command === "JSON.ARRAPPEND") {
      const targetKey = String(plan.args[0] ?? "");
      const rootPath = String(plan.args[1] ?? "$");
      await client.call("JSON.SET", targetKey, rootPath, "[]", "NX").catch(() => {});
    }

    const rawResult = await client.call(plan.command, ...(plan.args as any[]));
    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    client.disconnect();

    let formattedOutput: JsonValue = null;
    if (typeof rawResult === "string") {
      try {
        formattedOutput = JSON.parse(rawResult);
      } catch {
        formattedOutput = rawResult;
      }
    } else if (
      typeof rawResult === "number" ||
      typeof rawResult === "boolean" ||
      rawResult === null
    ) {
      formattedOutput = rawResult;
    } else if (Array.isArray(rawResult)) {
      formattedOutput = rawResult as JsonValue[];
    } else if (typeof rawResult === "object" && rawResult !== null) {
      formattedOutput = rawResult as JsonObject;
    }

    return {
      success: true,
      serverActive: true,
      output: formattedOutput,
      durationMs: Math.max(0.4, durationMs),
      rawCommand: plan.rawCli,
      mode: "live",
      connection: `redis://${host}:${port}`,
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    try {
      client?.disconnect();
    } catch {}

    const errMsg = err instanceof Error ? err.message : String(err);
    const isConnErr =
      errMsg.includes("ECONNREFUSED") ||
      errMsg.includes("connect ETIMEDOUT") ||
      errMsg.includes("Connection refused") ||
      errMsg.includes("Connection to Redis timed out");

    return {
      success: false,
      serverActive: !isConnErr,
      error: `Redis error: ${errMsg}`,
      durationMs: Math.max(0.4, durationMs),
      rawCommand: plan.rawCli,
      mode: "live",
      connection: `redis://${host}:${port}`,
      tip: isConnErr
        ? "Ensure Redis server is running and listening on this port, or switch to Sandbox mode."
        : undefined,
    };
  }
}

export async function checkRedisConnection(
  opts: CheckRedisOptions,
): Promise<CheckDbConnectionResult> {
  const { host, port } = opts;
  const start = performance.now();

  let client: Redis | null = null;
  try {
    client = new Redis({
      host,
      port,
      connectTimeout: 2000,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });

    await client.connect();
    const infoStr = await client.info("server");
    const versionMatch = infoStr.match(/redis_version:([^\r\n]+)/);
    const version = versionMatch ? `Redis ${versionMatch[1]}` : "Redis 7.x";
    const latencyMs = Math.round((performance.now() - start) * 10) / 10;
    client.disconnect();

    return {
      success: true,
      engine: "redis",
      latencyMs,
      host,
      port,
      connectionUri: `redis://${host}:${port}`,
      info: {
        reachable: true,
        version,
        status: "Connected (Redis Active)",
      },
    };
  } catch (err) {
    const latencyMs = Math.round((performance.now() - start) * 10) / 10;
    try {
      client?.disconnect();
    } catch {}

    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      engine: "redis",
      latencyMs,
      host,
      port,
      connectionUri: `redis://${host}:${port}`,
      error: `Could not reach Redis at ${host}:${port}: ${errMsg}`,
    };
  }
}
