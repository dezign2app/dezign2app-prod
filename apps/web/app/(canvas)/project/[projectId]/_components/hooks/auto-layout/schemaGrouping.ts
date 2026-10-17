import type { LayoutNode } from "./types";
import {
  BETTER_AUTH_TABLE_DEFINITIONS,
  LANGGRAPH_POSTGRES_TABLE_DEFINITIONS,
  LANGGRAPH_SQLITE_TABLE_DEFINITIONS,
  LANGGRAPH_REDIS_SCHEMA_DEFINITIONS,
} from "@workspace/canvas";

export interface SchemaFunctionalGroup {
  key: string;
  title: string;
  description: string;
  color?: string;
  badge?: string;
  entities: LayoutNode[];
  groupNode?: LayoutNode;
}

const AUTH_TABLE_NAMES = new Set<string>([
  "user",
  "users",
  "session",
  "sessions",
  "account",
  "accounts",
  "verification",
  "verifications",
  "twofactor",
  "two_factor",
  "twofactors",
  "passkey",
  "passkeys",
  "jwks",
  "jwk",
  "organization",
  "organizations",
  "member",
  "members",
  "invitation",
  "invitations",
  "team",
  "teams",
  "teammember",
  "team_member",
  "teammembers",
  "team_members",
  "ratelimit",
  "rate_limit",
  "ratelimits",
  "rate_limits",
]);

// Also include all names from official definitions
BETTER_AUTH_TABLE_DEFINITIONS.forEach((def) => {
  if (def.name) AUTH_TABLE_NAMES.add(def.name.toLowerCase());
  if (def.key) AUTH_TABLE_NAMES.add(def.key.toLowerCase());
});

const LANGGRAPH_TABLE_NAMES = new Set<string>([
  "checkpoints",
  "checkpoint",
  "checkpoint_blobs",
  "checkpoint_blob",
  "checkpoint_writes",
  "checkpoint_write",
  "checkpoint_migrations",
  "checkpoint_migration",
  "writes",
  "write",
  "langgraph_checkpoints",
  "langgraph_checkpoint_blobs",
  "langgraph_checkpoint_writes",
  "langgraph_checkpoint_migrations",
]);

LANGGRAPH_POSTGRES_TABLE_DEFINITIONS.forEach((def) => {
  if (def.name) LANGGRAPH_TABLE_NAMES.add(def.name.toLowerCase());
});
LANGGRAPH_SQLITE_TABLE_DEFINITIONS.forEach((def) => {
  if (def.name) LANGGRAPH_TABLE_NAMES.add(def.name.toLowerCase());
});
LANGGRAPH_REDIS_SCHEMA_DEFINITIONS.forEach((def) => {
  if (def.name) LANGGRAPH_TABLE_NAMES.add(def.name.toLowerCase());
});

function getCleanEntityName(node: LayoutNode): string {
  const label =
    node.data?.label ||
    node.data?.tableName ||
    node.data?.tableRef ||
    node.id ||
    "";
  return label.toLowerCase().trim();
}

/**
 * Checks if an entity node belongs to the Authentication functional group (Better Auth).
 */
export function isAuthEntity(node: LayoutNode): boolean {
  if (node.type !== "entity") return false;
  const systemBadge = node.data?.systemBadge;
  if (systemBadge === "auth" || systemBadge === "better-auth") return true;

  const rawName = getCleanEntityName(node);
  if (AUTH_TABLE_NAMES.has(rawName)) return true;

  const normalized = rawName.replace(/[-_\s]/g, "");
  if (AUTH_TABLE_NAMES.has(normalized)) return true;

  return false;
}

/**
 * Checks if an entity or redis_schema node belongs to the LangGraph checkpointer group.
 */
export function isLangGraphEntity(node: LayoutNode): boolean {
  const systemBadge = node.data?.systemBadge;
  if (systemBadge === "langgraph") return true;

  const rawName = getCleanEntityName(node);
  if (LANGGRAPH_TABLE_NAMES.has(rawName)) return true;

  if (
    rawName.startsWith("checkpoint") ||
    rawName.startsWith("langgraph_") ||
    rawName.startsWith("langgraph-")
  ) {
    return true;
  }

  return false;
}

/**
 * Partitions a list of entity nodes belonging to a single storage cluster (or database)
 * into cohesive, common-purpose functional groups (Authentication, Application, LangGraph, etc.)
 */
export function partitionEntitiesIntoFunctionalGroups(
  entities: LayoutNode[],
  existingGroupNodes: LayoutNode[] = [],
): SchemaFunctionalGroup[] {
  if (entities.length === 0) return [];

  const authEntities: LayoutNode[] = [];
  const langgraphEntities: LayoutNode[] = [];
  const appEntities: LayoutNode[] = [];
  const customGroupMap = new Map<string, { title: string; entities: LayoutNode[]; groupNode?: LayoutNode }>();

  // Map of existing group nodes by id and by lowercase label
  const groupById = new Map<string, LayoutNode>();
  const groupByLabel = new Map<string, LayoutNode>();
  existingGroupNodes.forEach((g) => {
    groupById.set(g.id, g);
    const label = (g.data?.label || "").toLowerCase().trim();
    if (label) groupByLabel.set(label, g);
  });

  entities.forEach((entity) => {
    // 1. Check if node is assigned to an explicit existing group via parentId or data.groupId
    const parentId = entity.parentId || entity.data?.groupId;
    if (parentId && groupById.has(parentId)) {
      const gNode = groupById.get(parentId)!;
      const gTitle = gNode.data?.label || "Custom Group";
      const existing = customGroupMap.get(parentId) || { title: gTitle, entities: [], groupNode: gNode };
      existing.entities.push(entity);
      customGroupMap.set(parentId, existing);
      return;
    }

    // 2. Check if entity is LangGraph
    if (isLangGraphEntity(entity)) {
      langgraphEntities.push(entity);
      return;
    }

    // 3. Check if entity is Auth
    if (isAuthEntity(entity)) {
      authEntities.push(entity);
      return;
    }

    // 4. Default: Application / Domain entity
    appEntities.push(entity);
  });

  const result: SchemaFunctionalGroup[] = [];

  // Group 1: Authentication
  if (authEntities.length > 0) {
    const matchedGroup =
      groupByLabel.get("authentication") ||
      groupByLabel.get("auth") ||
      groupByLabel.get("better auth");
    result.push({
      key: "auth",
      title: "Authentication",
      description: "User accounts, credentials, sessions, and organizations",
      color: "#0ea5e9", // Sky accent
      badge: "Auth",
      entities: authEntities,
      groupNode: matchedGroup,
    });
  }

  // Group 2: Application / Domain Tables
  if (appEntities.length > 0) {
    const matchedGroup =
      groupByLabel.get("application") ||
      groupByLabel.get("app") ||
      groupByLabel.get("domain") ||
      groupByLabel.get("tables");
    result.push({
      key: "app",
      title: "Application",
      description: "Application domain entities and business tables",
      color: "#f59e0b", // Amber accent
      badge: "App Schema",
      entities: appEntities,
      groupNode: matchedGroup,
    });
  }

  // Group 3: LangGraph Checkpointer State
  if (langgraphEntities.length > 0) {
    const matchedGroup =
      groupByLabel.get("langgraph") ||
      groupByLabel.get("checkpoints") ||
      groupByLabel.get("agent state");
    result.push({
      key: "langgraph",
      title: "LangGraph",
      description: "State snapshots, checkpoints, buffers, and thread memory",
      color: "#a855f7", // Purple/Violet accent
      badge: "LangGraph",
      entities: langgraphEntities,
      groupNode: matchedGroup,
    });
  }

  // Group 4+: Custom User Groups
  customGroupMap.forEach((gData, gId) => {
    result.push({
      key: `custom-${gId}`,
      title: gData.title,
      description: "User-defined schema group",
      color: "#3b82f6",
      badge: "Group",
      entities: gData.entities,
      groupNode: gData.groupNode,
    });
  });

  return result;
}
