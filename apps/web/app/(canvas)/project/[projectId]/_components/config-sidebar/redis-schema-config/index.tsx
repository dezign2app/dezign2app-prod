import React from "react";
import { DatabaseZap } from "lucide-react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  BackendNode,
  RedisDataStructure,
  RedisDuration,
  RedisHashField,
} from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { SCHEMA_PRESET_MAP } from "./constants";
import {
  QuickPresetsSection,
  KeyTemplateSection,
  DataStructureSelector,
  CachingArchitectureSection,
  RedisInstanceNoticeCard,
  HashStructureConfig,
  GeoStructureConfig,
  StreamStructureConfig,
  BitfieldStructureConfig,
  ZSetStructureConfig,
  ListStructureConfig,
  SetStructureConfig,
  BitmapStructureConfig,
  HyperLogLogStructureConfig,
  JsonStructureConfig,
} from "./components";

export interface RedisSchemaConfigProps {
  id: string;
  nodeId: string;
}

export * from "./constants";
export * from "./components";

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

  if (!node || (node.type !== "redis_schema" && node.type !== "entity")) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Redis Schema node not found.
      </div>
    );
  }

  const data = node.data || {};
  const label = data.label || "Redis_Schema";
  const structure: RedisDataStructure = data.redisDataStructure || "hash";
  const keyTemplate = data.keyTemplate ?? "";
  const clusterTagParam = data.clusterHashTagParam;
  const ttl: RedisDuration = data.ttl || { value: 3600, unit: "s" };
  const strategy = data.cacheStrategy || "Cache Aside";
  const negativeCaching = data.negativeCaching || { enabled: false, ttl: { value: 60, unit: "s" } };
  const staleWhileRevalidate = data.staleWhileRevalidate || {
    enabled: false,
    refreshInterval: { value: 300, unit: "s" },
  };

  // Parent Database Node (supports both standard database and redis_instance)
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

  // Preset AI Templates
  const handleApplyPreset = (presetName: string) => {
    const preset = SCHEMA_PRESET_MAP[presetName];
    if (preset) {
      updateData(preset);
    }
  };

  const hashFields: RedisHashField[] =
    data.hashConfig?.fields ||
    (data.columns && data.columns.length > 0
      ? data.columns.map((c) => ({
          name: c.name,
          type:
            c.type === "INTEGER" ||
            c.type === "REAL" ||
            c.type === "FLOAT" ||
            c.type === "NUMERIC"
              ? "number"
              : c.type === "BOOLEAN" || c.type === "BOOL"
                ? "boolean"
                : c.type === "JSON" || c.type === "OBJECT"
                  ? "json"
                  : "string",
          required: Boolean(c.isPrimaryKey || c.isNotNull),
        }))
      : []);

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
      <QuickPresetsSection onApplyPreset={handleApplyPreset} />

      {/* 2. Keyspace & Key Template Architecture */}
      <KeyTemplateSection
        keyTemplate={keyTemplate}
        clusterTagParam={clusterTagParam}
        updateData={updateData}
      />

      {/* 3. Redis Data Structure Selection & Specific Detailed Configs */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
        <DataStructureSelector
          structure={structure}
          updateData={updateData}
        />

        {/* ── Structure Specific Detailed Configs ── */}
        {structure === "hash" && (
          <HashStructureConfig
            hashFields={hashFields}
            updateData={updateData}
          />
        )}

        {structure === "geo" && (
          <GeoStructureConfig
            geoConfig={data.geoConfig}
            updateData={updateData}
          />
        )}

        {structure === "stream" && (
          <StreamStructureConfig
            streamConfig={data.streamConfig}
            updateData={updateData}
          />
        )}

        {structure === "bitfield" && (
          <BitfieldStructureConfig
            bitfieldConfig={data.bitfieldConfig}
            updateData={updateData}
          />
        )}

        {structure === "zset" && (
          <ZSetStructureConfig
            zsetConfig={data.zsetConfig}
            updateData={updateData}
          />
        )}

        {structure === "list" && (
          <ListStructureConfig
            listConfig={data.listConfig}
            updateData={updateData}
          />
        )}

        {structure === "set" && (
          <SetStructureConfig
            setConfig={data.setConfig}
            updateData={updateData}
          />
        )}

        {structure === "bitmap" && (
          <BitmapStructureConfig
            bitmapConfig={data.bitmapConfig}
            updateData={updateData}
          />
        )}

        {structure === "hyperloglog" && (
          <HyperLogLogStructureConfig
            hyperloglogConfig={data.hyperloglogConfig}
            updateData={updateData}
          />
        )}

        {structure === "json" && (
          <JsonStructureConfig
            hashFields={hashFields}
            updateData={updateData}
          />
        )}
      </div>

      {/* 4. Caching Architecture & Lifecycle */}
      <CachingArchitectureSection
        structure={structure}
        ttl={ttl}
        strategy={strategy}
        negativeCaching={negativeCaching}
        staleWhileRevalidate={staleWhileRevalidate}
        sourceOfTruth={data.sourceOfTruth}
        invalidationRules={data.invalidationRules}
        serialization={data.serialization}
        compression={data.compression}
        tableNodes={tableNodes}
        updateData={updateData}
      />

      {/* 5. Instance-Level Notice Card */}
      <RedisInstanceNoticeCard
        parentDb={parentDb}
        onConfigureInstance={(dbId) =>
          setActiveConfigItem({
            type: "database",
            id: dbId,
            nodeId: dbId,
          })
        }
      />
    </div>
  );
};
