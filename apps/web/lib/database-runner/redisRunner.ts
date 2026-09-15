import { sanitizeForConvex } from "@/lib/utils/convexSanitizer";
import {
  TestDbOperationPayload,
  CommandPlan,
  CheckDbConnectionResult,
  JsonValue,
  JsonObject,
} from "./types";

/**
 * Plans a Redis command and CLI representation from operation details and arguments.
 */
export function planRedisCommand(
  op: TestDbOperationPayload["operation"],
  args: Record<string, unknown>,
): CommandPlan {
  const code = op.code || "";
  const name = op.name || "";
  const id = op.id || "";
  const key = String(args.key || args.id || "test:1");

  // 1. Check for explicit redis.call in code
  const callMatch = code.match(
    /redis\.call\(\s*["']([^"']+)["']\s*(?:,\s*([^)]+))?\)/,
  );
  if (callMatch && callMatch[1]) {
    const rawCmd = callMatch[1].toUpperCase();

    // RedisJSON ARRAPPEND (Upsert root array with NX if key does not exist)
    if (rawCmd === "JSON.ARRAPPEND") {
      const itemVal =
        args.item !== undefined ? args.item : { sample: "value" };
      const itemStr =
        typeof itemVal === "string" ? itemVal : JSON.stringify(itemVal);
      const targetPath = String(args.path || "$");
      return {
        command: "JSON.ARRAPPEND",
        args: [key, targetPath, itemStr],
        rawCli: `JSON.SET ${key} ${targetPath} '[]' NX\nJSON.ARRAPPEND ${key} ${targetPath} '${itemStr}'`,
      };
    }

    // RedisJSON ARRPOP
    if (rawCmd === "JSON.ARRPOP") {
      const targetPath = String(args.path || "$");
      const index = Number(args.index ?? -1);
      return {
        command: "JSON.ARRPOP",
        args: [key, targetPath, index],
        rawCli: `JSON.ARRPOP ${key} ${targetPath} ${index}`,
      };
    }

    // RedisJSON GET (slice or whole)
    if (rawCmd === "JSON.GET") {
      if (code.includes("[-") && args.count) {
        const count = Number(args.count ?? 20);
        const targetPath = `$[-${count}:]`;
        return {
          command: "JSON.GET",
          args: [
            key,
            "INDENT",
            "",
            "NEWLINE",
            "",
            "SPACE",
            "",
            "PATH",
            targetPath,
          ],
          rawCli: `JSON.GET ${key} PATH "${targetPath}"`,
        };
      }
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

    // RedisJSON SET
    if (rawCmd === "JSON.SET") {
      const val =
        args.value !== undefined
          ? args.value
          : args.item ?? { status: "active" };
      const valStr = typeof val === "string" ? val : JSON.stringify(val);
      const targetPath = String(args.path || "$");
      return {
        command: "JSON.SET",
        args: [key, targetPath, valStr],
        rawCli: `JSON.SET ${key} ${targetPath} '${valStr}'`,
      };
    }

    // Redis HEXPIRE
    if (rawCmd === "HEXPIRE") {
      const field = String(args.field || "id");
      const ttl = Number(args.ttlSeconds ?? args.ttl ?? 3600);
      return {
        command: "HEXPIRE",
        args: [key, ttl, "FIELDS", 1, field],
        rawCli: `HEXPIRE ${key} ${ttl} FIELDS 1 ${field}`,
      };
    }

    // Redis GEOSEARCH
    if (rawCmd === "GEOSEARCH") {
      const lon = Number(args.longitude ?? 0);
      const lat = Number(args.latitude ?? 0);
      const rad = Number(args.radius ?? 10);
      const unit = String(args.unit || "km");
      return {
        command: "GEOSEARCH",
        args: [key, "FROMLONLAT", lon, lat, "BYRADIUS", rad, unit],
        rawCli: `GEOSEARCH ${key} FROMLONLAT ${lon} ${lat} BYRADIUS ${rad} ${unit}`,
      };
    }
  }

  // 2. Map standard generated functions by ID / Name / Pattern
  if (id.includes("arrappend") || name.toLowerCase().includes("append")) {
    const itemVal = args.item !== undefined ? args.item : { sample: "data" };
    const itemStr =
      typeof itemVal === "string" ? itemVal : JSON.stringify(itemVal);
    return {
      command: "JSON.ARRAPPEND",
      args: [key, "$", itemStr],
      rawCli: `JSON.SET ${key} $ '[]' NX\nJSON.ARRAPPEND ${key} $ '${itemStr}'`,
    };
  }

  if (id.includes("arrpop") || name.toLowerCase().includes("pop")) {
    const idx = Number(args.index ?? -1);
    return {
      command: "JSON.ARRPOP",
      args: [key, "$", idx],
      rawCli: `JSON.ARRPOP ${key} $ ${idx}`,
    };
  }

  if (id.includes("arrlen") || name.toLowerCase().includes("length")) {
    return {
      command: "JSON.ARRLEN",
      args: [key, "$"],
      rawCli: `JSON.ARRLEN ${key} $`,
    };
  }

  if (id.includes("hgetall") || name.toLowerCase().includes("getall")) {
    return {
      command: "HGETALL",
      args: [key],
      rawCli: `HGETALL ${key}`,
    };
  }

  if (
    id.includes("hget") ||
    (name.toLowerCase().startsWith("get") && args.field)
  ) {
    const field = String(args.field || "field1");
    return {
      command: "HGET",
      args: [key, field],
      rawCli: `HGET ${key} ${field}`,
    };
  }

  if (
    id.includes("hset") ||
    (name.toLowerCase().startsWith("set") && args.fields)
  ) {
    const fields = (
      args.fields && typeof args.fields === "object" ? args.fields : {}
    ) as Record<string, unknown>;
    const flatArgs: (string | number)[] = [key];
    const cliParts: string[] = [key];
    Object.entries(fields).forEach(([f, v]) => {
      flatArgs.push(f, String(v));
      cliParts.push(`${f} "${v}"`);
    });
    if (flatArgs.length === 1) {
      flatArgs.push("updated_at", String(Date.now()));
      cliParts.push(`updated_at "${Date.now()}"`);
    }
    return {
      command: "HSET",
      args: flatArgs,
      rawCli: `HSET ${cliParts.join(" ")}`,
    };
  }

  if (
    id.includes("xadd") ||
    (name.toLowerCase().includes("stream") &&
      name.toLowerCase().includes("add"))
  ) {
    const fields = (
      args.fields && typeof args.fields === "object" ? args.fields : {}
    ) as Record<string, unknown>;
    const flatArgs: (string | number)[] = [key, "*"];
    const cliParts: string[] = [key, "*"];
    Object.entries(fields).forEach(([f, v]) => {
      flatArgs.push(f, String(v));
      cliParts.push(`${f} "${v}"`);
    });
    if (flatArgs.length === 2) {
      flatArgs.push("event", "test_event", "ts", String(Date.now()));
      cliParts.push('event "test_event" ts "' + Date.now() + '"');
    }
    return {
      command: "XADD",
      args: flatArgs,
      rawCli: `XADD ${cliParts.join(" ")}`,
    };
  }

  if (
    id.includes("zadd") ||
    (name.toLowerCase().includes("member") &&
      name.toLowerCase().includes("add"))
  ) {
    const score = Number(args.score ?? 100);
    const member = String(args.member || "member_1");
    return {
      command: "ZADD",
      args: [key, score, member],
      rawCli: `ZADD ${key} ${score} "${member}"`,
    };
  }

  if (
    id.includes("zrange") ||
    name.toLowerCase().includes("top") ||
    name.toLowerCase().includes("leaderboard")
  ) {
    const start = Number(args.start ?? 0);
    const stop = Number(args.stop ?? 10);
    return {
      command: "ZRANGE",
      args: [key, start, stop],
      rawCli: `ZRANGE ${key} ${start} ${stop}`,
    };
  }

  if (id.includes("lpush") || id.includes("rpush")) {
    const cmd = id.includes("rpush") ? "RPUSH" : "LPUSH";
    const val = String(args.value || args.item || "entry");
    return {
      command: cmd,
      args: [key, val],
      rawCli: `${cmd} ${key} "${val}"`,
    };
  }

  if (id.includes("lrange")) {
    const start = Number(args.start ?? 0);
    const stop = Number(args.stop ?? 20);
    return {
      command: "LRANGE",
      args: [key, start, stop],
      rawCli: `LRANGE ${key} ${start} ${stop}`,
    };
  }

  if (id.includes("del") || name.toLowerCase().startsWith("delete")) {
    return {
      command: "DEL",
      args: [key],
      rawCli: `DEL ${key}`,
    };
  }

  if (args.value !== undefined) {
    const val =
      typeof args.value === "string" ? args.value : JSON.stringify(args.value);
    return {
      command: "SET",
      args: [key, val],
      rawCli: `SET ${key} '${val}'`,
    };
  }

  return {
    command: "GET",
    args: [key],
    rawCli: `GET ${key}`,
  };
}

/**
 * Executes a planned command against a live Redis instance via ioredis.
 */
export async function executeLiveRedisOperation(params: {
  host: string;
  port: number;
  plan: CommandPlan;
}): Promise<{
  success: boolean;
  output?: unknown;
  durationMs: number;
  rawCommand: string;
  mode: "live";
  connection: string;
  error?: string;
  serverActive?: boolean;
  tip?: string;
}> {
  const { host, port, plan } = params;
  const start = performance.now();
  const socketErrorRef = { message: "" };

  try {
    const { default: Redis } = await import("ioredis");

    const client = new Redis({
      host,
      port,
      connectTimeout: 2500,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });

    client.on("error", (err: Error) => {
      socketErrorRef.message = err?.message || String(err);
    });

    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection to Redis timed out (2500ms)")),
          2500,
        ),
      ),
    ]);

    if (plan.command === "JSON.ARRAPPEND") {
      const targetKey = String(plan.args[0] ?? "");
      const rootPath = String(plan.args[1] ?? "$");
      await client.call("JSON.SET", targetKey, rootPath, "[]", "NX");
    }

    const rawResult = await client.call(plan.command, ...plan.args);
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
      formattedOutput = rawResult;
    } else if (typeof rawResult === "object" && rawResult !== null) {
      formattedOutput = rawResult as JsonObject;
    }

    if (Array.isArray(formattedOutput) && formattedOutput.length === 1) {
      const cmd = plan.command.toUpperCase();
      if (cmd === "JSON.ARRAPPEND" || cmd === "JSON.ARRLEN") {
        const first = formattedOutput[0];
        if (typeof first === "number") {
          formattedOutput = first;
        }
      } else if (cmd === "JSON.ARRPOP") {
        formattedOutput = formattedOutput[0] ?? null;
      } else if (cmd === "JSON.GET" && Array.isArray(formattedOutput[0])) {
        formattedOutput = formattedOutput[0];
      }
    }

    const sanitized = sanitizeForConvex(formattedOutput);

    return {
      success: true,
      output: sanitized,
      durationMs,
      rawCommand: plan.rawCli,
      mode: "live",
      connection: `redis://${host}:${port}`,
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    const errMessage =
      socketErrorRef.message ||
      (err instanceof Error ? err.message : String(err));

    return {
      success: false,
      serverActive: false,
      error: `Server not found or inactive on redis://${host}:${port}: ${errMessage}`,
      rawCommand: plan.rawCli,
      durationMs,
      mode: "live",
      connection: `redis://${host}:${port}`,
      tip: "Verify local Redis is running on this port, or switch to 'Simulation Sandbox' mode in the header to run mock test cases.",
    };
  }
}

/**
 * Checks connectivity and queries metadata (ping, INFO) from a live Redis instance.
 */
export async function checkRedisConnection(params: {
  host: string;
  port: number;
}): Promise<CheckDbConnectionResult> {
  const { host, port } = params;
  const socketErrorRef = { message: "" };

  try {
    const { default: Redis } = await import("ioredis");

    const client = new Redis({
      host,
      port,
      connectTimeout: 2500,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });

    client.on("error", (err: Error) => {
      socketErrorRef.message = err?.message || String(err);
    });

    const start = performance.now();

    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timed out (2500ms)")),
          2500,
        ),
      ),
    ]);

    await client.ping();
    const latencyMs = Math.round((performance.now() - start) * 10) / 10;

    let infoObj: Record<string, string> = {};
    try {
      const rawInfo = await client.info();
      rawInfo.split(/\r?\n/).forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > 0) {
          const k = line.substring(0, idx).trim();
          const v = line.substring(idx + 1).trim();
          infoObj[k] = v;
        }
      });
    } catch {}

    client.disconnect();

    return {
      success: true,
      engine: "redis",
      latencyMs,
      host,
      port,
      connectionUri: `redis://${host}:${port}`,
      info: {
        version: infoObj.redis_version
          ? `Redis ${infoObj.redis_version}`
          : "Redis 7.x",
        rawVersion: infoObj.redis_version || "7.x",
        mode: infoObj.redis_mode || "standalone",
        usedMemory: infoObj.used_memory_human || "N/A",
        connectedClients: infoObj.connected_clients || "1",
        os: infoObj.os || "Linux/Windows",
      },
    };
  } catch (err) {
    const errorMsg =
      socketErrorRef.message ||
      (err instanceof Error ? err.message : String(err));
    return {
      success: false,
      engine: "redis",
      latencyMs: 0,
      host,
      port,
      connectionUri: `redis://${host}:${port}`,
      error: `Could not connect to Redis at ${host}:${port}: ${errorMsg}. Verify Redis server is running locally (e.g. 'redis-server' or Docker) and port ${port} is open.`,
    };
  }
}
