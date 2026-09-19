import React from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import {
  UserCheck,
  ShieldAlert,
  Building2,
  KeyRound,
} from "lucide-react";
import {
  AuthFunctionRef,
  BETTER_AUTH_TABLE_DEFINITIONS,
  BETTER_AUTH_CATEGORIES,
  BACKEND_NODE_DATABASE,
  BACKEND_NODE_ENTITY,
} from "@workspace/canvas";
import { AuthConfigSectionProps } from "./types";
import {
  CategoryConfig,
  TargetDatabaseSelector,
  BetterAuthTableMappingSection,
  AssociatedDbFunctionsSection,
  useBetterAuthTableSync,
  useAuthFunctionMappings,
} from "./core-entities";

export const AuthCoreEntitiesSection: React.FC<AuthConfigSectionProps> = ({
  data,
  updateData,
  allNodes,
  nodeId,
}) => {
  const authFunctions: AuthFunctionRef[] = data.authFunctions || [];
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

  const {
    tableMappings,
    mappedCount,
    createEntityForTable,
    fixEntitySchema,
    autoCreateAllMissingTables,
    syncAllTableRelationships,
    handleSelectTableMapping,
  } = useBetterAuthTableSync({
    data,
    updateData,
    nodeId,
    selectedDatabaseId,
    schemaEntities,
    isOrgEnabled,
  });

  const {
    getEntityDbOps,
    addFunctionMapping,
    updateMapping,
    removeMapping,
  } = useAuthFunctionMappings({
    authFunctions,
    updateData,
    schemaEntities,
    allNodes,
  });

  const categories: CategoryConfig[] = [
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
  ];

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
          <TargetDatabaseSelector
            selectedDatabaseId={selectedDatabaseId}
            databaseNodes={databaseNodes}
            selectedDb={selectedDb}
            schemaEntitiesCount={schemaEntities.length}
            onSelectDatabase={(val) =>
              updateData({ databaseId: val === "none" ? undefined : val })
            }
            onAutoCreateMissingTables={autoCreateAllMissingTables}
          />

          {/* Section 1: Better Auth Required Tables Grouped By Category */}
          <BetterAuthTableMappingSection
            categories={categories}
            tableMappings={tableMappings}
            userData={{
              userEntityId: data.userEntityId,
              userSchemaId: data.userSchemaId,
            }}
            schemaEntities={schemaEntities}
            onSelectTableMapping={handleSelectTableMapping}
            onFixSchema={fixEntitySchema}
            onCreateTable={createEntityForTable}
            onSyncAllRelationships={syncAllTableRelationships}
            onAutoCreateAllMissingTables={autoCreateAllMissingTables}
          />

          {/* Section 2: Associated DB Functions */}
          <AssociatedDbFunctionsSection
            authFunctions={authFunctions}
            schemaEntities={schemaEntities}
            onAddFunctionMapping={addFunctionMapping}
            onUpdateMapping={updateMapping}
            onRemoveMapping={removeMapping}
            getEntityDbOps={getEntityDbOps}
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
