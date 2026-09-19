import { Position } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "./types";
import { getNodeDimensions, getIsPkNode } from "./nodeDimensions";
import { layoutSchemaRanks } from "./schemaRankLayout";

export interface PerformSchemaLayoutOptions {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  onNodesChange?: (changes: PositionNodeChange[]) => void;
  fitView: (options?: { duration?: number; padding?: number; maxZoom?: number }) => void;
  direction?: string;
}

interface StorageCluster {
  id: string;
  type: "database" | "redis" | "unassigned";
  storageNode?: LayoutNode;
  entities: LayoutNode[];
}

interface ClusterLayoutResult {
  cluster: StorageCluster;
  width: number;
  height: number;
  storagePosition?: { x: number; y: number };
  entityPositions: Map<string, { x: number; y: number }>;
}

/**
 * Computes an isolated LR Dagre + staggered ranks layout for a single storage cluster.
 * The storage node (Database or Redis Instance) is placed horizontally centered at the top.
 */
function layoutIsolatedCluster(
  cluster: StorageCluster,
  schemaEdges: LayoutEdge[],
): ClusterLayoutResult {
  const entityPositions = new Map<string, { x: number; y: number }>();

  // 1. Cluster has no entities (e.g. empty Database or empty Redis instance)
  if (cluster.entities.length === 0) {
    if (cluster.storageNode) {
      const storageDim = getNodeDimensions(cluster.storageNode);
      return {
        cluster,
        width: storageDim.width,
        height: storageDim.height,
        storagePosition: { x: 0, y: 0 },
        entityPositions,
      };
    }
    return {
      cluster,
      width: 0,
      height: 0,
      entityPositions,
    };
  }

  // 2. Intra-cluster edges only (prevent edges from other databases from skewing ranks)
  const entityIdSet = new Set(cluster.entities.map((n) => n.id));
  const intraEdges = schemaEdges.filter(
    (e) => entityIdSet.has(e.source) && entityIdSet.has(e.target),
  );

  // 3. Construct localized Dagre Graph for this cluster
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "LR",
    marginx: 40,
    marginy: 40,
    ranksep: 280,
    nodesep: 45,
  });

  cluster.entities.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    dagreGraph.setNode(node.id, { width, height });
  });

  intraEdges.forEach((edge) => {
    if (edge.type === "foreign-key") {
      const sourceNode = cluster.entities.find((n) => n.id === edge.source);
      const targetNode = cluster.entities.find((n) => n.id === edge.target);

      const sourceIsPk = getIsPkNode(sourceNode, edge.sourceHandle);
      const targetIsPk = getIsPkNode(targetNode, edge.targetHandle);

      if (sourceIsPk && !targetIsPk) {
        dagreGraph.setEdge(edge.source, edge.target);
      } else if (targetIsPk && !sourceIsPk) {
        dagreGraph.setEdge(edge.target, edge.source);
      } else {
        dagreGraph.setEdge(edge.source, edge.target);
      }
    } else {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const rawLocalPositions = new Map<string, { x: number; y: number }>();
  cluster.entities.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const { width, height } = getNodeDimensions(node);
    if (nodeWithPosition) {
      rawLocalPositions.set(node.id, {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      });
    } else {
      rawLocalPositions.set(node.id, { x: 0, y: 0 });
    }
  });

  // Stagger schema ranks into sub-columns for balanced grid layout
  layoutSchemaRanks({
    dagreGraph,
    entityFlowNodes: cluster.entities,
    entityFlowEdges: intraEdges,
    positionsMap: rawLocalPositions,
  });

  // 4. Calculate bounding box of entities within the cluster
  let minEntX = Infinity;
  let maxEntX = -Infinity;
  let minEntY = Infinity;
  let maxEntY = -Infinity;

  cluster.entities.forEach((node) => {
    const pos = rawLocalPositions.get(node.id) ?? { x: 0, y: 0 };
    const { width, height } = getNodeDimensions(node);
    if (pos.x < minEntX) minEntX = pos.x;
    if (pos.x + width > maxEntX) maxEntX = pos.x + width;
    if (pos.y < minEntY) minEntY = pos.y;
    if (pos.y + height > maxEntY) maxEntY = pos.y + height;
  });

  if (minEntX === Infinity) {
    minEntX = 0;
    maxEntX = 300;
    minEntY = 0;
    maxEntY = 200;
  }

  const entitiesWidth = maxEntX - minEntX;
  const entitiesHeight = maxEntY - minEntY;

  const storageDim = cluster.storageNode
    ? getNodeDimensions(cluster.storageNode)
    : { width: 0, height: 0 };

  // Total cluster width accommodates both the header and entities
  const clusterWidth = Math.max(storageDim.width, entitiesWidth);
  const entitiesOffsetX = (clusterWidth - entitiesWidth) / 2;
  const STORAGE_TO_ENTITIES_GAP_Y = 120;
  const entitiesOffsetY = cluster.storageNode
    ? storageDim.height + STORAGE_TO_ENTITIES_GAP_Y
    : 0;

  // Set normalized local coordinates
  cluster.entities.forEach((node) => {
    const pos = rawLocalPositions.get(node.id) ?? { x: minEntX, y: minEntY };
    entityPositions.set(node.id, {
      x: entitiesOffsetX + (pos.x - minEntX),
      y: entitiesOffsetY + (pos.y - minEntY),
    });
  });

  const storagePosition = cluster.storageNode
    ? {
        x: (clusterWidth - storageDim.width) / 2,
        y: 0,
      }
    : undefined;

  const clusterHeight = cluster.storageNode
    ? storageDim.height + STORAGE_TO_ENTITIES_GAP_Y + entitiesHeight
    : entitiesHeight;

  return {
    cluster,
    width: clusterWidth,
    height: clusterHeight,
    storagePosition,
    entityPositions,
  };
}

export function performSchemaLayout({
  nodes,
  edges,
  onNodesChange,
  fitView,
}: PerformSchemaLayoutOptions) {
  // Filter for Schema nodes (entity, redis_schema, database, redis_instance) and schema edges
  const schemaNodes = nodes.filter(
    (n) =>
      n.type === "entity" ||
      n.type === "database" ||
      n.type === "redis_instance" ||
      n.type === "redis_schema",
  );
  if (schemaNodes.length === 0) return;

  const schemaEdges = edges.filter(
    (e) =>
      e.type === "foreign-key" ||
      e.type === "database-connection" ||
      e.type === "connection",
  );

  const isDatabaseNode = (n: LayoutNode) => n.type === "database";
  const isRedisNode = (n: LayoutNode) => n.type === "redis_instance";
  const isStorageNode = (n: LayoutNode) => isDatabaseNode(n) || isRedisNode(n);

  const dbNodes = schemaNodes.filter(isDatabaseNode);
  const redisNodes = schemaNodes.filter(isRedisNode);
  const storageNodes = [...dbNodes, ...redisNodes];
  const storageNodeIdSet = new Set(storageNodes.map((n) => n.id));

  const entityNodes = schemaNodes.filter((n) => !isStorageNode(n));

  // 1. Initialize dedicated cluster for each Database and each Redis instance
  const clustersMap = new Map<string, StorageCluster>();

  dbNodes.forEach((db) => {
    clustersMap.set(db.id, {
      id: db.id,
      type: "database",
      storageNode: db,
      entities: [],
    });
  });

  redisNodes.forEach((redis) => {
    clustersMap.set(redis.id, {
      id: redis.id,
      type: "redis",
      storageNode: redis,
      entities: [],
    });
  });

  const unassignedCluster: StorageCluster = {
    id: "__unassigned__",
    type: "unassigned",
    entities: [],
  };

  // 2. Associate each entity / redis_schema to its exact cluster
  const entityToClusterId = new Map<string, string>();

  // Signal A: Explicit databaseId match
  entityNodes.forEach((entity) => {
    const dbId = (entity.data as { databaseId?: string })?.databaseId;
    if (dbId && clustersMap.has(dbId)) {
      entityToClusterId.set(entity.id, dbId);
    }
  });

  // Signal B: Direct connecting edge to a specific Database or Redis instance
  entityNodes.forEach((entity) => {
    if (entityToClusterId.has(entity.id)) return;
    const directEdge = schemaEdges.find(
      (e) =>
        (e.source === entity.id && storageNodeIdSet.has(e.target)) ||
        (e.target === entity.id && storageNodeIdSet.has(e.source)),
    );
    if (directEdge) {
      const targetStorageId = storageNodeIdSet.has(directEdge.source)
        ? directEdge.source
        : directEdge.target;
      if (clustersMap.has(targetStorageId)) {
        entityToClusterId.set(entity.id, targetStorageId);
      }
    }
  });

  // Signal C: Database node internal 'tables' definition matching
  dbNodes.forEach((db) => {
    const rawTables = (
      db.data as {
        tables?: Array<{ id?: string; name?: string; tableRef?: string }>;
      }
    )?.tables;
    if (Array.isArray(rawTables)) {
      rawTables.forEach((t) => {
        entityNodes.forEach((entity) => {
          if (entityToClusterId.has(entity.id)) return;
          const tableName = (
            entity.data as { tableName?: string; tableRef?: string }
          )?.tableName;
          const tableRef = (entity.data as { tableRef?: string })?.tableRef;
          if (
            (t.id && t.id === entity.id) ||
            (t.name && tableName && t.name.toLowerCase() === tableName.toLowerCase()) ||
            (t.tableRef && tableRef && t.tableRef === tableRef)
          ) {
            entityToClusterId.set(entity.id, db.id);
          }
        });
      });
    }
  });

  // Signal D: Foreign Key graph propagation
  // If Table A is already associated with Database K and Table B has a foreign key to Table A,
  // Table B is automatically assigned to Database K.
  let fkChanged = true;
  while (fkChanged) {
    fkChanged = false;
    entityNodes.forEach((entity) => {
      if (entityToClusterId.has(entity.id)) return;
      if (entity.type === "redis_schema") return;

      const fkEdge = schemaEdges.find((e) => {
        if (e.type !== "foreign-key") return false;
        if (e.source === entity.id && entityToClusterId.has(e.target)) return true;
        if (e.target === entity.id && entityToClusterId.has(e.source)) return true;
        return false;
      });

      if (fkEdge) {
        const otherEntityId =
          fkEdge.source === entity.id ? fkEdge.target : fkEdge.source;
        const parentClusterId = entityToClusterId.get(otherEntityId);
        if (parentClusterId) {
          entityToClusterId.set(entity.id, parentClusterId);
          fkChanged = true;
        }
      }
    });
  }

  // Signal E: Type and single-instance heuristics
  const defaultDbNode =
    dbNodes.find((d) => (d.data as { isDefault?: boolean })?.isDefault) ||
    dbNodes[0];
  const defaultRedisNode =
    redisNodes.find((r) => (r.data as { isDefault?: boolean })?.isDefault) ||
    redisNodes[0];

  entityNodes.forEach((entity) => {
    if (entityToClusterId.has(entity.id)) return;

    const isRedisEntity =
      entity.type === "redis_schema" ||
      (entity.data as { dbType?: string })?.dbType === "redis";

    if (isRedisEntity) {
      if (defaultRedisNode) {
        entityToClusterId.set(entity.id, defaultRedisNode.id);
      }
    } else {
      // Relational / Entity table
      if (defaultDbNode) {
        if (
          dbNodes.length === 1 ||
          Boolean((defaultDbNode.data as { isDefault?: boolean })?.isDefault)
        ) {
          entityToClusterId.set(entity.id, defaultDbNode.id);
        }
      }
    }
  });

  // Populate entities into clusters
  entityNodes.forEach((entity) => {
    const clusterId = entityToClusterId.get(entity.id);
    if (clusterId && clustersMap.has(clusterId)) {
      clustersMap.get(clusterId)!.entities.push(entity);
    } else {
      unassignedCluster.entities.push(entity);
    }
  });

  // 3. Sort clusters: Databases first (default DB first, then left-to-right), Redis instances, Unassigned
  const activeDbClusters: StorageCluster[] = dbNodes
    .slice()
    .sort((a, b) => {
      const isDefA = Boolean((a.data as { isDefault?: boolean })?.isDefault);
      const isDefB = Boolean((b.data as { isDefault?: boolean })?.isDefault);
      if (isDefA && !isDefB) return -1;
      if (!isDefA && isDefB) return 1;
      return a.position.x - b.position.x;
    })
    .map((db) => clustersMap.get(db.id)!)
    .filter(Boolean);

  const activeRedisClusters: StorageCluster[] = redisNodes
    .slice()
    .sort((a, b) => a.position.x - b.position.x)
    .map((redis) => clustersMap.get(redis.id)!)
    .filter(Boolean);

  // 4. Compute isolated layout for each individual cluster
  const dbResults = activeDbClusters.map((c) =>
    layoutIsolatedCluster(c, schemaEdges),
  );
  const redisResults = activeRedisClusters.map((c) =>
    layoutIsolatedCluster(c, schemaEdges),
  );
  const unassignedResult =
    unassignedCluster.entities.length > 0
      ? layoutIsolatedCluster(unassignedCluster, schemaEdges)
      : null;

  // 5. Arrange clusters on the canvas with multi-tier section spacing
  const positionsMap = new Map<string, { x: number; y: number }>();

  const START_X = 60;
  const START_Y = 60;
  const DB_GAP_X = 260; // Gap between individual database clusters
  const REDIS_GAP_X = 220; // Gap between individual Redis clusters
  const SECTION_GAP_X = 350; // Gap between Database section and Redis section

  // Determine if Redis should wrap to Row 2 if Database section is exceptionally wide (> 3500px)
  const totalDbWidth = dbResults.reduce(
    (sum, r, idx) => sum + r.width + (idx > 0 ? DB_GAP_X : 0),
    0,
  );
  const wrapRedisToNextRow =
    dbResults.length > 0 && redisResults.length > 0 && totalDbWidth > 3500;

  let curX = START_X;
  let curY = START_Y;
  let maxDbHeight = 0;

  // Place Database clusters
  dbResults.forEach((res, idx) => {
    if (idx > 0) curX += DB_GAP_X;

    const clusterOriginX = curX;
    const clusterOriginY = curY;

    if (res.storagePosition && res.cluster.storageNode) {
      positionsMap.set(res.cluster.storageNode.id, {
        x: clusterOriginX + res.storagePosition.x,
        y: clusterOriginY + res.storagePosition.y,
      });
    }

    res.cluster.entities.forEach((ent) => {
      const p = res.entityPositions.get(ent.id);
      if (p) {
        positionsMap.set(ent.id, {
          x: clusterOriginX + p.x,
          y: clusterOriginY + p.y,
        });
      }
    });

    if (res.height > maxDbHeight) maxDbHeight = res.height;
    curX += res.width;
  });

  // Place Redis clusters
  if (wrapRedisToNextRow) {
    curX = START_X;
    curY = START_Y + maxDbHeight + 260;
  } else if (dbResults.length > 0 && redisResults.length > 0) {
    curX += SECTION_GAP_X;
  }

  redisResults.forEach((res, idx) => {
    if (idx > 0) curX += REDIS_GAP_X;

    const clusterOriginX = curX;
    const clusterOriginY = curY;

    if (res.storagePosition && res.cluster.storageNode) {
      positionsMap.set(res.cluster.storageNode.id, {
        x: clusterOriginX + res.storagePosition.x,
        y: clusterOriginY + res.storagePosition.y,
      });
    }

    res.cluster.entities.forEach((ent) => {
      const p = res.entityPositions.get(ent.id);
      if (p) {
        positionsMap.set(ent.id, {
          x: clusterOriginX + p.x,
          y: clusterOriginY + p.y,
        });
      }
    });

    curX += res.width;
  });

  // Place Unassigned entities (if any) to the far right
  if (unassignedResult) {
    curX += SECTION_GAP_X;
    const clusterOriginX = curX;
    const clusterOriginY = curY;

    unassignedResult.cluster.entities.forEach((ent) => {
      const p = unassignedResult.entityPositions.get(ent.id);
      if (p) {
        positionsMap.set(ent.id, {
          x: clusterOriginX + p.x,
          y: clusterOriginY + p.y,
        });
      }
    });
  }

  // 6. Canvas origin margin check
  let globalMinX = Infinity;
  let globalMinY = Infinity;
  positionsMap.forEach((pos) => {
    if (pos.x < globalMinX) globalMinX = pos.x;
    if (pos.y < globalMinY) globalMinY = pos.y;
  });

  const shiftX = globalMinX < 60 ? 60 - globalMinX : 0;
  const shiftY = globalMinY < 60 ? 60 - globalMinY : 0;

  if (shiftX !== 0 || shiftY !== 0) {
    positionsMap.forEach((pos, id) => {
      positionsMap.set(id, {
        x: pos.x + shiftX,
        y: pos.y + shiftY,
      });
    });
  }

  // 7. Apply node position changes
  if (onNodesChange) {
    const nodeChanges: PositionNodeChange[] = schemaNodes.map(
      (node: LayoutNode) => {
        const pos = positionsMap.get(node.id) ?? {
          x: node.position.x,
          y: node.position.y,
        };
        const isDb = storageNodeIdSet.has(node.id);
        return {
          id: node.id,
          type: "position",
          position: pos,
          sourcePosition: isDb ? Position.Bottom : Position.Right,
          targetPosition: isDb ? Position.Top : Position.Left,
        };
      },
    );
    onNodesChange(nodeChanges);
  } else {
    useBackendCanvasStore.setState((state) => {
      const updatedNodes = state.nodes.map((node) => {
        const pos = positionsMap.get(node.id);
        if (!pos) return node;
        const isDb = storageNodeIdSet.has(node.id);
        return {
          ...node,
          position: pos,
          sourcePosition: isDb ? Position.Bottom : Position.Right,
          targetPosition: isDb ? Position.Top : Position.Left,
        };
      });

      const movedNodeIds = new Set(positionsMap.keys());
      const upserts = updatedNodes.filter((n) => movedNodeIds.has(n.id));

      return {
        nodes: updatedNodes,
        pendingNodeUpserts: [
          ...state.pendingNodeUpserts.filter((u) => !movedNodeIds.has(u.id)),
          ...upserts,
        ],
      };
    });
  }

  setTimeout(() => {
    fitView({ duration: 300, padding: 0.2, maxZoom: 0.85 });
  }, 50);
}
