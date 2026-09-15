"use client";

import React, { useState, useMemo } from "react";
import {
  Code2,
  Terminal,
  FileJson,
  Layers,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Sparkles,
  Zap,
} from "lucide-react";
import { BackendNode, RedisDataStructure, RedisDuration, RedisHashField } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@workspace/ui/components/tabs";
import { compileRedisSchema } from "@/lib/compiler/schemas/redis";
import { toPascalCase, toVarName } from "@/lib/compiler/utils";
import { extractTemplateParams } from "@/lib/compiler/redis/utils";
import { toast } from "sonner";

export interface RedisSchemaPreviewSectionProps {
  node: BackendNode;
  data: BackendNode["data"];
  label: string;
  structure: RedisDataStructure;
  keyTemplate: string;
  clusterTagParam?: string;
  ttl: RedisDuration;
  strategy?: string;
  hashFields: RedisHashField[];
}

export const RedisSchemaPreviewSection: React.FC<RedisSchemaPreviewSectionProps> = ({
  node,
  data,
  label,
  structure,
  keyTemplate,
  clusterTagParam,
  ttl,
  strategy,
  hashFields,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"ts" | "json" | "cli" | "sdk">("ts");
  const [copied, setCopied] = useState(false);

  const cleanLabel = label || "Cache";
  const typeName = toPascalCase(cleanLabel) || "Cache";
  const varName = toVarName(cleanLabel) || "cache";

  // 1. Template parameters & resolved sample key
  const templateParams = useMemo(() => {
    return extractTemplateParams(keyTemplate);
  }, [keyTemplate]);

  const sampleKey = useMemo(() => {
    if (!keyTemplate) {
      return `${varName.toLowerCase()}:1001`;
    }
    return keyTemplate.replace(/\{([^}]+)\}/g, (_, p) => {
      const low = p.toLowerCase();
      if (low.includes("id")) return "1001";
      if (low.includes("token") || low.includes("session")) return "sess_99a8x";
      if (low.includes("date")) return "2026-08-22";
      if (low.includes("user")) return "usr_42";
      if (low.includes("org") || low.includes("tenant")) return "org_10";
      return `val_${p}`;
    });
  }, [keyTemplate, varName]);

  // 2. Calculated TTL in seconds & human-friendly format
  const ttlSeconds = useMemo(() => {
    if (!ttl || ttl.value === undefined) return 3600;
    const val = ttl.value;
    const unit = ttl.unit;
    if (unit === "never" || val === 0) return 0;
    if (unit === "d") return val * 86400;
    if (unit === "h") return val * 3600;
    if (unit === "m") return val * 60;
    return val;
  }, [ttl]);

  const ttlFormatted = useMemo(() => {
    if (ttlSeconds === 0) return "Persistent (No TTL)";
    if (ttl?.unit === "d") return `${ttl.value} Days (${ttlSeconds.toLocaleString()}s)`;
    if (ttl?.unit === "h") return `${ttl.value} Hours (${ttlSeconds.toLocaleString()}s)`;
    if (ttl?.unit === "m") return `${ttl.value} Mins (${ttlSeconds}s)`;
    return `${ttlSeconds}s`;
  }, [ttl, ttlSeconds]);

  // 3. Compiled TypeScript Code
  const typeScriptCode = useMemo(() => {
    try {
      const res = compileRedisSchema(node);
      return res.file.content;
    } catch (err) {
      return `// Note: Live schema generation preview\n// ${err instanceof Error ? err.message : String(err)}`;
    }
  }, [node]);

  // 4. Realistic Mock Payload Generator (Sample JSON)
  const samplePayloadCode = useMemo(() => {
    // Helper to generate context-aware mock values
    const mockVal = (name: string, type?: string, sampleIdx = 1): unknown => {
      const n = name.toLowerCase();
      if (type === "number" || n.includes("count") || n.includes("score") || n.includes("num") || n.includes("price") || n.includes("age")) {
        return sampleIdx === 1 ? 42 : 108;
      }
      if (type === "boolean" || n.includes("is") || n.includes("has") || n.includes("active") || n.includes("enabled")) {
        return sampleIdx === 1 ? true : false;
      }
      if (type === "datetime" || n.includes("time") || n.includes("date") || n.includes("at")) {
        return sampleIdx === 1 ? "2026-09-14T12:00:00Z" : "2026-09-14T12:05:30Z";
      }
      if (type === "json") {
        return { detail: "metadata_v1", status: "ok" };
      }
      if (n === "sender" || n === "author" || n === "user") {
        return sampleIdx === 1 ? "user_alice" : "user_bob";
      }
      if (n === "message" || n === "content" || n === "text" || n === "body") {
        return sampleIdx === 1
          ? "Hello! This is a sample cached conversation message."
          : "Understood! Everything is running smoothly.";
      }
      if (n === "email") return sampleIdx === 1 ? "alice@example.com" : "bob@example.com";
      if (n === "username" || n === "name") return sampleIdx === 1 ? "Alice Smith" : "Bob Jones";
      if (n.includes("id")) return sampleIdx === 1 ? "rec_1001" : "rec_1002";
      return sampleIdx === 1 ? `sample_${name}` : `secondary_${name}`;
    };

    if (structure === "json") {
      if (data?.isNestedJsonSchema && data?.rawJsonSchema) {
        try {
          const parsed = JSON.parse(data.rawJsonSchema);
          return JSON.stringify(parsed, null, 2);
        } catch {
          // fall through
        }
      }

      const fields = hashFields && hashFields.length > 0 ? hashFields : [{ name: "id", type: "string" }];
      const item1: Record<string, unknown> = {};
      const item2: Record<string, unknown> = {};
      fields.forEach((f) => {
        item1[f.name] = mockVal(f.name, f.type, 1);
        item2[f.name] = mockVal(f.name, f.type, 2);
      });

      if (data?.jsonRootType === "array") {
        return JSON.stringify([item1, item2], null, 2);
      }
      return JSON.stringify(item1, null, 2);
    }

    if (structure === "hash") {
      const fields = hashFields && hashFields.length > 0 ? hashFields : [{ name: "id", type: "string" }, { name: "name", type: "string" }];
      const obj: Record<string, unknown> = {};
      fields.forEach((f) => {
        obj[f.name] = mockVal(f.name, f.type, 1);
      });
      return JSON.stringify(obj, null, 2);
    }

    if (structure === "list") {
      const elemType = data?.listConfig?.elementType || "string";
      if (elemType === "number") return JSON.stringify([10, 20, 30, 40], null, 2);
      return JSON.stringify(["item_alpha", "item_beta", "item_gamma"], null, 2);
    }

    if (structure === "set") {
      return JSON.stringify(["tag_redis", "tag_database", "tag_cache"], null, 2);
    }

    if (structure === "zset") {
      return JSON.stringify(
        [
          { member: "player_phoenix", score: 980 },
          { member: "player_titan", score: 845 },
          { member: "player_apex", score: 720 },
        ],
        null,
        2,
      );
    }

    if (structure === "stream") {
      return JSON.stringify(
        {
          id: "1726300000000-0",
          fields: {
            eventType: "message_created",
            sender: "user_alice",
            payload: { message: "Sample streaming event payload" },
          },
        },
        null,
        2,
      );
    }

    if (structure === "geo") {
      return JSON.stringify(
        [
          { member: "station_alpha", longitude: -122.4194, latitude: 37.7749 },
          { member: "station_beta", longitude: -122.4089, latitude: 37.7833 },
        ],
        null,
        2,
      );
    }

    if (structure === "string") {
      return JSON.stringify({ value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }, null, 2);
    }

    if (structure === "bitfield") {
      return JSON.stringify(
        {
          loginCount: 14,
          tierLevel: 3,
          flags: 1,
        },
        null,
        2,
      );
    }

    if (structure === "bitmap") {
      return JSON.stringify(
        [
          { offset: 0, bit: 1, description: "Daily active flag" },
          { offset: 1, bit: 0, description: "Push notification enabled" },
          { offset: 2, bit: 1, description: "Email verified" },
        ],
        null,
        2,
      );
    }

    if (structure === "hyperloglog") {
      return JSON.stringify(
        {
          estimatedCardinality: 14205,
          sampleMembersAdded: ["ip_192.168.1.1", "ip_10.0.0.12", "ip_172.16.0.4"],
        },
        null,
        2,
      );
    }

    return JSON.stringify({ key: sampleKey, status: "active" }, null, 2);
  }, [structure, data, hashFields, sampleKey]);

  // 5. Executable Redis CLI Commands
  const redisCliCommands = useMemo(() => {
    const lines: string[] = [];
    lines.push(`# ── Redis CLI Interactive Commands for ${cleanLabel} ──`);
    lines.push(`# Target Sample Key: ${sampleKey}\n`);

    if (structure === "json") {
      const minPayload = samplePayloadCode.replace(/\n\s*/g, " ");
      lines.push(`# 1. Write / Update JSON Document`);
      lines.push(`JSON.SET ${sampleKey} $ '${minPayload}'\n`);

      lines.push(`# 2. Read Complete Document`);
      lines.push(`JSON.GET ${sampleKey} $\n`);

      if (data?.jsonRootType === "array") {
        lines.push(`# 3. Query First Item or Specific Element`);
        lines.push(`JSON.GET ${sampleKey} $[0]\n`);

        lines.push(`# 4. Append Item to Array`);
        lines.push(`JSON.ARRAPPEND ${sampleKey} $ '{"sender":"user_carol","message":"New message"}'\n`);
      } else {
        const firstField = hashFields[0]?.name || "id";
        lines.push(`# 3. Query Specific Field Path`);
        lines.push(`JSON.GET ${sampleKey} $.${firstField}\n`);
      }

      if (ttlSeconds > 0) {
        lines.push(`# 5. Set TTL Expiration (${ttlFormatted})`);
        lines.push(`EXPIRE ${sampleKey} ${ttlSeconds}\n`);
      }

      lines.push(`# 6. Inspect Key Status & Invalidate`);
      lines.push(`TTL ${sampleKey}`);
      lines.push(`DEL ${sampleKey}`);
    } else if (structure === "hash") {
      const fieldsStr =
        hashFields.length > 0
          ? hashFields.map((f) => `${f.name} "${f.name === "sender" ? "alice" : "sample_val"}"`).join(" ")
          : 'field1 "value1" field2 "value2"';

      lines.push(`# 1. Set Hash Fields`);
      lines.push(`HSET ${sampleKey} ${fieldsStr}\n`);

      lines.push(`# 2. Retrieve All Fields`);
      lines.push(`HGETALL ${sampleKey}\n`);

      const firstField = hashFields[0]?.name || "id";
      lines.push(`# 3. Retrieve Specific Field`);
      lines.push(`HGET ${sampleKey} ${firstField}\n`);

      if (ttlSeconds > 0) {
        lines.push(`# 4. Set Key Expiration (${ttlFormatted})`);
        lines.push(`EXPIRE ${sampleKey} ${ttlSeconds}\n`);

        lines.push(`# 5. Redis 7.4+ Field-Level TTL`);
        lines.push(`HEXPIRE ${sampleKey} ${ttlSeconds} FIELDS 1 ${firstField}\n`);
      }

      lines.push(`# 6. Invalidate Cache`);
      lines.push(`DEL ${sampleKey}`);
    } else if (structure === "list") {
      lines.push(`# 1. Push Items to List`);
      lines.push(`RPUSH ${sampleKey} "item_alpha" "item_beta"\n`);

      lines.push(`# 2. Read Elements`);
      lines.push(`LRANGE ${sampleKey} 0 -1\n`);

      lines.push(`# 3. Check List Length`);
      lines.push(`LLEN ${sampleKey}\n`);

      if (ttlSeconds > 0) {
        lines.push(`EXPIRE ${sampleKey} ${ttlSeconds}\n`);
      }
      lines.push(`DEL ${sampleKey}`);
    } else if (structure === "set") {
      lines.push(`# 1. Add Unique Members`);
      lines.push(`SADD ${sampleKey} "member_alpha" "member_beta"\n`);

      lines.push(`# 2. Get All Members`);
      lines.push(`SMEMBERS ${sampleKey}\n`);

      lines.push(`# 3. Check Membership`);
      lines.push(`SISMEMBER ${sampleKey} "member_alpha"\n`);

      if (ttlSeconds > 0) {
        lines.push(`EXPIRE ${sampleKey} ${ttlSeconds}\n`);
      }
      lines.push(`DEL ${sampleKey}`);
    } else if (structure === "zset") {
      lines.push(`# 1. Add Scored Members`);
      lines.push(`ZADD ${sampleKey} 100 "team_alpha" 85 "team_beta"\n`);

      lines.push(`# 2. Read Sorted Rankings with Scores`);
      lines.push(`ZREVRANGE ${sampleKey} 0 -1 WITHSCORES\n`);

      lines.push(`# 3. Query Score of Member`);
      lines.push(`ZSCORE ${sampleKey} "team_alpha"\n`);

      if (ttlSeconds > 0) {
        lines.push(`EXPIRE ${sampleKey} ${ttlSeconds}\n`);
      }
      lines.push(`DEL ${sampleKey}`);
    } else if (structure === "stream") {
      lines.push(`# 1. Append Stream Event`);
      lines.push(`XADD ${sampleKey} * eventType "message_created" sender "alice"\n`);

      lines.push(`# 2. Read Recent Stream Events`);
      lines.push(`XREVRANGE ${sampleKey} + - COUNT 10\n`);

      lines.push(`# 3. Consumer Group Read`);
      lines.push(`XREADGROUP GROUP workers consumer_1 COUNT 5 STREAMS ${sampleKey} >\n`);

      if (ttlSeconds > 0) {
        lines.push(`EXPIRE ${sampleKey} ${ttlSeconds}\n`);
      }
    } else if (structure === "geo") {
      lines.push(`# 1. Add Geolocation Coordinates`);
      lines.push(`GEOADD ${sampleKey} -122.4194 37.7749 "SanFrancisco" -122.4089 37.7833 "Downtown"\n`);

      lines.push(`# 2. Query Locations Within 25km`);
      lines.push(`GEORADIUS ${sampleKey} -122.4194 37.7749 25 km WITHDIST WITHCOORD\n`);

      lines.push(`# 3. Distance Between Locations`);
      lines.push(`GEODIST ${sampleKey} "SanFrancisco" "Downtown" km\n`);

      if (ttlSeconds > 0) {
        lines.push(`EXPIRE ${sampleKey} ${ttlSeconds}\n`);
      }
    } else {
      lines.push(`# 1. Set Value with Expiration`);
      lines.push(`SET ${sampleKey} "active" ${ttlSeconds > 0 ? `EX ${ttlSeconds}` : ""}\n`);

      lines.push(`# 2. Get Value`);
      lines.push(`GET ${sampleKey}\n`);

      lines.push(`# 3. Delete Key`);
      lines.push(`DEL ${sampleKey}`);
    }

    lines.push(`\n# Keyspace Scan Filter`);
    lines.push(`SCAN 0 MATCH ${keyTemplate.replace(/\{[a-zA-Z0-9_]+\}/g, "*")} COUNT 100`);

    return lines.join("\n");
  }, [cleanLabel, sampleKey, structure, samplePayloadCode, data, hashFields, ttlSeconds, ttlFormatted, keyTemplate]);

  // 6. Node.js SDK (ioredis) Service Usage Code
  const nodeJsSdkCode = useMemo(() => {
    const keyParamSig =
      templateParams.length > 0
        ? templateParams.map((p) => `${p}: string | number`).join(", ")
        : "id: string | number";
    const keyParamCall = templateParams.length > 0 ? templateParams.join(", ") : "id";

    let readCall = "";
    let writeCall = "";

    if (structure === "json") {
      readCall = `  // 1. Query RedisJSON document
  const raw = await redis.call("JSON.GET", key, "$");
  if (!raw) return null;
  const parsed = JSON.parse(raw as string);
  return (Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : parsed) as ${typeName};`;

      writeCall = `  // 1. Write RedisJSON document with root dollar path
  await redis.call("JSON.SET", key, "$", JSON.stringify(data));
  ${ttlSeconds > 0 ? `await redis.expire(key, ${typeName.toUpperCase()}_TTL_SECONDS);` : ""}`;
    } else if (structure === "hash") {
      readCall = `  // 1. Query Hash fields
  const data = await redis.hgetall(key);
  if (!data || Object.keys(data).length === 0) return null;
  return data as unknown as ${typeName};`;

      writeCall = `  // 1. Write Hash fields
  await redis.hset(key, data as Record<string, string | number>);
  ${ttlSeconds > 0 ? `await redis.expire(key, ${typeName.toUpperCase()}_TTL_SECONDS);` : ""}`;
    } else if (structure === "list") {
      readCall = `  // 1. Retrieve list items
  const items = await redis.lrange(key, 0, -1);
  return items as unknown as ${typeName};`;

      writeCall = `  // 1. Overwrite / push list items
  await redis.del(key);
  if (Array.isArray(data) && data.length > 0) {
    await redis.rpush(key, ...(data as string[]));
  }
  ${ttlSeconds > 0 ? `await redis.expire(key, ${typeName.toUpperCase()}_TTL_SECONDS);` : ""}`;
    } else {
      readCall = `  // 1. Query cached record
  const cached = await redis.get(key);
  if (!cached) return null;
  return JSON.parse(cached) as ${typeName};`;

      writeCall = `  // 1. Write record
  await redis.set(key, JSON.stringify(data)${ttlSeconds > 0 ? `, "EX", ${typeName.toUpperCase()}_TTL_SECONDS` : ""});`;
    }

    return `import { redis } from "@/lib/redis";
import {
  get${typeName}Key,
  ${typeName},
  ${typeName.toUpperCase()}_TTL_SECONDS,
} from "@/schemas/${varName}";

/**
 * Cache Strategy: ${strategy || "Cache Aside"}
 * Key Pattern: ${keyTemplate || `${varName}:{id}`}
 * Default TTL: ${ttlFormatted}
 */

/**
 * Retrieve ${typeName} from Redis Cache
 */
export async function get${typeName}(${keyParamSig}): Promise<${typeName} | null> {
  const key = get${typeName}Key(${keyParamCall});
${readCall}
}

/**
 * Persist ${typeName} into Redis Cache
 */
export async function set${typeName}(
  ${keyParamSig},
  data: ${typeName},
): Promise<void> {
  const key = get${typeName}Key(${keyParamCall});
${writeCall}
}

/**
 * Invalidate ${typeName} from Redis Cache
 */
export async function invalidate${typeName}(${keyParamSig}): Promise<void> {
  const key = get${typeName}Key(${keyParamCall});
  await redis.del(key);
}
`;
  }, [templateParams, structure, typeName, ttlSeconds, ttlFormatted, varName, strategy, keyTemplate]);

  // Current active code based on selected tab
  const activeCode = useMemo(() => {
    switch (activeTab) {
      case "ts":
        return typeScriptCode;
      case "json":
        return samplePayloadCode;
      case "cli":
        return redisCliCommands;
      case "sdk":
        return nodeJsSdkCode;
    }
  }, [activeTab, typeScriptCode, samplePayloadCode, redisCliCommands, nodeJsSdkCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    const tabName =
      activeTab === "ts"
        ? "TypeScript Schema"
        : activeTab === "json"
          ? "Sample Payload"
          : activeTab === "cli"
            ? "Redis CLI Commands"
            : "Node.js SDK Service";
    toast.success(`${tabName} copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm backdrop-blur-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div
          className="flex items-center gap-2 cursor-pointer select-none group"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
            <Code2 size={14} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Live Schema & Operations Preview
            </span>
            <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
              (Live Generated)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Resolved Key Badge */}
          <Badge
            variant="outline"
            className="text-[10px] font-mono bg-background/80 border-border/60 text-foreground hidden sm:flex gap-1"
            title={`Resolved sample key: ${sampleKey}`}
          >
            <span className="text-muted-foreground">Key:</span> {sampleKey}
          </Badge>

          {/* Copy Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs px-2.5 gap-1.5 text-muted-foreground hover:text-foreground border-border/60"
            title="Copy current code preview"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </Button>

          {/* Collapse / Expand toggle button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-3 pt-1">
          {/* Metadata badges strip */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
            <Badge
              variant="outline"
              className="text-[10px] font-mono uppercase bg-muted text-foreground border-border/60 font-medium"
            >
              {structure}
              {structure === "json" ? (data?.jsonRootType === "array" ? " [ ] Array" : " { } Object") : ""}
            </Badge>

            <Badge variant="outline" className="text-[10px] font-mono bg-secondary/50 text-foreground">
              TTL: {ttlFormatted}
            </Badge>

            <Badge variant="outline" className="text-[10px] font-mono bg-secondary/50 text-foreground">
              Strategy: {strategy}
            </Badge>

            {clusterTagParam && (
              <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                Tag: &#123;{clusterTagParam}&#125;
              </Badge>
            )}
          </div>

          {/* Tab Navigation */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "ts" | "json" | "cli" | "sdk")}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 h-8 bg-secondary/40 p-0.5 border border-border/40 rounded-lg">
              <TabsTrigger
                value="ts"
                className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs py-1"
              >
                <Code2 size={12} className="text-blue-500" />
                <span>TypeScript</span>
              </TabsTrigger>

              <TabsTrigger
                value="json"
                className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs py-1"
              >
                <FileJson size={12} className="text-amber-500" />
                <span>Sample JSON</span>
              </TabsTrigger>

              <TabsTrigger
                value="cli"
                className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs py-1"
              >
                <Terminal size={12} className="text-emerald-500" />
                <span>Redis CLI</span>
              </TabsTrigger>

              <TabsTrigger
                value="sdk"
                className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs py-1"
              >
                <Zap size={12} className="text-purple-500" />
                <span>Node.js SDK</span>
              </TabsTrigger>
            </TabsList>

            {/* Code View Area */}
            <div className="relative mt-2.5 rounded-lg border border-border/60 bg-neutral-950/90 dark:bg-neutral-950 p-3 shadow-inner">
              <pre className="text-[11px] font-mono text-neutral-200 dark:text-neutral-200 overflow-x-auto max-h-[300px] leading-relaxed select-all whitespace-pre">
                {activeCode}
              </pre>

              {/* Bottom Status Bar */}
              <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                <span className="truncate">
                  {activeTab === "ts" && `File: src/schemas/${varName}.ts`}
                  {activeTab === "json" && `Structure: ${structure} payload`}
                  {activeTab === "cli" && `CLI: redis-cli --raw`}
                  {activeTab === "sdk" && `Client: ioredis / node-redis`}
                </span>
                <span className="shrink-0 text-neutral-500">
                  Target: Redis 7.4+
                </span>
              </div>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
};
