import { describe, it, expect } from "vitest";
import { computeSubItemDeletion } from "@/app/(canvas)/project/[projectId]/_components/node-deletion-dialog/computeSubItemDeletionDiff";
import { BackendNode, BackendEdge } from "@/types/canvas";

describe("computeSubItemDeletion with pageRename target", () => {
  it("correctly identifies old page files for deletion and new route files for addition on page rename", () => {
    const webAppNode: BackendNode = {
      id: "web-app-1",
      fractionalIndex:"a0",
      type: "webApp",
      position: { x: 0, y: 0 },
      data: {
        label: "Portal",
        appSlug: "customer-portal",
        techStack: "nextjs",
        techVersion: "16.x",
        showNav: false,
      },
    };

    const pageNode: BackendNode = {
      id: "page-1",
      type: "webPage",
      fractionalIndex:"a1",
      position: { x: 300, y: 0 },
      data: {
        label: "/dashboard",
        appSlug: "customer-portal",
        sections: [
          {
            id: "sec-1",
            name: "StatsSection",
            renderMode: "server",
            loadStrategy: "eager",
            actions: [],
          },
        ],
      },
    };

    const edge: BackendEdge = {
      id: "edge-1",
      type: "connection",
      fractionalIndex: "a0",
      source: "web-app-1",
      target: "page-1",
    };

    const nodes = [webAppNode, pageNode];
    const edges = [edge];

    const result = computeSubItemDeletion(
      nodes,
      [],
      [],
      edges,
      [],
      "TestProject",
      {
        type: "pageRename",
        nodeId: "page-1",
        oldLabel: "/dashboard",
        newLabel: "/analytics",
        onConfirm: () => {},
      },
    );

    // Old dashboard files should be in deletedFiles
    expect(result.diff.deletedFiles.some((f) => f.includes("dashboard"))).toBe(true);

    // New analytics files should be in addedFiles
    expect(result.diff.addedFiles.some((f) => f.includes("analytics"))).toBe(true);

    // Architecture impact summary
    expect(result.architectureImpact.targetNodes[0]?.label).toContain("/dashboard → /analytics");
  });
});
