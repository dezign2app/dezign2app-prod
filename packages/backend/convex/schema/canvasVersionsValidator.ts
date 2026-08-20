import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { VersionChangeSummary } from "@workspace/canvas/types";

export type {
  VersionChangeSummary,
  ChangeSummary,
  VersionNodeSnapshot,
  VersionEdgeSnapshot,
  VersionEndpointSnapshot,
  VersionEventSnapshot,
  VersionIdentityProviderSnapshot,
  VersionTestCaseSnapshot,
  VersionSnapshot,
} from "@workspace/canvas/types";

export interface VersionListItem {
  _id: Id<"project_versions">;
  _creationTime: number;
  projectId: Id<"projects">;
  versionNumber: number;
  title: string;
  description?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  changeSummary: VersionChangeSummary;
  isAutoSave: boolean;
  createdAt: number;
}

export const changeSummaryValidator = v.object({
  nodesAdded: v.number(),
  nodesModified: v.number(),
  nodesDeleted: v.number(),
  edgesAdded: v.number(),
  edgesDeleted: v.number(),
});
