import React, { useMemo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { DatabaseZap, Key, Clock, Server, Layers } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  NodeHeader,
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";

export const RedisCacheNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const edges = useBackendCanvasStore((s) => s.edges);
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const storeEndpoints = useBackendCanvasStore((s) => s.endpoints);

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  const redisInstances = useBackendCanvasStore(
    useShallow((s) =>
      s.nodes.filter(
        (n) =>
          n?.type === "redis_instance" ||
          (n?.type === "database" &&
            (n.data?.dbEngine === "redis" || n.data?.dbType === "redis")),
      ),
    ),
  );

  const allRedisSchemas = useBackendCanvasStore(
    useShallow((s) =>
      s.nodes.filter(
        (n) =>
          n?.type === "redis_schema" ||
          (n?.type === "entity" && n.data?.dbType === "redis"),
      ),
    ),
  );

  const selectedSchema = allRedisSchemas.find((s) => s.id === data.schemaRef);
  const selectedInstanceId = data.databaseId || selectedSchema?.data?.databaseId;
  const selectedInstance = redisInstances.find((n) => n.id === selectedInstanceId);
  const parentInstance = nodes.find(
    (n) => n.id === (selectedSchema?.data?.databaseId || selectedInstanceId),
  );

  const filteredSchemas = useMemo(() => {
    if (!selectedInstanceId || selectedInstanceId === "__all__") return allRedisSchemas;
    const directMatches = allRedisSchemas.filter(
      (s) =>
        s.data?.databaseId === selectedInstanceId ||
        edges.some(
          (e) =>
            (e.source === selectedInstanceId && e.target === s.id) ||
            (e.target === selectedInstanceId && e.source === s.id),
        ),
    );
    return directMatches.length > 0 ? directMatches : allRedisSchemas;
  }, [allRedisSchemas, selectedInstanceId, edges]);

  // Derive which service endpoints connect to this Redis cache node
  const incomingEdges = edges.filter((e) => e.target === id);
  const accessors = incomingEdges
    .map((edge) => {
      const srcNode = nodes.find((n) => n.id === edge.source);
      if (!srcNode) return null;

      const serviceName = srcNode.data?.label || "Untitled Service";
      let routeName = "";
      let method = "";

      const sourceHandle = edge.sourceHandle || "";

      let epId = "";
      if (sourceHandle.startsWith("endpoint-out-")) {
        epId = sourceHandle.replace("endpoint-out-", "");
      } else if (sourceHandle.startsWith("publishedEvents-out-")) {
        epId = sourceHandle.replace("publishedEvents-out-", "");
      } else if (sourceHandle.startsWith("consumedEvents-in-")) {
        epId = sourceHandle.replace("consumedEvents-in-", "");
      } else {
        epId = sourceHandle;
      }

      let ep: { name?: string; type?: string; path?: string } | undefined;

      if (epId) {
        ep = storeEndpoints.find((e) => e.id === epId);
        if (!ep && srcNode.data?.endpoints) {
          ep = srcNode.data.endpoints.find((e) => e.id === epId);
        }
        if (!ep && srcNode.data?.routeGroups) {
          for (const group of srcNode.data.routeGroups) {
            ep = group.endpoints?.find((e) => e.id === epId);
            if (ep) break;
          }
        }
      }

      // Fallback: search storeEndpoints for endpoints attached to srcNode
      if (!ep) {
        const srcEndpoints = storeEndpoints.filter(
          (e) => e.nodeId === srcNode.id,
        );
        if (srcEndpoints.length > 0) {
          ep = srcEndpoints[0];
        } else if (
          srcNode.data?.endpoints &&
          srcNode.data.endpoints.length > 0
        ) {
          ep = srcNode.data.endpoints[0];
        }
      }

      if (ep) {
        method = ep.type || "GET";
        routeName =
          ep.name && ep.name.trim()
            ? ep.name.trim()
            : ep.path || `${method} Route`;
      } else {
        routeName = "Route";
      }

      return {
        id: edge.id,
        serviceName,
        routeName,
        method,
      };
    })
    .filter(
      (
        x,
      ): x is {
        id: string;
        serviceName: string;
        routeName: string;
        method: string;
      } => x !== null,
    );

  const keyTemplate =
    selectedSchema?.data?.keyTemplate ||
    (selectedSchema?.data?.label
      ? `${selectedSchema.data.label.toLowerCase()}:{id}`
      : undefined);

  const redisStructure =
    selectedSchema?.data?.redisDataStructure ||
    (selectedSchema ? "hash" : undefined);

  const ttlValue =
    typeof selectedSchema?.data?.ttl === "object"
      ? `${selectedSchema.data.ttl.value}${selectedSchema.data.ttl.unit}`
      : selectedSchema?.data?.ttl
        ? `${selectedSchema.data.ttl}s`
        : undefined;

  const fieldsCount =
    selectedSchema?.data?.columns?.length ||
    selectedSchema?.data?.hashConfig?.fields?.length ||
    0;

  return (
    <div
      className={cn(
        "shadow-md rounded-xl bg-card border-2 min-w-[220px] max-w-[320px] flex flex-col transition-all duration-300",
        borderClass,
      )}
    >
      <NodeHeader
        id={id}
        data={data}
        nodeType="redis-cache"
        icon={DatabaseZap}
        title="Redis Cache Ref"
        colorClass="bg-red-500/10 text-red-700 dark:text-red-400"
        selected={selected}
      />

      {/* Description */}
      <div className="px-3 py-2 bg-secondary/5 border-b nodrag">
        <Textarea
          className="min-h-[20px] text-xs bg-transparent border-none shadow-none p-1 resize-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
          placeholder="Describe caching strategy (e.g. Cache user profile for 1h)"
          value={data.description || ""}
          onChange={(e) =>
            updateNode(id, { data: { ...data, description: e.target.value } })
          }
        />
      </div>

      {/* Selectors: Redis Instance followed by Target Redis Schema */}
      <div className="p-2.5 flex flex-col gap-2.5 nodrag">
        {/* 1. Redis Instance Selector */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Server size={10} className="text-red-500" />
              Redis Instance
            </span>
            {selectedInstance && (
              <span className="text-[9px] font-mono text-muted-foreground/80 px-1 py-0.2 rounded bg-muted/50 border border-border/40">
                {selectedInstance.data?.dbEngine || "redis"}
              </span>
            )}
          </div>

          <Select
            value={selectedInstanceId || "__all__"}
            onValueChange={(val) => {
              const newInstanceId = val === "__all__" ? "" : val;
              const currentSchema = allRedisSchemas.find((s) => s.id === data.schemaRef);
              const belongsToNew =
                !newInstanceId ||
                (currentSchema &&
                  (currentSchema.data?.databaseId === newInstanceId ||
                    edges.some(
                      (e) =>
                        (e.source === newInstanceId && e.target === currentSchema.id) ||
                        (e.target === newInstanceId && e.source === currentSchema.id),
                    )));

              updateNode(id, {
                data: {
                  ...data,
                  databaseId: newInstanceId || undefined,
                  schemaRef: belongsToNew ? data.schemaRef : undefined,
                  label: belongsToNew ? data.label : "Redis Cache Ref",
                },
              });
            }}
          >
            <SelectTrigger className="h-7 text-xs bg-background/80">
              <SelectValue placeholder="Select Redis Instance..." />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__all__" className="text-xs">
                All Instances
              </SelectItem>
              {redisInstances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id} className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="truncate">{inst.data?.label || "Redis Instance"}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Target Redis Schema Selector */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <DatabaseZap size={10} className="text-red-500" />
              Redis Schema
            </span>
            {redisStructure && (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 uppercase font-mono bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 font-bold"
              >
                {redisStructure}
              </Badge>
            )}
          </div>

          <Select
            value={data.schemaRef || ""}
            onValueChange={(val) => {
              const schema = allRedisSchemas.find((s) => s.id === val);
              updateNode(id, {
                data: {
                  ...data,
                  schemaRef: val,
                  databaseId: schema?.data?.databaseId || selectedInstanceId || data.databaseId,
                  label: schema?.data?.label || "Redis Cache Ref",
                  graphPosition: schema?.position,
                },
              });
            }}
          >
            <SelectTrigger className="h-7 text-xs bg-background/80">
              <SelectValue placeholder="Select a Redis Schema..." />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              {filteredSchemas.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground italic">
                  {selectedInstanceId && selectedInstanceId !== "__all__"
                    ? "No schemas for this Redis instance"
                    : "No Redis schemas defined in Schema View"}
                </div>
              ) : (
                filteredSchemas.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.data?.label || "Untitled Cache"}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Schema Metadata Preview */}
        {selectedSchema && (
          <div className="p-2 rounded-lg bg-red-500/5 dark:bg-red-950/20 border border-red-500/20 flex flex-col gap-1.5 text-[11px]">
            {keyTemplate && (
              <div className="flex items-center gap-1.5 text-foreground/90 font-mono text-[10px] truncate" title={keyTemplate}>
                <Key size={11} className="text-red-500 shrink-0" />
                <span className="truncate font-semibold bg-background/80 px-1 py-0.5 rounded border border-border/50">
                  {keyTemplate}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
              {ttlValue && (
                <div className="flex items-center gap-1" title="Cache TTL">
                  <Clock size={10} className="text-amber-500 shrink-0" />
                  <span>TTL: <strong className="text-foreground">{ttlValue}</strong></span>
                </div>
              )}
              {fieldsCount > 0 && (
                <div className="flex items-center gap-1">
                  <Layers size={10} className="text-red-400 shrink-0" />
                  <span>{fieldsCount} field{fieldsCount > 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            {parentInstance && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground border-t border-red-500/15 pt-1">
                <Server size={10} className="text-red-500 shrink-0" />
                <span className="truncate">Instance: <strong className="text-foreground">{parentInstance.data?.label || "Redis"}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accessed By */}
      <div className="flex flex-col border-t bg-secondary/20 nodrag">
        <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Accessed By
        </div>
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          {accessors.length === 0 ? (
            <span className="text-[10px] text-muted-foreground italic px-1">
              No connections
            </span>
          ) : (
            accessors.map((acc) => (
              <div
                key={acc.id}
                className="flex flex-col px-2 py-1 border-l-2 border-red-500/60 bg-background/50 rounded-r gap-0.5"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {acc.method && (
                    <span className="px-1 py-0.5 rounded text-[8px] font-bold shrink-0 bg-red-500/15 text-red-700 dark:text-red-400 uppercase leading-none">
                      {acc.method}
                    </span>
                  )}
                  <span className="font-semibold text-xs text-foreground truncate">
                    {acc.routeName}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground truncate leading-tight">
                  {acc.serviceName}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="database-target"
        className="w-2 h-2"
        style={{ top: "20px" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="database-source"
        className="w-2 h-2"
        style={{ top: "20px" }}
      />
    </div>
  );
};
