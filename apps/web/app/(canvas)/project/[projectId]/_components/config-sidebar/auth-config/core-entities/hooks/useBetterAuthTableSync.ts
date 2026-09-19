import { toast } from "sonner";
import {
  BetterAuthTableMapping,
  BetterAuthTableDefinition,
  BETTER_AUTH_TABLE_DEFINITIONS,
  BETTER_AUTH_TABLE_KEYS,
  BACKEND_NODE_ENTITY,
  BACKEND_NODE_DATABASE,
  BACKEND_EDGE_FOREIGN_KEY,
  BACKEND_EDGE_DATABASE_CONNECTION,
  DEFAULT_DATABASE_NODE_LABEL,
  DEFAULT_DATABASE_ENGINE,
  DEFAULT_DATABASE_ENV_VARS,
  getUniqueNodeLabel,
  isBetterAuthTableRequired,
  CanvasEntityColumn,
} from "@workspace/canvas";
import { BackendNode, BackendNodeData } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSchemaAutoLayout } from "../../../../hooks/useAutoLayout";

interface UseBetterAuthTableSyncParams {
  data: BackendNodeData;
  updateData: (changes: Partial<BackendNodeData>) => void;
  nodeId: string;
  selectedDatabaseId?: string;
  schemaEntities: BackendNode[];
  isOrgEnabled: boolean;
}

export function useBetterAuthTableSync({
  data,
  updateData,
  nodeId,
  selectedDatabaseId,
  schemaEntities,
  isOrgEnabled,
}: UseBetterAuthTableSyncParams) {
  const { handleLayout: runSchemaAutoLayout } = useSchemaAutoLayout();
  const tableMappings: BetterAuthTableMapping = data.tableMappings || {};

  const addNode = useBackendCanvasStore((s) => s.addNode);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  const syncForeignKeysForTable = (
    def: BetterAuthTableDefinition,
    currentTableId: string,
    currentMappings: BetterAuthTableMapping,
  ) => {
    const currentNodes = useBackendCanvasStore.getState().nodes;

    def.defaultColumns.forEach((col, colIdx) => {
      if (col.isForeignKey && col.references) {
        const targetTableName = col.references.table;
        const targetDef = BETTER_AUTH_TABLE_DEFINITIONS.find(
          (d) => d.name === targetTableName,
        );
        if (targetDef) {
          const targetNodeId =
            currentMappings[targetDef.key] ||
            (targetDef.key === BETTER_AUTH_TABLE_KEYS.USER
              ? data.userEntityId || data.userSchemaId
              : undefined);
          if (targetNodeId && targetNodeId !== currentTableId) {
            const targetNode = currentNodes.find((n) => n.id === targetNodeId);
            const currentTableNode = currentNodes.find((n) => n.id === currentTableId);

            // Skip edge creation if source or target table node does not exist in store
            if (!targetNode || !currentTableNode) return;

            const currentEdges = useBackendCanvasStore.getState().edges;
            const hasEdge = currentEdges.some(
              (e) =>
                (e.source === targetNodeId && e.target === currentTableId) ||
                (e.source === currentTableId && e.target === targetNodeId),
            );
            if (!hasEdge) {
              const sourceCols = targetNode.data?.columns || targetDef.defaultColumns;
              const sourcePkIdx = (sourceCols as CanvasEntityColumn[]).findIndex((c) => c.isPrimaryKey);
              const sourceColIdx = sourcePkIdx !== -1 ? sourcePkIdx : 0;

              const targetCols = currentTableNode.data?.columns || def.defaultColumns;
              const targetFkIdx = (targetCols as CanvasEntityColumn[]).findIndex((c) => c.name === col.name);
              const targetColIdx = targetFkIdx !== -1 ? targetFkIdx : colIdx;

              addEdge({
                id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source: targetNodeId,
                target: currentTableId,
                sourceHandle: `source-${sourceColIdx}`,
                targetHandle: `target-${targetColIdx}`,
                type: BACKEND_EDGE_FOREIGN_KEY,
              });
            }
          }
        }
      }
    });
  };

  const createEntityForTable = (def: BetterAuthTableDefinition) => {
    const storeNodes = useBackendCanvasStore.getState().nodes;
    const authNode = storeNodes.find((n) => n.id === nodeId);
    const baseX = (authNode?.position?.x || 100) + 320;
    const baseY = (authNode?.position?.y || 100) + schemaEntities.length * 90;

    // Check if an entity node with matching label already exists on canvas (filtered to selected DB if set)
    const matchingEntity = storeNodes.find(
      (n) =>
        n.type === BACKEND_NODE_ENTITY &&
        (!selectedDatabaseId || n.data?.databaseId === selectedDatabaseId) &&
        n.data?.label?.toLowerCase().trim() === def.name.toLowerCase().trim(),
    );

    let targetEntityId: string;

    let dbId = selectedDatabaseId;
    if (matchingEntity) {
      targetEntityId = matchingEntity.id;
      // Inject missing default columns & indexes if any
      const currentCols: CanvasEntityColumn[] = matchingEntity.data?.columns ?? [];
      const missingCols = def.defaultColumns.filter(
        (reqCol) => !currentCols.some((c) => c.name.toLowerCase() === reqCol.name.toLowerCase()),
      );
      type EntityIndex = { name: string; columns: string; isUnique?: boolean };
      const currentIdxs: EntityIndex[] = matchingEntity.data?.indexes ?? [];
      const missingIdxs = (def.defaultIndexes ?? []).filter(
        (reqIdx) => !currentIdxs.some((idx) =>
          idx.name.toLowerCase() === reqIdx.name.toLowerCase() ||
          idx.columns.replace(/\s+/g, "").toLowerCase() === reqIdx.columns.replace(/\s+/g, "").toLowerCase(),
        ),
      );

      if (missingCols.length > 0 || missingIdxs.length > 0) {
        updateNode(matchingEntity.id, {
          data: {
            ...matchingEntity.data,
            columns: missingCols.length > 0 ? [...currentCols, ...missingCols] : currentCols,
            indexes: missingIdxs.length > 0 ? [...currentIdxs, ...missingIdxs] : currentIdxs,
          },
        });
      }
    } else {
      // Check if a database node exists; if not, create default SQLite DB node
      if (!dbId) {
        const dbNode = storeNodes.find((n) => n.type === BACKEND_NODE_DATABASE);
        dbId = dbNode?.id;

        if (!dbId) {
          dbId = crypto.randomUUID();
          const dbLabel = getUniqueNodeLabel(storeNodes, DEFAULT_DATABASE_NODE_LABEL, "database");
          addNode({
            id: dbId,
            type: BACKEND_NODE_DATABASE,
            position: { x: baseX - 300, y: baseY - 50 },
            data: {
              label: dbLabel,
              dbEngine: DEFAULT_DATABASE_ENGINE,
              dbType: "relational",
              dbCategory: "sql",
              dbConnectionType: "env_var",
              connectionStringEnv: DEFAULT_DATABASE_ENV_VARS.connectionStringEnv,
              dbFilePathEnv: DEFAULT_DATABASE_ENV_VARS.dbFilePathEnv,
              isDefault: true,
            },
          });
        }
      }

      targetEntityId = `entity-${Date.now()}-${def.name}`;
      addNode({
        id: targetEntityId,
        type: BACKEND_NODE_ENTITY,
        position: { x: baseX, y: baseY },
        data: {
          label: def.name,
          description: def.description,
          columns: def.defaultColumns,
          indexes: def.defaultIndexes ? [...def.defaultIndexes] : [],
          databaseId: dbId,
        },
      });

      if (dbId) {
        addEdge({
          id: `edge-${dbId}-${targetEntityId}`,
          source: dbId,
          target: targetEntityId,
          sourceHandle: "database-source",
          targetHandle: "database-entity-target",
          type: BACKEND_EDGE_DATABASE_CONNECTION,
        });
      }
    }

    const updatedMappings: BetterAuthTableMapping = {
      ...tableMappings,
      [def.key]: targetEntityId,
    };

    updateData({
      tableMappings: updatedMappings,
      ...(def.key === BETTER_AUTH_TABLE_KEYS.USER
        ? { userEntityId: targetEntityId, userSchemaId: targetEntityId }
        : {}),
      ...(dbId && !data.databaseId ? { databaseId: dbId } : {}),
    });

    syncForeignKeysForTable(def, targetEntityId, updatedMappings);
    runSchemaAutoLayout("LR");
    setTimeout(() => {
      runSchemaAutoLayout("LR");
    }, 50);
    toast.success(`Table "${def.name}" configured with columns and indexes.`);
  };

  const fixEntitySchema = (
    entityId: string,
    def: BetterAuthTableDefinition,
    missingColumns: BetterAuthTableDefinition["defaultColumns"] = [],
    missingIndexes: NonNullable<BetterAuthTableDefinition["defaultIndexes"]> = [],
  ) => {
    const entityNode = schemaEntities.find((e) => e.id === entityId);
    if (!entityNode || entityNode.type !== BACKEND_NODE_ENTITY) return;

    const currentCols = entityNode.data?.columns || [];
    const updatedCols = missingColumns.length > 0 ? [...currentCols, ...missingColumns] : currentCols;

    const currentIdxs = entityNode.data?.indexes || [];
    const updatedIdxs = missingIndexes.length > 0 ? [...currentIdxs, ...missingIndexes] : currentIdxs;

    updateNode(entityId, {
      data: {
        ...entityNode.data,
        columns: updatedCols,
        indexes: updatedIdxs,
      },
    });

    syncForeignKeysForTable(def, entityId, tableMappings);
    runSchemaAutoLayout("LR");
    setTimeout(() => {
      runSchemaAutoLayout("LR");
    }, 50);
    toast.success(`Updated ${def.name} table schema with missing columns and indexes.`);
  };

  const autoCreateAllMissingTables = () => {
    const storeNodes = useBackendCanvasStore.getState().nodes;
    const existingEntities = storeNodes.filter(
      (n) =>
        n.type === BACKEND_NODE_ENTITY &&
        (!selectedDatabaseId || n.data?.databaseId === selectedDatabaseId),
    );
    const enabledPlugins: string[] = data.plugins || ["bearer", "admin", "organization", "jwt"];

    const rawUserMapping = data.userEntityId || data.userSchemaId;
    const activeMappings: BetterAuthTableMapping = {};

    BETTER_AUTH_TABLE_DEFINITIONS.forEach((def) => {
      const rawId =
        tableMappings[def.key] ||
        (def.key === BETTER_AUTH_TABLE_KEYS.USER ? rawUserMapping : undefined);
      if (rawId && existingEntities.some((e) => e.id === rawId)) {
        activeMappings[def.key] = rawId;
      }
    });

    const authNode = storeNodes.find((n) => n.id === nodeId);
    const baseX = (authNode?.position?.x || 100) + 340;
    const baseY = (authNode?.position?.y || 100);

    // Check if a database node exists; if not, create default SQLite DB node
    let dbId = selectedDatabaseId;
    if (!dbId) {
      const dbNode = storeNodes.find((n) => n.type === BACKEND_NODE_DATABASE);
      dbId = dbNode?.id;

      if (!dbId) {
        dbId = crypto.randomUUID();
        const dbLabel = getUniqueNodeLabel(storeNodes, DEFAULT_DATABASE_NODE_LABEL, "database");
        addNode({
          id: dbId,
          type: BACKEND_NODE_DATABASE,
          position: { x: baseX - 300, y: baseY - 50 },
          data: {
            label: dbLabel,
            dbEngine: DEFAULT_DATABASE_ENGINE,
            dbType: "relational",
            dbCategory: "sql",
            dbConnectionType: "env_var",
            connectionStringEnv: DEFAULT_DATABASE_ENV_VARS.connectionStringEnv,
            dbFilePathEnv: DEFAULT_DATABASE_ENV_VARS.dbFilePathEnv,
            isDefault: true,
          },
        });
      }
    }

    let syncedCount = 0;
    let createdCount = 0;

    const requiredDefs = BETTER_AUTH_TABLE_DEFINITIONS.filter((def) =>
      isBetterAuthTableRequired(def, {
        isOrgEnabled,
        enabledPlugins,
        providers: data.providers,
      }),
    );

    requiredDefs.forEach((def) => {
      const mappedId = activeMappings[def.key];
      const matchingEntity = mappedId
        ? existingEntities.find((e) => e.id === mappedId)
        : existingEntities.find(
            (e) => e.data?.label?.toLowerCase().trim() === def.name.toLowerCase().trim(),
          );

      if (matchingEntity) {
        activeMappings[def.key] = matchingEntity.id;

        // Check if missing any default columns or indexes and backfill them
        const currentCols: CanvasEntityColumn[] = matchingEntity.data?.columns ?? [];
        const missingCols = def.defaultColumns.filter(
          (reqCol) => !currentCols.some((c) => c.name.toLowerCase() === reqCol.name.toLowerCase()),
        );

        type EntityIndex = { name: string; columns: string; isUnique?: boolean };
        const currentIdxs: EntityIndex[] = matchingEntity.data?.indexes ?? [];
        const missingIdxs = (def.defaultIndexes ?? []).filter(
          (reqIdx) => !currentIdxs.some((idx) =>
            idx.name.toLowerCase() === reqIdx.name.toLowerCase() ||
            idx.columns.replace(/\s+/g, "").toLowerCase() === reqIdx.columns.replace(/\s+/g, "").toLowerCase(),
          ),
        );

        if (missingCols.length > 0 || missingIdxs.length > 0) {
          updateNode(matchingEntity.id, {
            data: {
              ...matchingEntity.data,
              columns: missingCols.length > 0 ? [...currentCols, ...missingCols] : currentCols,
              indexes: missingIdxs.length > 0 ? [...currentIdxs, ...missingIdxs] : currentIdxs,
            },
          });
          syncedCount++;
        }
      } else {
        // Create new entity node
        const posY = baseY + (existingEntities.length + createdCount) * 110;
        createdCount++;

        const newEntityId = `entity-${Date.now()}-${def.name}`;
        addNode({
          id: newEntityId,
          type: BACKEND_NODE_ENTITY,
          position: { x: baseX, y: posY },
          data: {
            label: def.name,
            description: def.description,
            columns: def.defaultColumns,
            indexes: def.defaultIndexes ? [...def.defaultIndexes] : [],
            databaseId: dbId,
          },
        });

        if (dbId) {
          addEdge({
            id: `edge-${dbId}-${newEntityId}`,
            source: dbId,
            target: newEntityId,
            sourceHandle: "database-source",
            targetHandle: "database-entity-target",
            type: BACKEND_EDGE_DATABASE_CONNECTION,
          });
        }

        activeMappings[def.key] = newEntityId;
      }
    });

    updateData({
      tableMappings: activeMappings,
      userEntityId: activeMappings.userEntityId || data.userEntityId,
      userSchemaId: activeMappings.userEntityId || data.userSchemaId,
      ...(dbId && !data.databaseId ? { databaseId: dbId } : {}),
    });

    BETTER_AUTH_TABLE_DEFINITIONS.forEach((def) => {
      const mappedId = activeMappings[def.key];
      if (mappedId) {
        syncForeignKeysForTable(def, mappedId, activeMappings);
      }
    });

    // Run auto-layout so all tables and database nodes are cleanly positioned and never overlap
    runSchemaAutoLayout("LR");
    setTimeout(() => {
      runSchemaAutoLayout("LR");
    }, 50);

    if (createdCount > 0 || syncedCount > 0) {
      toast.success(
        `Better Auth tables updated: ${createdCount} created, ${syncedCount} synchronized with indexes & columns.`,
      );
    } else {
      toast.info("All Better Auth tables and indexes are already up to date.");
    }
  };

  const syncAllTableRelationships = () => {
    const storeNodes = useBackendCanvasStore.getState().nodes;
    const existingEntities = storeNodes.filter(
      (n) =>
        n.type === BACKEND_NODE_ENTITY &&
        (!selectedDatabaseId || n.data?.databaseId === selectedDatabaseId),
    );
    const rawUserMapping = data.userEntityId || data.userSchemaId;
    const activeMappings: BetterAuthTableMapping = {};

    BETTER_AUTH_TABLE_DEFINITIONS.forEach((def) => {
      const rawId =
        tableMappings[def.key] ||
        (def.key === BETTER_AUTH_TABLE_KEYS.USER ? rawUserMapping : undefined);
      if (rawId && existingEntities.some((e) => e.id === rawId)) {
        activeMappings[def.key] = rawId;
      }
    });

    BETTER_AUTH_TABLE_DEFINITIONS.forEach((def) => {
      const mappedId = activeMappings[def.key];
      if (mappedId) {
        syncForeignKeysForTable(def, mappedId, activeMappings);
      }
    });

    runSchemaAutoLayout("LR");
    setTimeout(() => {
      runSchemaAutoLayout("LR");
    }, 50);
    toast.success("Linked Better Auth foreign keys and arranged schema layout.");
  };

  const handleSelectTableMapping = (
    def: BetterAuthTableDefinition,
    nextEntityId?: string,
  ) => {
    const updated = {
      ...tableMappings,
      [def.key]: nextEntityId,
    };
    updateData({
      tableMappings: updated,
      ...(def.key === "userEntityId"
        ? {
            userEntityId: nextEntityId,
            userSchemaId: nextEntityId,
          }
        : {}),
    });
    if (nextEntityId) {
      syncForeignKeysForTable(def, nextEntityId, updated);
    }
  };

  const mappedCount = BETTER_AUTH_TABLE_DEFINITIONS.filter((def) => {
    const rawId =
      tableMappings[def.key] ||
      (def.key === "userEntityId" ? data.userEntityId || data.userSchemaId : undefined);
    return Boolean(rawId && schemaEntities.some((e) => e.id === rawId));
  }).length;

  return {
    tableMappings,
    mappedCount,
    createEntityForTable,
    fixEntitySchema,
    autoCreateAllMissingTables,
    syncForeignKeysForTable,
    syncAllTableRelationships,
    handleSelectTableMapping,
    runSchemaAutoLayout,
  };
}
