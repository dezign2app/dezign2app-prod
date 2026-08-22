import React, { useState } from "react";
import {
  DatabaseZap,
  Key,
  Layers,
  Sparkles,
  Clock,
  Radio,
  MapPin,
  ListOrdered,
  List,
  Binary,
  Share2,
  Plus,
  Trash2,
  Settings,
  Server,
  Info,
  Check,
  Copy,
  ExternalLink,
  ShieldAlert,
  RotateCw,
} from "lucide-react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  BackendNode,
  RedisDataStructure,
  RedisDuration,
  RedisDurationUnit,
  RedisHashField,
  RedisStreamConsumerGroup,
  RedisBitfieldSubfield,
} from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Switch } from "@workspace/ui/components/switch";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import {
  extractKeyTemplateParams,
  deriveKeyPattern,
  deriveNamespace,
  REDIS_DATA_STRUCTURE_OPTIONS,
} from "../backend-nodes/entity-node/RedisConfig";
import { cn } from "@workspace/ui/lib/utils";

interface RedisSchemaConfigProps {
  id: string;
  nodeId: string;
}

type CacheStrategy = NonNullable<BackendNode["data"]["cacheStrategy"]>;
type SerializationFormat = NonNullable<BackendNode["data"]["serialization"]>;
type CompressionFormat = NonNullable<BackendNode["data"]["compression"]>;

function isCacheStrategy(val: string): val is CacheStrategy {
  return (
    val === "Cache Aside" ||
    val === "Read Through" ||
    val === "Write Through" ||
    val === "Write Behind" ||
    val === "Refresh Ahead"
  );
}

function isSerializationFormat(val: string): val is SerializationFormat {
  return (
    val === "JSON" ||
    val === "MessagePack" ||
    val === "ProtoBuf" ||
    val === "String" ||
    val === "Binary"
  );
}

function isCompressionFormat(val: string): val is CompressionFormat {
  return (
    val === "None" ||
    val === "gzip" ||
    val === "brotli" ||
    val === "lz4"
  );
}

function isRedisHashFieldType(val: string): val is RedisHashField["type"] {
  return (
    val === "string" ||
    val === "number" ||
    val === "boolean" ||
    val === "json" ||
    val === "datetime" ||
    val === "binary"
  );
}

function isGeoMemberType(val: string): val is "string" | "number" | "uuid" {
  return val === "string" || val === "number" || val === "uuid";
}

function isGeoDistanceUnit(val: string): val is "m" | "km" | "mi" | "ft" {
  return val === "m" || val === "km" || val === "mi" || val === "ft";
}

function isBitfieldOverflow(val: string): val is "WRAP" | "SAT" | "FAIL" {
  return val === "WRAP" || val === "SAT" || val === "FAIL";
}

function isZSetScoreType(val: string): val is "number" | "timestamp" | "float" {
  return val === "number" || val === "timestamp" || val === "float";
}

function isSortOrder(val: string): val is "asc" | "desc" {
  return val === "asc" || val === "desc";
}

function isListOrientation(val: string): val is "FIFO" | "LIFO" {
  return val === "FIFO" || val === "LIFO";
}

function isRedisDurationUnit(val: string): val is RedisDurationUnit {
  return (
    val === "s" ||
    val === "m" ||
    val === "h" ||
    val === "d" ||
    val === "never"
  );
}

const TTL_PRESETS: Array<{ label: string; duration: RedisDuration }> = [
  { label: "60s", duration: { value: 60, unit: "s" } },
  { label: "5m", duration: { value: 5, unit: "m" } },
  { label: "15m", duration: { value: 15, unit: "m" } },
  { label: "1h", duration: { value: 1, unit: "h" } },
  { label: "24h", duration: { value: 24, unit: "h" } },
  { label: "7d", duration: { value: 7, unit: "d" } },
  { label: "Persistent", duration: { value: 0, unit: "never" } },
];

export const RedisSchemaConfig: React.FC<RedisSchemaConfigProps> = ({
  nodeId,
}) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === nodeId),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const allNodes = useBackendCanvasStore((s) => s.nodes);

  const [aiPrompt, setAiPrompt] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  if (!node || node.type !== "entity") {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Redis Schema node not found.
      </div>
    );
  }

  const data = node.data || {};
  const label = data.label || "Redis_Schema";
  const structure: RedisDataStructure = data.redisDataStructure || "hash";
  const keyTemplate = data.keyTemplate || "user:{id}:profile";
  const clusterTagParam = data.clusterHashTagParam;
  const ttl: RedisDuration = data.ttl || { value: 3600, unit: "s" };
  const strategy = data.cacheStrategy || "Cache Aside";
  const negativeCaching = data.negativeCaching || { enabled: false, ttl: { value: 60, unit: "s" } };
  const staleWhileRevalidate = data.staleWhileRevalidate || {
    enabled: false,
    refreshInterval: { value: 300, unit: "s" },
  };

  const keyPattern = deriveKeyPattern(keyTemplate);
  const namespace = deriveNamespace(keyTemplate);
  const params = extractKeyTemplateParams(keyTemplate);

  // Parent Database Node
  const dbNodes = allNodes.filter((n) => n.type === "database");
  const parentDb = allNodes.find((n) => n.id === data.databaseId);

  // Available Table Nodes on Canvas for Source of Truth
  const tableNodes = allNodes.filter(
    (n) => n.type === "entity" && n.id !== nodeId && n.data?.dbType !== "redis",
  );

  const updateData = (changes: Partial<BackendNode["data"]>) => {
    updateNode(nodeId, {
      data: {
        ...data,
        ...changes,
      },
    });
  };

  // Sample Key preview resolution (e.g. user:{id}:profile -> user:usr_9918:profile)
  const sampleKey = keyTemplate.replace(/\{([^}]+)\}/g, (_, p) => {
    if (p.toLowerCase().includes("id")) return "1001";
    if (p.toLowerCase().includes("token") || p.toLowerCase().includes("session"))
      return "sess_99a8x";
    if (p.toLowerCase().includes("date")) return "2026-08-22";
    return `val_${p}`;
  });

  const handleCopyKey = () => {
    navigator.clipboard.writeText(sampleKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Preset AI Templates
  const handleApplyPreset = (presetName: string) => {
    if (presetName === "user_profile") {
      updateData({
        label: "User_Profile_Cache",
        redisDataStructure: "hash",
        keyTemplate: "user:{id}:profile",
        clusterHashTagParam: "id",
        ttl: { value: 1, unit: "h" },
        cacheStrategy: "Cache Aside",
        negativeCaching: { enabled: true, ttl: { value: 60, unit: "s" } },
        hashConfig: {
          fields: [
            { name: "id", type: "string", required: true },
            { name: "username", type: "string", required: true },
            { name: "email", type: "string", required: true },
            { name: "avatarUrl", type: "string", required: false },
            { name: "role", type: "string", defaultValue: "member" },
            { name: "lastActive", type: "datetime", ttl: { value: 300, unit: "s" } },
          ],
        },
        columns: [
          { name: "id", type: "TEXT", isPrimaryKey: true },
          { name: "username", type: "TEXT" },
          { name: "email", type: "TEXT" },
          { name: "avatarUrl", type: "TEXT" },
        ],
      });
    } else if (presetName === "session_store") {
      updateData({
        label: "User_Session_Store",
        redisDataStructure: "string",
        keyTemplate: "session:{token}",
        clusterHashTagParam: "token",
        ttl: { value: 24, unit: "h" },
        cacheStrategy: "Read Through",
        serialization: "JSON",
        staleWhileRevalidate: { enabled: true, refreshInterval: { value: 15, unit: "m" } },
      });
    } else if (presetName === "leaderboard") {
      updateData({
        label: "Game_Leaderboard",
        redisDataStructure: "zset",
        keyTemplate: "leaderboard:{gameId}:daily",
        clusterHashTagParam: "gameId",
        ttl: { value: 24, unit: "h" },
        cacheStrategy: "Cache Aside",
        zsetConfig: {
          memberType: "uuid",
          scoreType: "number",
          sortOrder: "desc",
        },
      });
    } else if (presetName === "geo_locations") {
      updateData({
        label: "Driver_Locations_Geo",
        redisDataStructure: "geo",
        keyTemplate: "geo:drivers:{cityId}",
        clusterHashTagParam: "cityId",
        ttl: { value: 15, unit: "m" },
        geoConfig: {
          longitudeField: "lon",
          latitudeField: "lat",
          memberType: "string",
          distanceUnit: "km",
        },
      });
    } else if (presetName === "activity_stream") {
      updateData({
        label: "Activity_Stream",
        redisDataStructure: "stream",
        keyTemplate: "stream:events:{tenantId}",
        clusterHashTagParam: "tenantId",
        ttl: { value: 7, unit: "d" },
        streamConfig: {
          fields: [
            { name: "eventType", type: "string" },
            { name: "userId", type: "string" },
            { name: "payload", type: "json" },
          ],
          maxLen: 10000,
          approximateTrim: true,
          consumerGroups: [
            { name: "notification-workers", description: "Processes user notifications" },
            { name: "analytics-pipeline", description: "Aggregates clickstream events" },
          ],
        },
      });
    } else if (presetName === "bitfield_counters") {
      updateData({
        label: "User_Feature_Bitfield",
        redisDataStructure: "bitfield",
        keyTemplate: "flags:user:{id}",
        clusterHashTagParam: "id",
        ttl: { value: 30, unit: "d" },
        bitfieldConfig: {
          fields: [
            { name: "loginCount", type: "u", bits: 16, offset: 0, overflow: "SAT" },
            { name: "tierLevel", type: "u", bits: 4, offset: 16 },
            { name: "flags", type: "u", bits: 8, offset: 20 },
          ],
        },
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-2 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <DatabaseZap size={22} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight truncate">{label}</h2>
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-mono bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 font-semibold"
              >
                {structure}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure Redis keyspace, key template with cluster tags, data structure schema, and caching policies.
            </p>
          </div>
        </div>

        {/* Schema Label Renaming */}
        <div className="flex flex-col gap-1 pt-1">
          <Label className="text-xs font-semibold">Schema Identifier / Label</Label>
          <Input
            value={label}
            onChange={(e) => updateData({ label: e.target.value })}
            placeholder="e.g. User_Profile_Cache"
            className="h-8 text-xs font-semibold"
          />
        </div>
      </div>

      {/* 1. AI Fill & Quick Schema Presets */}
      <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 dark:bg-red-950/20 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} /> AI Schema Generator & Presets
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Input
            className="flex-1 text-xs bg-background"
            placeholder="Describe cache (e.g. Cache user profile with email, avatar, 1h TTL, hash tag on user id)"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && aiPrompt.trim()) {
                handleApplyPreset("user_profile");
              }
            }}
          />
          <Button
            size="sm"
            className="h-8 text-xs shrink-0 bg-red-600 hover:bg-red-700 text-white"
            onClick={() => handleApplyPreset("user_profile")}
          >
            Generate
          </Button>
        </div>

        {/* Quick Starter Templates */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] text-muted-foreground">Starter Presets:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset("user_profile")}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
          >
            User Hash
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("session_store")}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
          >
            Session String
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("leaderboard")}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
          >
            ZSet Leaderboard
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("geo_locations")}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
          >
            GEO Drivers
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("activity_stream")}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
          >
            Stream Groups
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("bitfield_counters")}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/50 hover:border-red-500/40 text-muted-foreground hover:text-foreground transition-all"
          >
            Bitfield Counters
          </button>
        </div>
      </div>

      {/* 2. Keyspace & Key Template Architecture */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Key size={14} className="text-red-500" /> Keyspace & Key Template
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            Namespace: {namespace}
          </Badge>
        </div>

        {/* Key Template Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Key Template (Shape with variables)</Label>
            <span className="text-[10px] text-muted-foreground">
              Use <code className="font-mono text-foreground">{`{variable}`}</code> for dynamic segments
            </span>
          </div>
          <Input
            value={keyTemplate}
            onChange={(e) => {
              const val = e.target.value;
              const extracted = extractKeyTemplateParams(val);
              const newClusterTag =
                clusterTagParam && extracted.includes(clusterTagParam)
                  ? clusterTagParam
                  : extracted[0] || undefined;
              updateData({
                keyTemplate: val,
                clusterHashTagParam: newClusterTag,
              });
            }}
            placeholder="e.g. user:{id}:profile or session:{token}"
            className="h-8 text-xs font-mono bg-background"
          />
        </div>

        {/* Auto-Derived Key Pattern & Cluster Hash Tag */}
        <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Auto-Derived Scan Pattern
            </span>
            <code className="text-xs font-mono font-bold text-foreground bg-background/80 px-2 py-1 rounded border border-border/40 truncate">
              {keyPattern}
            </code>
            <span className="text-[10px] text-muted-foreground">
              Used for SCAN / wildcard keyspace operations.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Cluster Hash Tag Variable
            </span>
            {params.length > 0 ? (
              <Select
                value={clusterTagParam || "none"}
                onValueChange={(val) =>
                  updateData({
                    clusterHashTagParam: val === "none" ? undefined : val,
                  })
                }
              >
                <SelectTrigger className="h-7 text-xs font-mono bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs italic text-muted-foreground">
                    None (Default Hashing)
                  </SelectItem>
                  {params.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs font-mono">
                      {`{${p}}`} (Cluster Shard Co-location)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs italic text-muted-foreground py-1">
                No variables in template
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              Co-locates keys with the same tag onto the same Redis shard.
            </span>
          </div>
        </div>

        {/* Live Key Resolver Preview */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
              Resolved Key Example:
            </span>
            <code className="text-xs font-mono font-bold text-red-600 dark:text-red-400 truncate">
              {sampleKey}
            </code>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] gap-1 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopyKey}
          >
            {copiedKey ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copiedKey ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {/* 3. Redis Data Structure Selection */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={14} className="text-red-500" /> Redis Data Structure
          </span>
        </div>

        {/* Data Structure Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {REDIS_DATA_STRUCTURE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = structure === opt.value;
            return (
              <div
                key={opt.value}
                onClick={() => updateData({ redisDataStructure: opt.value })}
                className={cn(
                  "p-2.5 rounded-lg border flex flex-col gap-1 cursor-pointer transition-all",
                  isSelected
                    ? "bg-red-500/15 border-red-500 text-foreground font-semibold shadow-sm"
                    : "bg-background/60 border-border/50 text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={14} className={isSelected ? "text-red-600 dark:text-red-400" : "text-muted-foreground"} />
                  <span className="text-xs">{opt.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/80 line-clamp-1">{opt.desc}</span>
              </div>
            );
          })}
        </div>

        {/* ── Structure Specific Detailed Configs ── */}

        {/* A. HASH FIELDS CONFIG (with Redis 7.4+ Per-Field TTL) */}
        {structure === "hash" && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Hash Fields Schema ({data.hashConfig?.fields?.length || 0})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Define field names, data types, defaults, and optional Redis 7.4+ field-level TTLs (HEXPIRE).
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  const currentFields = data.hashConfig?.fields || [];
                  const newField: RedisHashField = {
                    name: `field_${currentFields.length + 1}`,
                    type: "string",
                    required: false,
                  };
                  updateData({
                    hashConfig: { fields: [...currentFields, newField] },
                  });
                }}
              >
                <Plus size={12} /> Add Field
              </Button>
            </div>

            {(!data.hashConfig?.fields || data.hashConfig.fields.length === 0) ? (
              <div className="p-3 text-xs text-muted-foreground italic text-center border border-dashed border-border/60 rounded-lg">
                No hash fields defined. Click &quot;Add Field&quot; above to specify fields.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.hashConfig.fields.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-border/50 bg-background/80 flex flex-col gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={f.name}
                        placeholder="field name"
                        onChange={(e) => {
                          const updated = [...(data.hashConfig?.fields || [])];
                          updated[idx] = { ...updated[idx]!, name: e.target.value };
                          updateData({ hashConfig: { fields: updated } });
                        }}
                        className="h-7 text-xs font-mono flex-1"
                      />
                      <Select
                        value={f.type}
                        onValueChange={(val) => {
                          if (isRedisHashFieldType(val)) {
                            const updated = [...(data.hashConfig?.fields || [])];
                            updated[idx] = { ...updated[idx]!, type: val };
                            updateData({ hashConfig: { fields: updated } });
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="number">number</SelectItem>
                          <SelectItem value="boolean">boolean</SelectItem>
                          <SelectItem value="json">json</SelectItem>
                          <SelectItem value="datetime">datetime</SelectItem>
                          <SelectItem value="binary">binary</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => {
                          const updated = data.hashConfig?.fields?.filter((_, i) => i !== idx) || [];
                          updateData({ hashConfig: { fields: updated } });
                        }}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>

                    {/* Field TTL & Description row */}
                    <div className="flex items-center gap-2 text-[11px]">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <Input
                          placeholder="Optional field description..."
                          value={f.description || ""}
                          onChange={(e) => {
                            const updated = [...(data.hashConfig?.fields || [])];
                            updated[idx] = { ...updated[idx]!, description: e.target.value };
                            updateData({ hashConfig: { fields: updated } });
                          }}
                          className="h-6 text-[11px] bg-background/60"
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock size={11} className="text-red-500" />
                        <span className="text-[10px] text-muted-foreground">Field TTL:</span>
                        <Input
                          type="number"
                          placeholder="inherit"
                          value={f.ttl?.value ?? ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            const updated = [...(data.hashConfig?.fields || [])];
                            updated[idx] = {
                              ...updated[idx]!,
                              ttl: isNaN(val) ? undefined : { value: val, unit: "s" },
                            };
                            updateData({ hashConfig: { fields: updated } });
                          }}
                          className="h-6 w-16 text-[11px] font-mono text-right"
                        />
                        <span className="text-[10px] text-muted-foreground">s</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* B. GEOSPATIAL CONFIG */}
        {structure === "geo" && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
              <MapPin size={12} className="text-red-500" /> Geospatial Coordinate Fields (GEOADD / GEOSEARCH)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Longitude Field</Label>
                <Input
                  value={data.geoConfig?.longitudeField || "longitude"}
                  onChange={(e) =>
                    updateData({
                      geoConfig: {
                        longitudeField: e.target.value,
                        latitudeField: data.geoConfig?.latitudeField || "latitude",
                        memberType: data.geoConfig?.memberType || "string",
                        distanceUnit: data.geoConfig?.distanceUnit || "km",
                      },
                    })
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Latitude Field</Label>
                <Input
                  value={data.geoConfig?.latitudeField || "latitude"}
                  onChange={(e) =>
                    updateData({
                      geoConfig: {
                        longitudeField: data.geoConfig?.longitudeField || "longitude",
                        latitudeField: e.target.value,
                        memberType: data.geoConfig?.memberType || "string",
                        distanceUnit: data.geoConfig?.distanceUnit || "km",
                      },
                    })
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Member Identifier Type</Label>
                <Select
                  value={data.geoConfig?.memberType || "string"}
                  onValueChange={(val) => {
                    if (isGeoMemberType(val)) {
                      updateData({
                        geoConfig: {
                          longitudeField: data.geoConfig?.longitudeField || "longitude",
                          latitudeField: data.geoConfig?.latitudeField || "latitude",
                          memberType: val,
                          distanceUnit: data.geoConfig?.distanceUnit || "km",
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">string (e.g. driver_101)</SelectItem>
                    <SelectItem value="uuid">uuid</SelectItem>
                    <SelectItem value="number">number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Default Query Distance Unit</Label>
                <Select
                  value={data.geoConfig?.distanceUnit || "km"}
                  onValueChange={(val) => {
                    if (isGeoDistanceUnit(val)) {
                      updateData({
                        geoConfig: {
                          longitudeField: data.geoConfig?.longitudeField || "longitude",
                          latitudeField: data.geoConfig?.latitudeField || "latitude",
                          memberType: data.geoConfig?.memberType || "string",
                          distanceUnit: val,
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="km">Kilometers (km)</SelectItem>
                    <SelectItem value="m">Meters (m)</SelectItem>
                    <SelectItem value="mi">Miles (mi)</SelectItem>
                    <SelectItem value="ft">Feet (ft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* C. STREAM CONFIG (with Consumer Groups) */}
        {structure === "stream" && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
              <Radio size={12} className="text-red-500" /> Stream Limits & Consumer Groups (XADD / XREADGROUP)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Max Stream Length (MAXLEN)</Label>
                <Input
                  type="number"
                  value={data.streamConfig?.maxLen ?? 10000}
                  onChange={(e) =>
                    updateData({
                      streamConfig: {
                        ...(data.streamConfig || { fields: [] }),
                        maxLen: parseInt(e.target.value) || 10000,
                      },
                    })
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/30">
                <div className="flex flex-col">
                  <Label className="text-xs font-semibold">Approximate Trim (~)</Label>
                  <span className="text-[10px] text-muted-foreground">Faster high-throughput trimming</span>
                </div>
                <Switch
                  checked={data.streamConfig?.approximateTrim ?? true}
                  onCheckedChange={(checked) =>
                    updateData({
                      streamConfig: {
                        ...(data.streamConfig || { fields: [] }),
                        approximateTrim: checked,
                      },
                    })
                  }
                  className="scale-90"
                />
              </div>
            </div>

            {/* Consumer Groups List */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Consumer Groups ({(data.streamConfig?.consumerGroups || []).length})
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] gap-1"
                  onClick={() => {
                    const currentGroups = data.streamConfig?.consumerGroups || [];
                    const newGroup: RedisStreamConsumerGroup = {
                      name: `group-${currentGroups.length + 1}`,
                      description: "Worker group for message processing",
                      startId: "$",
                    };
                    updateData({
                      streamConfig: {
                        ...(data.streamConfig || { fields: [] }),
                        consumerGroups: [...currentGroups, newGroup],
                      },
                    });
                  }}
                >
                  <Plus size={12} /> Add Group
                </Button>
              </div>

              {(data.streamConfig?.consumerGroups || []).map((cg, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded bg-background/80 border border-border/40">
                  <Input
                    value={cg.name}
                    placeholder="group-name"
                    onChange={(e) => {
                      const updated = [...(data.streamConfig?.consumerGroups || [])];
                      updated[idx] = { ...updated[idx]!, name: e.target.value };
                      updateData({
                        streamConfig: { ...(data.streamConfig || { fields: [] }), consumerGroups: updated },
                      });
                    }}
                    className="h-7 text-xs font-mono flex-1"
                  />
                  <Input
                    value={cg.description || ""}
                    placeholder="description..."
                    onChange={(e) => {
                      const updated = [...(data.streamConfig?.consumerGroups || [])];
                      updated[idx] = { ...updated[idx]!, description: e.target.value };
                      updateData({
                        streamConfig: { ...(data.streamConfig || { fields: [] }), consumerGroups: updated },
                      });
                    }}
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => {
                      const updated = (data.streamConfig?.consumerGroups || []).filter((_, i) => i !== idx);
                      updateData({
                        streamConfig: { ...(data.streamConfig || { fields: [] }), consumerGroups: updated },
                      });
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* D. BITFIELD CONFIG */}
        {structure === "bitfield" && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                <Binary size={12} className="text-red-500" /> Bitfield Subfields (BITFIELD GET/SET/INCRBY)
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  const currentFields = data.bitfieldConfig?.fields || [];
                  const newField: RedisBitfieldSubfield = {
                    name: `counter_${currentFields.length + 1}`,
                    type: "u",
                    bits: 8,
                    offset: currentFields.reduce((sum, f) => sum + f.bits, 0),
                    overflow: "WRAP",
                  };
                  updateData({
                    bitfieldConfig: { fields: [...currentFields, newField] },
                  });
                }}
              >
                <Plus size={12} /> Add Subfield
              </Button>
            </div>

            {(!data.bitfieldConfig?.fields || data.bitfieldConfig.fields.length === 0) ? (
              <div className="p-3 text-xs text-muted-foreground italic text-center border border-dashed border-border/60 rounded-lg">
                No packed bitfield subfields defined.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.bitfieldConfig.fields.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded bg-background/80 border border-border/40">
                    <Input
                      value={f.name}
                      placeholder="name"
                      onChange={(e) => {
                        const updated = [...(data.bitfieldConfig?.fields || [])];
                        updated[idx] = { ...updated[idx]!, name: e.target.value };
                        updateData({ bitfieldConfig: { fields: updated } });
                      }}
                      className="h-7 text-xs font-mono flex-1"
                    />
                    <Select
                      value={`${f.type}${f.bits}`}
                      onValueChange={(val) => {
                        const type = val.startsWith("u") ? "u" : "i";
                        const bits = parseInt(val.slice(1)) || 8;
                        const updated = [...(data.bitfieldConfig?.fields || [])];
                        updated[idx] = { ...updated[idx]!, type, bits };
                        updateData({ bitfieldConfig: { fields: updated } });
                      }}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="u4">u4 (4-bit)</SelectItem>
                        <SelectItem value="u8">u8 (byte)</SelectItem>
                        <SelectItem value="u16">u16</SelectItem>
                        <SelectItem value="u32">u32</SelectItem>
                        <SelectItem value="i8">i8 (signed)</SelectItem>
                        <SelectItem value="i16">i16</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={f.overflow || "WRAP"}
                      onValueChange={(val) => {
                        if (isBitfieldOverflow(val)) {
                          const updated = [...(data.bitfieldConfig?.fields || [])];
                          updated[idx] = { ...updated[idx]!, overflow: val };
                          updateData({ bitfieldConfig: { fields: updated } });
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WRAP">WRAP</SelectItem>
                        <SelectItem value="SAT">SAT (Saturate)</SelectItem>
                        <SelectItem value="FAIL">FAIL</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => {
                        const updated = data.bitfieldConfig?.fields?.filter((_, i) => i !== idx) || [];
                        updateData({ bitfieldConfig: { fields: updated } });
                      }}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* E. SORTED SET (ZSet) CONFIG */}
        {structure === "zset" && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
              <ListOrdered size={12} className="text-red-500" /> Sorted Set Scoring (ZADD / ZRANGE)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Member Type</Label>
                <Input
                  value={data.zsetConfig?.memberType || "string"}
                  onChange={(e) =>
                    updateData({
                      zsetConfig: {
                        memberType: e.target.value,
                        scoreType: data.zsetConfig?.scoreType || "timestamp",
                        sortOrder: data.zsetConfig?.sortOrder || "asc",
                      },
                    })
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Score Type</Label>
                <Select
                  value={data.zsetConfig?.scoreType || "timestamp"}
                  onValueChange={(val) => {
                    if (isZSetScoreType(val)) {
                      updateData({
                        zsetConfig: {
                          memberType: data.zsetConfig?.memberType || "string",
                          scoreType: val,
                          sortOrder: data.zsetConfig?.sortOrder || "asc",
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timestamp">timestamp (ms)</SelectItem>
                    <SelectItem value="number">integer count</SelectItem>
                    <SelectItem value="float">floating point</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Sort Order</Label>
                <Select
                  value={data.zsetConfig?.sortOrder || "asc"}
                  onValueChange={(val) => {
                    if (isSortOrder(val)) {
                      updateData({
                        zsetConfig: {
                          memberType: data.zsetConfig?.memberType || "string",
                          scoreType: data.zsetConfig?.scoreType || "timestamp",
                          sortOrder: val,
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending (0 → N)</SelectItem>
                    <SelectItem value="desc">Descending (High → Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* F. LIST CONFIG */}
        {structure === "list" && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
              <List size={12} className="text-red-500" /> List Element & Trim Settings (LPUSH / LTRIM)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Element Type</Label>
                <Input
                  value={data.listConfig?.elementType || "string"}
                  onChange={(e) =>
                    updateData({
                      listConfig: {
                        elementType: e.target.value,
                        maxLength: data.listConfig?.maxLength,
                        trimStrategy: data.listConfig?.trimStrategy || "LTRIM",
                        orientation: data.listConfig?.orientation || "FIFO",
                      },
                    })
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Max Length (LTRIM)</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={data.listConfig?.maxLength ?? ""}
                  onChange={(e) =>
                    updateData({
                      listConfig: {
                        elementType: data.listConfig?.elementType || "string",
                        maxLength: parseInt(e.target.value) || undefined,
                        trimStrategy: "LTRIM",
                        orientation: data.listConfig?.orientation || "FIFO",
                      },
                    })
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Orientation</Label>
                <Select
                  value={data.listConfig?.orientation || "FIFO"}
                  onValueChange={(val) => {
                    if (isListOrientation(val)) {
                      updateData({
                        listConfig: {
                          elementType: data.listConfig?.elementType || "string",
                          maxLength: data.listConfig?.maxLength,
                          trimStrategy: data.listConfig?.trimStrategy || "LTRIM",
                          orientation: val,
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIFO">FIFO (Queue: Push Right, Pop Left)</SelectItem>
                    <SelectItem value="LIFO">LIFO (Stack: Push Left, Pop Left)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Caching Architecture & Lifecycle */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={14} className="text-red-500" /> Caching Policies & Lifecycle
          </span>
        </div>

        {/* TTL Duration Picker with Presets */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Schema TTL (Time to Live)</Label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {ttl.unit === "never" ? "No expiration" : `EXPIRE ${ttl.value}${ttl.unit}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              disabled={ttl.unit === "never"}
              value={ttl.unit === "never" ? "" : ttl.value}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                updateData({
                  ttl: { value: isNaN(val) ? 0 : val, unit: ttl.unit === "never" ? "s" : ttl.unit },
                });
              }}
              className="h-8 text-xs font-mono w-28 text-right bg-background"
            />
            <Select
              value={ttl.unit}
              onValueChange={(unit) => {
                if (isRedisDurationUnit(unit)) {
                  updateData({
                    ttl: { value: ttl.value || 3600, unit },
                  });
                }
              }}
            >
              <SelectTrigger className="h-8 w-28 text-xs font-mono bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s">Seconds (s)</SelectItem>
                <SelectItem value="m">Minutes (m)</SelectItem>
                <SelectItem value="h">Hours (h)</SelectItem>
                <SelectItem value="d">Days (d)</SelectItem>
                <SelectItem value="never">Never (Persistent)</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1 flex-wrap flex-1 justify-end">
              {TTL_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => updateData({ ttl: p.duration })}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-mono transition-all border",
                    ttl.value === p.duration.value && ttl.unit === p.duration.unit
                      ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50 font-bold"
                      : "bg-background/60 text-muted-foreground border-border/40 hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cache Strategy */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30">
          <div className="flex flex-col">
            <Label className="text-xs font-semibold">Cache Strategy</Label>
            <span className="text-[10px] text-muted-foreground">Access & invalidation pattern</span>
          </div>
          <Select
            value={strategy}
            onValueChange={(val) => {
              if (isCacheStrategy(val)) {
                updateData({ cacheStrategy: val });
              }
            }}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs font-semibold bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cache Aside" className="text-xs">Cache Aside (Lazy Load)</SelectItem>
              <SelectItem value="Read Through" className="text-xs">Read Through</SelectItem>
              <SelectItem value="Write Through" className="text-xs">Write Through</SelectItem>
              <SelectItem value="Write Behind" className="text-xs">Write Behind (Async)</SelectItem>
              <SelectItem value="Refresh Ahead" className="text-xs">Refresh Ahead</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Negative Caching Toggle & Shorter TTL */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <ShieldAlert size={14} className="text-amber-500" />
              <span>Negative Caching (Cache 404 / Missing Records)</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Stores a sentinel value for null lookups to prevent cache penetration & database stampedes.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {negativeCaching.enabled && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  value={negativeCaching.ttl?.value || 60}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateData({
                      negativeCaching: {
                        enabled: true,
                        ttl: { value: isNaN(val) ? 60 : val, unit: "s" },
                      },
                    });
                  }}
                  className="h-6 w-16 text-[11px] font-mono text-right bg-background"
                />
                <span className="text-[10px] text-muted-foreground font-mono">s</span>
              </div>
            )}
            <Switch
              checked={negativeCaching.enabled}
              onCheckedChange={(checked) =>
                updateData({
                  negativeCaching: {
                    enabled: checked,
                    ttl: negativeCaching.ttl || { value: 60, unit: "s" },
                  },
                })
              }
              className="scale-90"
            />
          </div>
        </div>

        {/* Stale-While-Revalidate (SWR) Toggle & Refresh Interval */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <RotateCw size={14} className="text-emerald-500" />
              <span>Stale-While-Revalidate (SWR Background Refresh)</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Serves stale cached data immediately while revalidating in the background.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {staleWhileRevalidate.enabled && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  value={staleWhileRevalidate.refreshInterval?.value || 300}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateData({
                      staleWhileRevalidate: {
                        enabled: true,
                        refreshInterval: { value: isNaN(val) ? 300 : val, unit: "s" },
                      },
                    });
                  }}
                  className="h-6 w-16 text-[11px] font-mono text-right bg-background"
                />
                <span className="text-[10px] text-muted-foreground font-mono">s</span>
              </div>
            )}
            <Switch
              checked={staleWhileRevalidate.enabled}
              onCheckedChange={(checked) =>
                updateData({
                  staleWhileRevalidate: {
                    enabled: checked,
                    refreshInterval: staleWhileRevalidate.refreshInterval || { value: 300, unit: "s" },
                  },
                })
              }
              className="scale-90"
            />
          </div>
        </div>

        {/* Source of Truth Table Linkage */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/30">
          <Label className="text-xs font-semibold">Source of Truth (Underlying Database Entity)</Label>
          <Combobox
            value={data.sourceOfTruth?.tableName || ""}
            onValueChange={(val) => {
              const matchedNode = tableNodes.find((t) => t.data?.label === val);
              updateData({
                sourceOfTruth: {
                  tableNodeId: matchedNode?.id,
                  tableName: val || undefined,
                },
              });
            }}
          >
            <ComboboxInput
              placeholder="e.g. users or products"
              className="text-xs w-full bg-background"
            />
            <ComboboxContent>
              <ComboboxList>
                <ComboboxEmpty>No relational tables found on canvas.</ComboboxEmpty>
                {tableNodes.map((t) => (
                  <ComboboxItem key={t.id} value={t.data?.label || "Table"}>
                    {t.data?.label || "Table"} ({t.data?.dbEngine || "sqlite"})
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        {/* Invalidation Rules */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Invalidation Trigger Rules</Label>
          <Input
            value={data.invalidationRules || ""}
            onChange={(e) => updateData({ invalidationRules: e.target.value })}
            placeholder="e.g. On User.update or Session.logout"
            className="h-8 text-xs bg-background"
          />
        </div>

        {/* Conditional Serialization & Compression (only for string, hash, list, set, zset) */}
        {(structure === "string" ||
          structure === "hash" ||
          structure === "list" ||
          structure === "set" ||
          structure === "zset") && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Serialization Format</Label>
              <Select
                value={data.serialization || "JSON"}
                onValueChange={(val) => {
                  if (isSerializationFormat(val)) {
                    updateData({ serialization: val });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs font-mono bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JSON">JSON</SelectItem>
                  <SelectItem value="MessagePack">MessagePack</SelectItem>
                  <SelectItem value="ProtoBuf">ProtoBuf</SelectItem>
                  <SelectItem value="String">String (Raw)</SelectItem>
                  <SelectItem value="Binary">Binary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Compression</Label>
              <Select
                value={data.compression || "None"}
                onValueChange={(val) => {
                  if (isCompressionFormat(val)) {
                    updateData({ compression: val });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs font-mono bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="gzip">gzip</SelectItem>
                  <SelectItem value="brotli">brotli</SelectItem>
                  <SelectItem value="lz4">lz4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* 5. Instance-Level Notice Card (Linking to Redis DB Node) */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/30">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Server size={18} className="text-amber-500 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground">
              Server Instance Settings (Eviction & Persistence)
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {parentDb
                ? `Attached to [${parentDb.data?.label || "Redis DB"}] (${parentDb.data?.maxmemoryPolicy || "volatile-lru"})`
                : "Not attached to a Database node yet."}
            </span>
          </div>
        </div>
        {parentDb && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 shrink-0 ml-2"
            onClick={() =>
              setActiveConfigItem({
                type: "database",
                id: parentDb.id,
                nodeId: parentDb.id,
              })
            }
          >
            Configure Instance <ExternalLink size={12} />
          </Button>
        )}
      </div>
    </div>
  );
};
