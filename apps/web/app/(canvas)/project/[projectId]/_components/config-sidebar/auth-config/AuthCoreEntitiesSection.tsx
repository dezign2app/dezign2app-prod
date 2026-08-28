import React from "react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Switch } from "@workspace/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import {
  UserCheck,
  Plus,
  Trash,
  Table,
  Code2,
  AlertCircle,
  Variable,
  Wand2,
  CheckCircle2,
  ShieldAlert,
  Building2,
  KeyRound,
  Sparkles,
  AlertTriangle,
  GitFork,
  Database,
} from "lucide-react";
import {
  AuthFunctionRef,
  BetterAuthTableMapping,
  DbOperationFunction,
  BetterAuthTableDefinition,
  BETTER_AUTH_TABLE_DEFINITIONS,
  BETTER_AUTH_TABLE_KEYS,
  BETTER_AUTH_CATEGORIES,
  BetterAuthCategory,
  BACKEND_NODE_ENTITY,
  BACKEND_NODE_DATABASE,
  BACKEND_EDGE_FOREIGN_KEY,
  BACKEND_EDGE_DATABASE_CONNECTION,
  DEFAULT_DATABASE_NODE_LABEL,
  DEFAULT_DATABASE_ENGINE,
  DEFAULT_DATABASE_ENV_VARS,
  getUniqueNodeLabel,
  isBetterAuthTableRequired,
} from "@workspace/canvas";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { AuthConfigSectionProps } from "./types";

export const AuthCoreEntitiesSection: React.FC<AuthConfigSectionProps> = ({
  data,
  updateData,
  allNodes,
  edges,
  nodeId,
}) => {
  const authFunctions: AuthFunctionRef[] = data.authFunctions || [];
  const tableMappings: BetterAuthTableMapping = data.tableMappings || {};
  const databaseNodes = allNodes.filter((n) => n.type === BACKEND_NODE_DATABASE);
  const selectedDatabaseId = data.databaseId;
  const selectedDb = databaseNodes.find((db) => db.id === selectedDatabaseId);

  const schemaEntities = allNodes.filter(
    (n) =>
      n.type === BACKEND_NODE_ENTITY &&
      (!selectedDatabaseId || n.data?.databaseId === selectedDatabaseId),
  );

  const orgConfig = data.organization || { enabled: true };
  const isOrgEnabled = orgConfig.enabled ?? true;

  const addNode = useBackendCanvasStore((s) => s.addNode);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  const getEntityDbOps = (entityNodeId?: string): DbOperationFunction[] => {
    if (!entityNodeId) return [];
    const entity = schemaEntities.find((e) => e.id === entityNodeId);
    if (!entity) return [];
    return getEntityDbOperations(entity, allNodes).filter((op) => op.enabled !== false);
  };

  const addFunctionMapping = () => {
    const firstEntity = schemaEntities[0];
    const ops = getEntityDbOps(firstEntity?.id);
    const newRef: AuthFunctionRef = {
      id: `af-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      variableName: "",
      entityNodeId: firstEntity?.id || "",
      functionId: ops[0]?.id || "",
    };
    updateData({ authFunctions: [...authFunctions, newRef] });
  };

  const updateMapping = (index: number, changes: Partial<AuthFunctionRef>) => {
    const updated = authFunctions.map((fn, idx) => {
      if (idx !== index) return fn;
      const nextFn = { ...fn, ...changes };
      if (changes.entityNodeId && changes.entityNodeId !== fn.entityNodeId) {
        const ops = getEntityDbOps(changes.entityNodeId);
        nextFn.functionId = ops[0]?.id || "";
      }
      return nextFn;
    });
    updateData({ authFunctions: updated });
  };

  const removeMapping = (index: number) => {
    const updated = authFunctions.filter((_, idx) => idx !== index);
    updateData({ authFunctions: updated });
  };

  // Helper to link canvas FK edges between mapped Better Auth tables
  const syncForeignKeysForTable = (
    def: BetterAuthTableDefinition,
    currentTableId: string,
    currentMappings: BetterAuthTableMapping,
  ) => {
    const currentNodes = useBackendCanvasStore.getState().nodes;

    def.defaultColumns.forEach((col, colIdx) => {
      if (col.isForeignKey && col.references) {
        const targetTableName = col.references.table;
        const targetDef = BETTER_AUTH_TABLE_DEFINITIONS.find((d) => d.name === targetTableName);
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
              const sourcePkIdx = sourceCols.findIndex((c) => c.isPrimaryKey);
              const sourceColIdx = sourcePkIdx !== -1 ? sourcePkIdx : 0;

              const targetCols = currentTableNode.data?.columns || def.defaultColumns;
              const targetFkIdx = targetCols.findIndex((c) => c.name === col.name);
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
        n.data?.label?.toLowerCase().trim() === def.name.toLowerCase().trim()
    );

    let targetEntityId: string;

    if (matchingEntity) {
      targetEntityId = matchingEntity.id;
      // Inject missing default columns if any
      const currentCols = matchingEntity.data?.columns || [];
      const missingCols = def.defaultColumns.filter(
        (reqCol) => !currentCols.some((c) => c.name.toLowerCase() === reqCol.name.toLowerCase())
      );
      if (missingCols.length > 0) {
        updateNode(matchingEntity.id, {
          data: {
            ...matchingEntity.data,
            columns: [...currentCols, ...missingCols],
          },
        });
      }
    } else {
      // Check if a database node exists; if not, create default SQLite DB node
      let dbId = selectedDatabaseId;
      if (!dbId) {
        let dbNode = storeNodes.find((n) => n.type === BACKEND_NODE_DATABASE);
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
    });

    syncForeignKeysForTable(def, targetEntityId, updatedMappings);
  };

  const fixEntitySchema = (
    entityId: string,
    def: BetterAuthTableDefinition,
    missingColumns: BetterAuthTableDefinition["defaultColumns"],
  ) => {
    const entityNode = schemaEntities.find((e) => e.id === entityId);
    if (!entityNode || entityNode.type !== BACKEND_NODE_ENTITY) return;

    const currentCols = entityNode.data.columns || [];
    const updatedCols = [...currentCols, ...missingColumns];
    updateNode(entityId, {
      data: {
        ...entityNode.data,
        columns: updatedCols,
      },
    });

    syncForeignKeysForTable(def, entityId, tableMappings);
  };

  const autoCreateAllMissingTables = () => {
    const storeNodes = useBackendCanvasStore.getState().nodes;
    const existingEntities = storeNodes.filter(
      (n) =>
        n.type === BACKEND_NODE_ENTITY &&
        (!selectedDatabaseId || n.data?.databaseId === selectedDatabaseId)
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

    const tablesToCreate = BETTER_AUTH_TABLE_DEFINITIONS.filter((def) => {
      if (activeMappings[def.key]) return false;
      return isBetterAuthTableRequired(def, {
        isOrgEnabled,
        enabledPlugins,
        providers: data.providers,
      });
    });

    if (tablesToCreate.length === 0) return;

    const authNode = storeNodes.find((n) => n.id === nodeId);
    const baseX = (authNode?.position?.x || 100) + 340;
    const baseY = (authNode?.position?.y || 100);

    // Check if a database node exists; if not, create default SQLite DB node
    let dbId = selectedDatabaseId;
    if (!dbId) {
      let dbNode = storeNodes.find((n) => n.type === BACKEND_NODE_DATABASE);
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

    let createdCount = 0;
    tablesToCreate.forEach((def) => {
      // 1. Check if an entity node with matching name already exists on canvas in this DB
      const matchingEntity = existingEntities.find(
        (e) => e.data?.label?.toLowerCase().trim() === def.name.toLowerCase().trim()
      );

      if (matchingEntity) {
        // Map to existing entity
        activeMappings[def.key] = matchingEntity.id;

        // Check if missing any default columns and inject them
        const currentCols = matchingEntity.data?.columns || [];
        const missingCols = def.defaultColumns.filter(
          (reqCol) => !currentCols.some((c) => c.name.toLowerCase() === reqCol.name.toLowerCase())
        );

        if (missingCols.length > 0) {
          updateNode(matchingEntity.id, {
            data: {
              ...matchingEntity.data,
              columns: [...currentCols, ...missingCols],
            },
          });
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
    });

    BETTER_AUTH_TABLE_DEFINITIONS.forEach((def) => {
      const mappedId = activeMappings[def.key];
      if (mappedId) {
        syncForeignKeysForTable(def, mappedId, activeMappings);
      }
    });
  };

  const syncAllTableRelationships = () => {
    const storeNodes = useBackendCanvasStore.getState().nodes;
    const existingEntities = storeNodes.filter(
      (n) =>
        n.type === BACKEND_NODE_ENTITY &&
        (!selectedDatabaseId || n.data?.databaseId === selectedDatabaseId)
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
  };

  const categories = [
    {
      id: BETTER_AUTH_CATEGORIES.CORE,
      title: "Core Auth Tables",
      icon: ShieldAlert,
      badgeText: "Required",
      badgeColor: "bg-primary/15 text-primary border-primary/20",
      description: "Mandatory database tables required for core authentication & sessions.",
      isToggleable: false,
    },
    {
      id: BETTER_AUTH_CATEGORIES.ORGANIZATION,
      title: "Organization & Workspaces Tables",
      icon: Building2,
      badgeText: isOrgEnabled ? "Plugin Active" : "Disabled",
      badgeColor: isOrgEnabled
        ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20"
        : "bg-muted text-muted-foreground border-border/40",
      description: "Multi-tenant workspaces, team memberships, and onboarding invitations.",
      isToggleable: true,
      isEnabled: isOrgEnabled,
      onToggle: (enabled: boolean) => {
        const enabledPlugins = data.plugins || ["bearer", "admin", "organization", "jwt"];
        const nextPlugins = enabled
          ? Array.from(new Set([...enabledPlugins, "organization"]))
          : enabledPlugins.filter((p) => p !== "organization");
        updateData({
          organization: { ...orgConfig, enabled },
          plugins: nextPlugins,
        });
      },
    },
    {
      id: BETTER_AUTH_CATEGORIES.PLUGIN,
      title: "Extension & Plugin Tables",
      icon: KeyRound,
      badgeText: "Optional Plugins",
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
      description: "WebAuthn Passkey, 2FA TOTP secrets, JWKS keys, and rate limit counters.",
      isToggleable: false,
    },
  ] satisfies Array<{
    id: BetterAuthCategory;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeText: string;
    badgeColor: string;
    description: string;
    isToggleable: boolean;
    isEnabled?: boolean;
    onToggle?: (enabled: boolean) => void;
  }>;

  const mappedCount = BETTER_AUTH_TABLE_DEFINITIONS.filter((def) => {
    const rawId =
      tableMappings[def.key] ||
      (def.key === "userEntityId" ? data.userEntityId || data.userSchemaId : undefined);
    return Boolean(rawId && schemaEntities.some((e) => e.id === rawId));
  }).length;

  return (
    <AccordionItem
      value="core-entities"
      className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden border-primary/30"
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
        <div className="flex flex-col items-start gap-2 text-left flex-1">
          <div className="flex gap-2 items-center">
            <UserCheck className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Better Auth Database Tables & Functions
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium">
              {mappedCount} / {BETTER_AUTH_TABLE_DEFINITIONS.length} Tables Mapped
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 font-medium">
              {authFunctions.length} Functions
            </span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4 pt-1">
        <div className="flex flex-col gap-6 pt-2">
          {/* Target Database Selection */}
          <div className="p-3 bg-background/60 rounded-lg border border-border/50 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-foreground">Target Database Node</span>
              </div>
              {selectedDb && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase font-semibold">
                  {selectedDb.data?.dbEngine || "sqlite"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Select which database node from your schema this Auth Server operates on. Tables and functions will be filtered to this database.
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={selectedDatabaseId || "none"}
                onValueChange={(val: string) =>
                  updateData({ databaseId: val === "none" ? undefined : val })
                }
              >
                <SelectTrigger className="h-8 text-xs font-mono bg-background">
                  <SelectValue placeholder="Select Database Node..." />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  <SelectItem value="none" className="text-xs font-mono text-muted-foreground">
                    All Database Tables (No DB Filter)
                  </SelectItem>
                  {databaseNodes.map((db) => (
                    <SelectItem key={db.id} value={db.id} className="text-xs font-mono">
                      {db.data?.label || "Database"} ({db.data?.dbEngine || "sqlite"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDatabaseId && schemaEntities.length === 0 && (
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-600 dark:text-amber-400 font-mono">
                <span>No tables in this database yet.</span>
                <button
                  type="button"
                  onClick={autoCreateAllMissingTables}
                  className="font-bold underline hover:text-amber-500 shrink-0 text-[11px]"
                >
                  Auto-create Better Auth tables &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Section 1: Better Auth Required Tables Grouped By Category */}
          <div className="flex flex-col gap-4 p-3.5 bg-background/50 rounded-lg border border-border/40">
            <div className="flex flex-col items-start gap-4 justify-start">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-primary" /> Better Auth Schema Entity Mapping
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Map official Better Auth tables by feature category or auto-generate missing tables.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-background shrink-0 font-medium"
                  onClick={syncAllTableRelationships}
                  title="Connect FK edges between user, session, organization, member, etc."
                >
                  <GitFork className="w-3.5 h-3.5 mr-1 text-primary" /> Auto-Link FK Edges
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/30 shrink-0 font-medium"
                  onClick={autoCreateAllMissingTables}
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1" /> Auto-Create Missing Tables
                </Button>
              </div>
            </div>

            {/* Category Groups */}
            <div className="flex flex-col gap-5 pt-1">
              {categories.map((cat) => {
                const IconComponent = cat.icon;
                const catTables = BETTER_AUTH_TABLE_DEFINITIONS.filter((def) => def.category === cat.id);
                const isCatDisabled = cat.isToggleable && cat.isEnabled === false;

                return (
                  <div
                    key={cat.id}
                    className={`flex flex-col gap-2.5 p-3 rounded-lg border transition-colors ${
                      isCatDisabled
                        ? "bg-background/30 border-border/30 opacity-70"
                        : "bg-background/70 border-border/60"
                    }`}
                  >
                    {/* Category Header */}
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wide">
                          {cat.title}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-semibold font-mono border ${cat.badgeColor}`}>
                          {cat.badgeText}
                        </span>
                      </div>

                      {cat.isToggleable && cat.onToggle && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {cat.isEnabled ? "Plugin Enabled" : "Disabled"}
                          </span>
                          <Switch
                            checked={cat.isEnabled ?? false}
                            onCheckedChange={(checked: boolean) => cat.onToggle?.(checked)}
                          />
                        </div>
                      )}
                    </div>

                    <p className="text-[10.5px] text-muted-foreground">{cat.description}</p>

                    {/* Table Rows for this Category */}
                    {!isCatDisabled ? (
                      <div className="flex flex-col gap-2 pt-1">
                        {catTables.map((def) => {
                          const rawMappedId =
                            tableMappings[def.key] ||
                            (def.key === "userEntityId" ? data.userEntityId || data.userSchemaId : undefined);
                          const mappedEntity = schemaEntities.find((e) => e.id === rawMappedId);
                          const mappedId = mappedEntity ? mappedEntity.id : undefined;

                          const existingCols = mappedEntity?.type === "entity" ? mappedEntity.data.columns || [] : [];
                          const missingColumns = mappedEntity
                            ? def.defaultColumns.filter(
                                (reqCol) => !existingCols.some((c) => c.name.toLowerCase() === reqCol.name.toLowerCase()),
                              )
                            : [];

                          return (
                            <div key={def.key} className="flex flex-col gap-1.5">
                              <div className="grid grid-cols-12 gap-2 items-center p-2 rounded bg-background border border-border/50 text-xs">
                                <div className="col-span-3 flex flex-col gap-0.5">
                                  <span className="font-mono font-bold text-foreground capitalize">{def.name}</span>
                                  <span className="text-[10px] text-muted-foreground truncate">{def.description}</span>
                                </div>

                                <div className="col-span-6">
                                  <Select
                                    value={mappedId || "none"}
                                    onValueChange={(val: string) => {
                                      const nextEntityId = val === "none" ? undefined : val;
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
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-xs font-mono bg-background">
                                      <SelectValue placeholder="Select Entity Node..." />
                                    </SelectTrigger>
                                    <SelectContent className="font-mono">
                                      <SelectItem value="none" className="text-xs font-mono text-muted-foreground">
                                        Unmapped
                                      </SelectItem>
                                      {schemaEntities.map((entity) => (
                                        <SelectItem key={entity.id} value={entity.id} className="text-xs font-mono">
                                          {entity.data.label || "Untitled Entity"} ({entity.data.columns?.length || 0} cols)
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="col-span-3 flex justify-end items-center gap-1.5">
                                  {mappedEntity ? (
                                    missingColumns.length === 0 ? (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Valid
                                      </span>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20 font-medium"
                                        onClick={() => fixEntitySchema(mappedEntity.id, def, missingColumns)}
                                        title={`Add ${missingColumns.map((c) => c.name).join(", ")}`}
                                      >
                                        <Sparkles className="w-3 h-3 mr-1" /> Add {missingColumns.length} Cols
                                      </Button>
                                    )
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-[11px] bg-background"
                                      onClick={() => createEntityForTable(def)}
                                    >
                                      <Plus className="w-3 h-3 mr-1 text-primary" /> Create Table
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Schema Missing Columns Banner */}
                              {mappedEntity && missingColumns.length > 0 && (
                                <div className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10.5px] text-amber-600 dark:text-amber-400 font-mono">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      Entity <strong>{mappedEntity.data.label}</strong> missing required fields:{" "}
                                      <span className="font-bold underline">
                                        {missingColumns.map((c) => c.name).join(", ")}
                                      </span>
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => fixEntitySchema(mappedEntity.id, def, missingColumns)}
                                    className="ml-2 font-bold underline hover:text-amber-500 text-[10px] shrink-0"
                                  >
                                    Inject Missing Columns & FKs
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-2 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded bg-background/20 font-mono">
                        Plugin disabled. Enable switch above to configure tables.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Associated DB Functions */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/40">
              <div className="flex flex-col gap-0.5">
                <Label className="text-xs font-semibold">Associated DB Functions</Label>
                <p className="text-[11px] text-muted-foreground">
                  Add variables and map them to entity tables and their associated database functions.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background shrink-0 font-medium"
                onClick={addFunctionMapping}
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-primary" /> Add Function
              </Button>
            </div>

            {authFunctions.length > 0 ? (
              <div className="flex flex-col gap-3">
                {authFunctions.map((af, idx) => {
                  const selectedEntity = schemaEntities.find((e) => e.id === af.entityNodeId);
                  const dbOps = getEntityDbOps(af.entityNodeId);
                  const matchedOp = dbOps.find((op) => op.id === af.functionId || op.name === af.functionId);
                  const currentFunctionId = matchedOp ? matchedOp.id : af.functionId || "none";

                  return (
                    <div
                      key={af.id || idx}
                      className="flex flex-col gap-2.5 p-3 rounded-lg bg-background/80 border border-border/50 text-xs shadow-sm"
                    >
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3 flex flex-col gap-1">
                          <Label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            Variable
                          </Label>
                          <Input
                            placeholder="e.g. user, subscription"
                            value={af.variableName || ""}
                            onChange={(e) => updateMapping(idx, { variableName: e.target.value })}
                            className="h-7 text-xs font-mono bg-background"
                          />
                        </div>

                        <div className="col-span-4 flex flex-col gap-1">
                          <Label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            <Table className="w-3 h-3 text-primary" /> Entity
                          </Label>
                          <Select
                            value={af.entityNodeId || "none"}
                            onValueChange={(val: string) =>
                              updateMapping(idx, { entityNodeId: val === "none" ? "" : val })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs bg-background">
                              <SelectValue placeholder="Select Table..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs text-muted-foreground">
                                Select Table...
                              </SelectItem>
                              {schemaEntities.map((entity) => (
                                <SelectItem key={entity.id} value={entity.id} className="text-xs">
                                  {entity.data.label || "Untitled Entity"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-4 flex flex-col gap-1">
                          <Label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            <Code2 className="w-3 h-3 text-primary" /> Associated Function
                          </Label>
                          <Select
                            value={currentFunctionId}
                            onValueChange={(val: string) =>
                              updateMapping(idx, { functionId: val === "none" ? "" : val })
                            }
                            disabled={!selectedEntity || dbOps.length === 0}
                          >
                            <SelectTrigger className="h-7 text-xs font-mono bg-background">
                              <SelectValue
                                placeholder={
                                  !selectedEntity
                                    ? "Select Table first..."
                                    : dbOps.length === 0
                                    ? "No functions available"
                                    : "Select function..."
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="font-mono">
                              <SelectItem value="none" className="text-xs text-muted-foreground">
                                Select function...
                              </SelectItem>
                              {dbOps.map((op) => (
                                <SelectItem key={op.id} value={op.id} className="text-xs font-mono">
                                  {op.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-1 flex justify-end items-end pt-4">
                          <button
                            onClick={() => removeMapping(idx)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Remove function mapping"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {selectedEntity && dbOps.length === 0 && (
                        <div className="flex items-center gap-1.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>
                            No database functions defined on table <strong>{selectedEntity.data.label}</strong>. Add queries or CRUD ops on that Entity node.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-5 border border-dashed border-border/60 rounded-lg text-center bg-background/30 gap-2">
                <Variable className="w-5 h-5 text-muted-foreground/60" />
                <span className="text-xs font-medium text-foreground">No Function Mappings Added</span>
              </div>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
