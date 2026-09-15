import { NextRequest, NextResponse } from "next/server";
import net from "net";
import { sanitizeForConvex } from "@/lib/utils/convexSanitizer";

// Check TCP socket connectivity with timeout
function checkTcpSocket(
  host: string,
  port: number,
  timeoutMs = 2500,
): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      const latencyMs = Math.round((performance.now() - start) * 10) / 10;
      socket.destroy();
      resolve({ reachable: true, latencyMs });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        reachable: false,
        latencyMs: timeoutMs,
        error: `Connection timed out after ${timeoutMs}ms`,
      });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: 0, error: err.message });
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      resolve({
        reachable: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

// In-memory simulation store for Sandbox mode
const sandboxStore = new Map<string, unknown>();

interface TestOperationRequest {
  engine?: string;
  connection?: {
    host?: string;
    port?: number | string;
    connectionString?: string;
    connectionStringEnv?: string;
  };
  operation: {
    id?: string;
    name: string;
    kind?: string;
    code?: string;
    query?: string;
    signature?: string;
    params?: Array<{ name: string; type: string; defaultValue?: string }>;
  };
  args: Record<string, unknown>;
  mode?: "live" | "sandbox";
}

interface CommandPlan {
  command: string;
  args: (string | number)[];
  rawCli: string;
}

// Helper to extract or derive Redis command and arguments from operation definition
function planRedisCommand(
  op: TestOperationRequest["operation"],
  args: Record<string, unknown>,
): CommandPlan {
  const code = op.code || "";
  const name = op.name || "";
  const id = op.id || "";
  const key = String(args.key || args.id || "test:1");

  // 1. Check for explicit redis.call in code
  const callMatch = code.match(/redis\.call\(\s*["']([^"']+)["']\s*(?:,\s*([^)]+))?\)/);
  if (callMatch && callMatch[1]) {
    const rawCmd = callMatch[1].toUpperCase();

    // RedisJSON ARRAPPEND (Upsert root array with NX if key does not exist)
    if (rawCmd === "JSON.ARRAPPEND") {
      const itemVal = args.item !== undefined ? args.item : { sample: "value" };
      const itemStr = typeof itemVal === "string" ? itemVal : JSON.stringify(itemVal);
      const path = String(args.path || "$");
      return {
        command: "JSON.ARRAPPEND",
        args: [key, path, itemStr],
        rawCli: `JSON.SET ${key} ${path} '[]' NX\nJSON.ARRAPPEND ${key} ${path} '${itemStr}'`,
      };
    }

    // RedisJSON ARRPOP
    if (rawCmd === "JSON.ARRPOP") {
      const path = String(args.path || "$");
      const index = Number(args.index ?? -1);
      return {
        command: "JSON.ARRPOP",
        args: [key, path, index],
        rawCli: `JSON.ARRPOP ${key} ${path} ${index}`,
      };
    }

    // RedisJSON GET (slice or whole)
    if (rawCmd === "JSON.GET") {
      if (code.includes("[-") && args.count) {
        const count = Number(args.count ?? 20);
        const path = `$[-${count}:]`;
        return {
          command: "JSON.GET",
          args: [key, "INDENT", "", "NEWLINE", "", "SPACE", "", "PATH", path],
          rawCli: `JSON.GET ${key} PATH "${path}"`,
        };
      }
      if (args.path) {
        const path = String(args.path);
        return {
          command: "JSON.GET",
          args: [key, path],
          rawCli: `JSON.GET ${key} ${path}`,
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
      const val = args.value !== undefined ? args.value : args.item ?? { status: "active" };
      const valStr = typeof val === "string" ? val : JSON.stringify(val);
      const path = String(args.path || "$");
      return {
        command: "JSON.SET",
        args: [key, path, valStr],
        rawCli: `JSON.SET ${key} ${path} '${valStr}'`,
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
    const itemStr = typeof itemVal === "string" ? itemVal : JSON.stringify(itemVal);
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

  if (id.includes("hget") || (name.toLowerCase().startsWith("get") && args.field)) {
    const field = String(args.field || "field1");
    return {
      command: "HGET",
      args: [key, field],
      rawCli: `HGET ${key} ${field}`,
    };
  }

  if (id.includes("hset") || (name.toLowerCase().startsWith("set") && args.fields)) {
    const fields = (args.fields && typeof args.fields === "object" ? args.fields : {}) as Record<string, unknown>;
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

  if (id.includes("xadd") || name.toLowerCase().includes("stream") && name.toLowerCase().includes("add")) {
    const fields = (args.fields && typeof args.fields === "object" ? args.fields : {}) as Record<string, unknown>;
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

  if (id.includes("zadd") || name.toLowerCase().includes("member") && name.toLowerCase().includes("add")) {
    const score = Number(args.score ?? 100);
    const member = String(args.member || "member_1");
    return {
      command: "ZADD",
      args: [key, score, member],
      rawCli: `ZADD ${key} ${score} "${member}"`,
    };
  }

  if (id.includes("zrange") || name.toLowerCase().includes("top") || name.toLowerCase().includes("leaderboard")) {
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

  // Default fallback: GET / JSON.GET / HGETALL depending on presence of args
  if (args.value !== undefined) {
    const val = typeof args.value === "string" ? args.value : JSON.stringify(args.value);
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

// Execute command in Sandbox simulation
function executeInSandbox(plan: CommandPlan, args: Record<string, unknown>): unknown {
  const key = String(args.key || args.id || "test:1");
  const cmd = plan.command.toUpperCase();

  if (cmd === "JSON.ARRAPPEND") {
    const current = (sandboxStore.get(key) as unknown[]) || [];
    const item = args.item !== undefined ? args.item : { mock: true };
    const updated = Array.isArray(current) ? [...current, item] : [item];
    sandboxStore.set(key, updated);
    return updated.length;
  }

  if (cmd === "JSON.ARRPOP") {
    const current = (sandboxStore.get(key) as unknown[]) || [];
    if (!Array.isArray(current) || current.length === 0) return null;
    const popped = current.pop();
    sandboxStore.set(key, current);
    return popped;
  }

  if (cmd === "JSON.ARRLEN") {
    const current = (sandboxStore.get(key) as unknown[]) || [];
    return Array.isArray(current) ? current.length : 0;
  }

  if (cmd === "JSON.GET") {
    return sandboxStore.get(key) || [{ id: "mock_1", sample: "Simulated item", timestamp: new Date().toISOString() }];
  }

  if (cmd === "JSON.SET") {
    sandboxStore.set(key, args.value || args.item || {});
    return "OK";
  }

  if (cmd === "HGETALL") {
    return sandboxStore.get(key) || { id: key, name: "Sample Record", updated_at: String(Date.now()) };
  }

  if (cmd === "HGET") {
    const hash = (sandboxStore.get(key) as Record<string, unknown>) || {};
    const field = String(args.field || "name");
    return hash[field] ?? "Sample Value";
  }

  if (cmd === "HSET") {
    const prev = (sandboxStore.get(key) as Record<string, unknown>) || {};
    const fields = (args.fields && typeof args.fields === "object" ? args.fields : {}) as Record<string, unknown>;
    sandboxStore.set(key, { ...prev, ...fields });
    return Object.keys(fields).length || 1;
  }

  if (cmd === "XADD") {
    const id = `${Date.now()}-0`;
    return id;
  }

  if (cmd === "ZADD") {
    return 1;
  }

  if (cmd === "ZRANGE") {
    return ["member_1", "member_2", "member_3"];
  }

  if (cmd === "GET") {
    return sandboxStore.get(key) || "Simulated value";
  }

  if (cmd === "SET") {
    sandboxStore.set(key, args.value || "OK");
    return "OK";
  }

  if (cmd === "DEL") {
    const existed = sandboxStore.has(key);
    sandboxStore.delete(key);
    return existed ? 1 : 0;
  }

  return { success: true, message: `Simulated execution for command ${cmd}` };
}

export async function POST(req: NextRequest) {
  try {
    const body: TestOperationRequest = await req.json();
    const {
      engine = "redis",
      connection = {},
      operation,
      args = {},
      mode = "live",
    } = body;

    if (!operation || !operation.name) {
      return NextResponse.json({ error: "Operation definition is required" }, { status: 400 });
    }

    const host = connection.host || "127.0.0.1";
    const port = Number(connection.port) || (engine === "redis" ? 6379 : 5432);

    // 1. SANDBOX MODE
    if (mode === "sandbox") {
      const plan = planRedisCommand(operation, args);
      const start = performance.now();
      const output = sanitizeForConvex(executeInSandbox(plan, args));
      const durationMs = Math.round((performance.now() - start) * 100) / 100;

      return NextResponse.json({
        success: true,
        output,
        durationMs: Math.max(0.4, durationMs),
        rawCommand: plan.rawCli,
        mode: "sandbox",
      });
    }

    // 2. LIVE REDIS EXECUTION
    if (engine === "redis") {
      const plan = planRedisCommand(operation, args);
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

        // Capture specific socket / auth error emitted by ioredis
        client.on("error", (err: Error) => {
          socketErrorRef.message = err?.message || String(err);
        });

        await Promise.race([
          client.connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection to Redis timed out (2500ms)")), 2500),
          ),
        ]);

        // Execute dynamic command via call
        if (plan.command === "JSON.ARRAPPEND") {
          // Upsert: Initialize empty array with NX (only if key does not exist)
          const targetKey = String(plan.args[0] ?? "");
          const rootPath = String(plan.args[1] ?? "$");
          await client.call("JSON.SET", targetKey, rootPath, "[]", "NX");
        }

        const rawResult = await client.call(plan.command, ...plan.args);
        const durationMs = Math.round((performance.now() - start) * 10) / 10;

        client.disconnect();

        // If result is stringified JSON (common in RedisJSON or custom wrappers), parse it for clean display
        let formattedOutput: unknown = rawResult;
        if (typeof rawResult === "string") {
          try {
            formattedOutput = JSON.parse(rawResult);
          } catch {
            formattedOutput = rawResult;
          }
        }

        // RedisJSON v2 commands with JSONPath return an array of match results.
        // For commands returning scalar arrays (e.g. JSON.ARRAPPEND -> [1], JSON.ARRLEN -> [1]):
        // or path slice queries (e.g. JSON.GET key PATH "$[-20:]" -> [[...]]):
        // unwrap the outer match array so response matches the clean expected type.
        if (Array.isArray(formattedOutput) && formattedOutput.length === 1) {
          const cmd = plan.command.toUpperCase();
          if (cmd === "JSON.ARRAPPEND" || cmd === "JSON.ARRLEN") {
            const first = formattedOutput[0];
            if (typeof first === "number") {
              formattedOutput = first;
            }
          } else if (cmd === "JSON.ARRPOP") {
            formattedOutput = formattedOutput[0];
          } else if (cmd === "JSON.GET" && Array.isArray(formattedOutput[0])) {
            formattedOutput = formattedOutput[0];
          }
        }

        // Sanitize output for safe consumption & unwrap RedisJSON path envelopes (e.g. { "$[-20:]": [...] } -> [...])
        formattedOutput = sanitizeForConvex(formattedOutput);

        return NextResponse.json({
          success: true,
          output: formattedOutput,
          durationMs,
          rawCommand: plan.rawCli,
          mode: "live",
          connection: `redis://${host}:${port}`,
        });
      } catch (err: unknown) {
        const durationMs = Math.round((performance.now() - start) * 10) / 10;
        const errMessage = socketErrorRef.message || (err instanceof Error ? err.message : String(err));

        return NextResponse.json({
          success: false,
          serverActive: false,
          error: `Server not found or inactive on redis://${host}:${port}: ${errMessage}`,
          rawCommand: plan.rawCli,
          durationMs,
          mode: "live",
          tip: "Verify local Redis is running on this port, or switch to 'Simulation Sandbox' mode in the header to run mock test cases.",
        });
      }
    }

    // 3. LIVE RELATIONAL / TCP ENGINES (postgres, mysql, sqlite with TCP host/port)
    if (mode === "live") {
      const tcpResult = await checkTcpSocket(host, port, 2500);
      if (!tcpResult.reachable) {
        return NextResponse.json({
          success: false,
          serverActive: false,
          error: `Server not found or inactive: Could not reach ${engine.toUpperCase()} database server at ${host}:${port} (${tcpResult.error || "Connection refused"}).`,
          rawCommand: operation.query || `${operation.name}(${Object.keys(args).join(", ")})`,
          durationMs: tcpResult.latencyMs || 0,
          mode: "live",
          tip: `Ensure your local ${engine} database server is running and listening on port ${port}, or switch to 'Simulation Sandbox' mode to test operations safely without a live server.`,
        });
      }

      return NextResponse.json({
        success: true,
        serverActive: true,
        output: { message: `Live connection verified on ${host}:${port} (${engine})`, args },
        durationMs: tcpResult.latencyMs,
        rawCommand: operation.query || `${operation.name}(${Object.keys(args).join(", ")})`,
        mode: "live",
        connection: `${host}:${port}`,
      });
    }

    // 4. OTHER ENGINES SANDBOX FALLBACK
    return NextResponse.json({
      success: true,
      output: { message: `Query execution for ${engine} is ready`, args },
      durationMs: 1.2,
      rawCommand: operation.query || `${operation.name}(${Object.keys(args).join(", ")})`,
      mode: "sandbox",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to execute operation test",
      },
      { status: 500 },
    );
  }
}
