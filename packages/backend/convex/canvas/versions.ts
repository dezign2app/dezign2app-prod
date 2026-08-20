import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  VersionChangeSummary,
  VersionListItem,
} from "../schema/canvasVersionsValidator";
import type {
  BackendNodeData,
  BackendNodeType,
  EdgeData,
} from "@workspace/canvas/types";
import type {
  Endpoint,
  AnyMessagingResource,
  IdentityProvider,
} from "@workspace/canvas/types";
import type { SimulationTestCase } from "@workspace/canvas/types";

export type { VersionChangeSummary, VersionListItem };

// WireSnapshot uses the same canonical canvas types as the rest of the app.
// Stored as a JSON string (snapshotJson) to avoid TS7056 depth limits.
// On read (parseSnapshot) JSON.parse returns the raw object which structurally
// matches these types since Convex validates fields on write.
type WireSnapshotNode = {
  nodeId: string;
  type: BackendNodeType;
  position: { x: number; y: number };
  data: BackendNodeData;
  fractionalIndex: string;
};

type WireSnapshotEdge = {
  edgeId: string;
  source: string;
  target: string;
  type: string;
  sourceHandle?: string;
  targetHandle?: string;
  data: EdgeData;
  fractionalIndex: string;
  rulesVersion?: number;
};

type WireSnapshotEndpoint = {
  nodeId: string;
  endpointId: string;
  data: Endpoint;
};

type WireSnapshotEvent = {
  nodeId: string;
  eventId: string;
  variant: "publish" | "consume";
  data: AnyMessagingResource;
};

type WireSnapshotIdentityProvider = {
  nodeId: string;
  providerId: string;
  data: IdentityProvider;
};

type WireSnapshotTestCase = {
  testCaseId: string;
  data: SimulationTestCase;
};

type WireSnapshot = {
  nodes: WireSnapshotNode[];
  edges: WireSnapshotEdge[];
  endpoints: WireSnapshotEndpoint[];
  events: WireSnapshotEvent[];
  identityProviders: WireSnapshotIdentityProvider[];
  testCases: WireSnapshotTestCase[];
};

function parseSnapshot(json: string): WireSnapshot {
  return JSON.parse(json) as WireSnapshot;
}

export const getProjectVersions = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<VersionListItem[]> => {
    const versions = await ctx.db
      .query("project_versions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return versions.map((vDoc) => ({
      _id: vDoc._id,
      _creationTime: vDoc._creationTime,
      projectId: vDoc.projectId,
      versionNumber: vDoc.versionNumber,
      title: vDoc.title,
      description: vDoc.description,
      authorId: vDoc.authorId,
      authorName: vDoc.authorName,
      authorAvatar: vDoc.authorAvatar,
      changeSummary: vDoc.changeSummary,
      isAutoSave: vDoc.isAutoSave,
      createdAt: vDoc.createdAt,
    }));
  },
});

export const getVersionById = query({
  args: { versionId: v.id("project_versions") },
  handler: async (
    ctx,
    args,
  ): Promise<(VersionListItem & { snapshot: WireSnapshot }) | null> => {
    const version = await ctx.db.get(args.versionId);
    if (!version) return null;

    return {
      _id: version._id,
      _creationTime: version._creationTime,
      projectId: version.projectId,
      versionNumber: version.versionNumber,
      title: version.title,
      description: version.description,
      authorId: version.authorId,
      authorName: version.authorName,
      authorAvatar: version.authorAvatar,
      changeSummary: version.changeSummary,
      isAutoSave: version.isAutoSave,
      createdAt: version.createdAt,
      snapshot: parseSnapshot(version.snapshotJson),
    };
  },
});

export const createProjectVersion = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    isAutoSave: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"project_versions">> => {
    const identity = await ctx.auth.getUserIdentity();
    const authorId = identity?.subject ?? "anonymous";
    const authorName =
      identity?.name ?? identity?.nickname ?? identity?.email ?? "Collaborator";
    const authorAvatar = identity?.pictureUrl;

    // Collect current live state for project
    const rawNodes = await ctx.db
      .query("canvas_backend_nodes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const rawEdges = await ctx.db
      .query("canvas_backend_edges")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const rawEndpoints = await ctx.db
      .query("canvas_backend_endpoints")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const rawEvents = await ctx.db
      .query("canvas_backend_events")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const rawIdentityProviders = await ctx.db
      .query("canvas_backend_identity_providers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const rawTestCases = await ctx.db
      .query("canvas_backend_test_cases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Map to clean snapshot items (stripping internal db document _id, _creationTime, projectId)
    const nodes = rawNodes.map((n) => ({
      nodeId: n.nodeId,
      type: n.type,
      position: n.position,
      data: n.data,
      fractionalIndex: n.fractionalIndex,
    }));

    const edges = rawEdges.map((e) => ({
      edgeId: e.edgeId,
      source: e.source,
      target: e.target,
      type: e.type,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: e.data,
      fractionalIndex: e.fractionalIndex,
      rulesVersion: e.rulesVersion,
    }));

    const endpoints = rawEndpoints.map((ep) => ({
      nodeId: ep.nodeId,
      endpointId: ep.endpointId,
      data: ep.data,
    }));

    const events = rawEvents.map((ev) => ({
      nodeId: ev.nodeId,
      eventId: ev.eventId,
      variant: ev.variant,
      data: ev.data,
    }));

    const identityProviders = rawIdentityProviders.map((idp) => ({
      nodeId: idp.nodeId,
      providerId: idp.providerId,
      data: idp.data,
    }));

    const testCases = rawTestCases.map((tc) => ({
      testCaseId: tc.testCaseId,
      data: tc.data,
    }));

    // Snapshot is stored as a JSON string — no need to force-type the intermediate
    // object with VersionSnapshot (Convex doc types are slightly looser than the
    // strict canvas types). parseSnapshot() applies VersionSnapshot on the way back.
    const snapshot = {
      nodes,
      edges,
      endpoints,
      events,
      identityProviders,
      testCases,
    };

    // Find previous version to calculate changeSummary
    const latestVersion = await ctx.db
      .query("project_versions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .first();

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    let changeSummary: VersionChangeSummary = {
      nodesAdded: nodes.length,
      nodesModified: 0,
      nodesDeleted: 0,
      edgesAdded: edges.length,
      edgesDeleted: 0,
    };

    if (latestVersion) {
      const prevSnapshot = parseSnapshot(latestVersion.snapshotJson);
      const prevNodesMap = new Map(
        prevSnapshot.nodes.map((n) => [n.nodeId, n]),
      );
      const currentNodesMap = new Map(nodes.map((n) => [n.nodeId, n]));

      let addedNodesCount = 0;
      let modifiedNodesCount = 0;
      let deletedNodesCount = 0;

      for (const [nodeId, currNode] of currentNodesMap) {
        const prevNode = prevNodesMap.get(nodeId);
        if (!prevNode) {
          addedNodesCount++;
        } else {
          // Compare position or data serialization
          const isPosChanged =
            prevNode.position.x !== currNode.position.x ||
            prevNode.position.y !== currNode.position.y;
          const isDataChanged =
            JSON.stringify(prevNode.data) !== JSON.stringify(currNode.data);
          if (isPosChanged || isDataChanged) {
            modifiedNodesCount++;
          }
        }
      }

      for (const [nodeId] of prevNodesMap) {
        if (!currentNodesMap.has(nodeId)) {
          deletedNodesCount++;
        }
      }

      const prevEdgesMap = new Map(
        prevSnapshot.edges.map((e) => [e.edgeId, e]),
      );
      const currentEdgesMap = new Map(edges.map((e) => [e.edgeId, e]));

      let addedEdgesCount = 0;
      let deletedEdgesCount = 0;

      for (const [edgeId] of currentEdgesMap) {
        if (!prevEdgesMap.has(edgeId)) {
          addedEdgesCount++;
        }
      }

      for (const [edgeId] of prevEdgesMap) {
        if (!currentEdgesMap.has(edgeId)) {
          deletedEdgesCount++;
        }
      }

      changeSummary = {
        nodesAdded: addedNodesCount,
        nodesModified: modifiedNodesCount,
        nodesDeleted: deletedNodesCount,
        edgesAdded: addedEdgesCount,
        edgesDeleted: deletedEdgesCount,
      };
    }

    return await ctx.db.insert("project_versions", {
      projectId: args.projectId,
      versionNumber: nextVersionNumber,
      title: args.title,
      description: args.description,
      authorId,
      authorName,
      authorAvatar,
      snapshotJson: JSON.stringify(snapshot),
      changeSummary,
      isAutoSave: args.isAutoSave ?? false,
      createdAt: Date.now(),
    });
  },
});

export const restoreProjectVersion = mutation({
  args: {
    projectId: v.id("projects"),
    versionId: v.id("project_versions"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ restoredVersionNumber: number; newVersionId: Id<"project_versions"> }> => {
    const versionToRestore = await ctx.db.get(args.versionId);
    if (!versionToRestore || versionToRestore.projectId !== args.projectId) {
      throw new Error("Version not found or does not belong to project.");
    }

    const identity = await ctx.auth.getUserIdentity();
    const authorId = identity?.subject ?? "anonymous";
    const authorName =
      identity?.name ?? identity?.nickname ?? identity?.email ?? "Collaborator";
    const authorAvatar = identity?.pictureUrl;

    // 1. Delete all current elements for this project
    const currentNodes = await ctx.db
      .query("canvas_backend_nodes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const n of currentNodes) {
      await ctx.db.delete(n._id);
    }

    const currentEdges = await ctx.db
      .query("canvas_backend_edges")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const e of currentEdges) {
      await ctx.db.delete(e._id);
    }

    const currentEndpoints = await ctx.db
      .query("canvas_backend_endpoints")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const ep of currentEndpoints) {
      await ctx.db.delete(ep._id);
    }

    const currentEvents = await ctx.db
      .query("canvas_backend_events")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const ev of currentEvents) {
      await ctx.db.delete(ev._id);
    }

    const currentIdentityProviders = await ctx.db
      .query("canvas_backend_identity_providers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const idp of currentIdentityProviders) {
      await ctx.db.delete(idp._id);
    }

    const currentTestCases = await ctx.db
      .query("canvas_backend_test_cases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const tc of currentTestCases) {
      await ctx.db.delete(tc._id);
    }

    // 2. Insert restored elements
    const snapshot = parseSnapshot(versionToRestore.snapshotJson);

    for (const node of snapshot.nodes) {
      await ctx.db.insert("canvas_backend_nodes", {
        projectId: args.projectId,
        nodeId: node.nodeId,
        type: node.type,
        position: node.position,
        data: node.data,
        fractionalIndex: node.fractionalIndex,
      });
    }

    for (const edge of snapshot.edges) {
      await ctx.db.insert("canvas_backend_edges", {
        projectId: args.projectId,
        edgeId: edge.edgeId,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        data: edge.data,
        fractionalIndex: edge.fractionalIndex,
        rulesVersion: edge.rulesVersion,
      });
    }

    for (const ep of snapshot.endpoints) {
      await ctx.db.insert("canvas_backend_endpoints", {
        projectId: args.projectId,
        nodeId: ep.nodeId,
        endpointId: ep.endpointId,
        data: ep.data,
      });
    }

    for (const ev of snapshot.events) {
      await ctx.db.insert("canvas_backend_events", {
        projectId: args.projectId,
        nodeId: ev.nodeId,
        eventId: ev.eventId,
        variant: ev.variant,
        data: ev.data,
      });
    }

    for (const idp of snapshot.identityProviders) {
      await ctx.db.insert("canvas_backend_identity_providers", {
        projectId: args.projectId,
        nodeId: idp.nodeId,
        providerId: idp.providerId,
        data: idp.data,
      });
    }

    for (const tc of snapshot.testCases) {
      await ctx.db.insert("canvas_backend_test_cases", {
        projectId: args.projectId,
        testCaseId: tc.testCaseId,
        data: tc.data,
      });
    }

    // 3. Create a safe rollback audit commit
    const latestVersion = await ctx.db
      .query("project_versions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .first();

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const newVersionId = await ctx.db.insert("project_versions", {
      projectId: args.projectId,
      versionNumber: nextVersionNumber,
      title: `Rollback to v${versionToRestore.versionNumber}: ${versionToRestore.title}`,
      description: `Restored canvas elements to checkpoint #${versionToRestore.versionNumber}`,
      authorId,
      authorName,
      authorAvatar,
      snapshotJson: JSON.stringify(snapshot),
      changeSummary: {
        nodesAdded: snapshot.nodes.length,
        nodesModified: 0,
        nodesDeleted: currentNodes.length,
        edgesAdded: snapshot.edges.length,
        edgesDeleted: currentEdges.length,
      },
      isAutoSave: false,
      createdAt: Date.now(),
    });

    return {
      restoredVersionNumber: versionToRestore.versionNumber,
      newVersionId,
    };
  },
});
