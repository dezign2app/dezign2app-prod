import { CommandPlan, isJsonObject } from "./types";

// In-memory simulation store for Sandbox mode
const sandboxStore = new Map<string, unknown>();

export function getStoredArray(key: string): unknown[] {
  const val = sandboxStore.get(key);
  return Array.isArray(val) ? val : [];
}

export function getStoredObject(key: string): Record<string, unknown> {
  const val = sandboxStore.get(key);
  return typeof val === "object" && val !== null && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

/**
 * Executes a planned command against the in-memory simulation sandbox.
 */
export function executeInSandbox(
  plan: CommandPlan,
  args: Record<string, unknown>,
): unknown {
  const key = String(args.key || args.id || "test:1");
  const cmd = plan.command.toUpperCase();

  if (cmd === "JSON.ARRAPPEND") {
    const current = getStoredArray(key);
    const item = args.item !== undefined ? args.item : { mock: true };
    const updated = [...current, item];
    sandboxStore.set(key, updated);
    return updated.length;
  }

  if (cmd === "JSON.ARRPOP") {
    const current = getStoredArray(key);
    if (current.length === 0) return null;
    const popped = current[current.length - 1] ?? null;
    sandboxStore.set(key, current.slice(0, -1));
    return popped;
  }

  if (cmd === "JSON.ARRLEN") {
    return getStoredArray(key).length;
  }

  if (cmd === "JSON.GET") {
    return (
      sandboxStore.get(key) || [
        {
          id: "mock_1",
          sample: "Simulated item",
          timestamp: new Date().toISOString(),
        },
      ]
    );
  }

  if (cmd === "JSON.SET") {
    sandboxStore.set(key, args.value || args.item || {});
    return "OK";
  }

  if (cmd === "HGETALL") {
    return (
      sandboxStore.get(key) || {
        id: key,
        name: "Sample Record",
        updated_at: String(Date.now()),
      }
    );
  }

  if (cmd === "HGET") {
    const hash = getStoredObject(key);
    const field = String(args.field || "name");
    return hash[field] ?? "Sample Value";
  }

  if (cmd === "HSET") {
    const prev = getStoredObject(key);
    const fields = isJsonObject(args.fields) ? args.fields : {};
    sandboxStore.set(key, { ...prev, ...fields });
    return Object.keys(fields).length || 1;
  }

  if (cmd === "XADD") {
    return `${Date.now()}-0`;
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
