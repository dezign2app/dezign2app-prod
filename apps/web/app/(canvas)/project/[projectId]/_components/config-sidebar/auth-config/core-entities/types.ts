import React from "react";
import {
  BetterAuthCategory,
  BetterAuthTableDefinition,
  BetterAuthTableMapping,
  AuthFunctionRef,
  DbOperationFunction,
} from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";

export interface CategoryConfig {
  id: BetterAuthCategory;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeText: string;
  badgeColor: string;
  description: string;
  isToggleable: boolean;
  isEnabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}

export interface TargetDatabaseSelectorProps {
  selectedDatabaseId?: string;
  databaseNodes: BackendNode[];
  selectedDb?: BackendNode;
  schemaEntitiesCount: number;
  onSelectDatabase: (val: string) => void;
  onAutoCreateMissingTables: () => void;
}

export interface BetterAuthTableRowProps {
  def: BetterAuthTableDefinition;
  mappedId?: string;
  schemaEntities: BackendNode[];
  onSelectEntity: (entityId?: string) => void;
  onFixSchema: (
    entityId: string,
    def: BetterAuthTableDefinition,
    missingColumns: BetterAuthTableDefinition["defaultColumns"],
    missingIndexes: NonNullable<BetterAuthTableDefinition["defaultIndexes"]>,
  ) => void;
  onCreateTable: (def: BetterAuthTableDefinition) => void;
}

export interface BetterAuthCategoryCardProps {
  category: CategoryConfig;
  children: React.ReactNode;
}

export interface BetterAuthTableMappingSectionProps {
  categories: CategoryConfig[];
  tableMappings: BetterAuthTableMapping;
  userData: {
    userEntityId?: string;
    userSchemaId?: string;
  };
  schemaEntities: BackendNode[];
  onSelectTableMapping: (
    def: BetterAuthTableDefinition,
    entityId?: string,
  ) => void;
  onFixSchema: (
    entityId: string,
    def: BetterAuthTableDefinition,
    missingColumns: BetterAuthTableDefinition["defaultColumns"],
    missingIndexes: NonNullable<BetterAuthTableDefinition["defaultIndexes"]>,
  ) => void;
  onCreateTable: (def: BetterAuthTableDefinition) => void;
  onSyncAllRelationships: () => void;
  onAutoCreateAllMissingTables: () => void;
}

export interface AssociatedDbFunctionsSectionProps {
  authFunctions: AuthFunctionRef[];
  schemaEntities: BackendNode[];
  onAddFunctionMapping: () => void;
  onUpdateMapping: (index: number, changes: Partial<AuthFunctionRef>) => void;
  onRemoveMapping: (index: number) => void;
  getEntityDbOps: (entityNodeId?: string) => DbOperationFunction[];
}
