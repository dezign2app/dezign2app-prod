import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, CompiledFile } from "@workspace/canvas/types";
import {
  handleColumnDeletion,
  handleIndexDeletion,
  handleSectionDeletion,
  handleActionDeletion,
  handleZoneDeletion,
  handleEndpointDeletion,
  handlePageRename,
  handleCustomDeletion,
  computeFileDiffs,
} from "../subitem-handlers";

describe("Sub-Item Deletion Handlers", () => {
  const tableNode: BackendNode = {
    id: "table-users",
    type: "entity",
    fractionalIndex: "a0",
    position: { x: 0, y: 0 },
    data: {
      label: "users",
      columns: [
        { name: "id", type: "uuid", isPrimaryKey: true },
        { name: "email", type: "string" },
        { name: "orgId", type: "uuid" },
      ],
      indexes: [
        { name: "users_email_idx", isUnique: true, columns: "email" },
      ],
      dbOperations: [
        {
          id: "op-1",
          name: "findByEmail",
          kind: "custom",
          query: "SELECT * FROM users WHERE email = :email",
          params: [{ name: "email", type: "string" }],
        },
        {
          id: "op-2",
          name: "fetchByusers_email_idx",
          kind: "fetchByIndex",
        },
      ],
    },
  };

  const otherTableNode: BackendNode = {
    id: "table-posts",
    type: "entity",
    fractionalIndex: "a1",
    position: { x: 200, y: 0 },
    data: {
      label: "posts",
      columns: [
        { name: "id", type: "uuid" },
        {
          name: "authorEmail",
          type: "string",
          references: { table: "users", column: "email" },
        },
      ],
    },
  };

  const pageNode: BackendNode = {
    id: "page-home",
    type: "webPage",
    fractionalIndex: "a2",
    position: { x: 400, y: 0 },
    data: {
      label: "/home",
      sections: [
        {
          id: "sec-hero",
          name: "HeroSection",
          actions: [
            {
              id: "act-submit",
              name: "SubmitButton",
              event: "click",
            },
          ],
        },
      ],
    },
  };

  const pageRefNode: BackendNode = {
    id: "page-ref-1",
    type: "page_ref",
    fractionalIndex: "a3",
    position: { x: 600, y: 0 },
    data: {
      label: "Home Page (Ref)",
    },
  };

  const webAppNode: BackendNode = {
    id: "webapp-1",
    type: "webApp",
    fractionalIndex: "a4",
    position: { x: 800, y: 0 },
    data: {
      label: "Portal",
      zones: [
        {
          id: "zone-admin",
          name: "AdminZone",
          handleId: "admin-in",
          accessType: "protected",
          rule: {
            id: "rule-admin",
            scope: "zone",
            accessType: "protected",
            conditions: {
              kind: "leaf",
              condition: { type: "orgRole", op: "in", values: ["admin"] },
            },
            redirects: { default: "/login" },
          },
        },
        {
          id: "zone-public",
          name: "PublicZone",
          handleId: "public-in",
          accessType: "public",
          rule: {
            id: "rule-public",
            scope: "zone",
            accessType: "public",
            conditions: {
              kind: "leaf",
              condition: { type: "orgRole", op: "in", values: [] },
            },
            redirects: { default: "/login" },
          },
        },
      ],
    },
  };

  it("handleColumnDeletion removes column, severs edges, and detects DB cascade and FK references", () => {
    const edge: BackendEdge = {
      id: "edge-col",
      type: "connection",
      fractionalIndex: "a0",
      source: "table-users",
      sourceHandle: "email",
      target: "table-posts",
      targetHandle: "authorEmail",
    };

    const endpoint: Endpoint & { nodeId: string } = {
      id: "ep-1",
      nodeId: "service-1",
      name: "getUserByEmail",
      type: "GET",
      pipelineSteps: [
        {
          id: "step-1",
          name: "queryUser",
          type: "db_operation",
          tableNodeId: "table-users",
          inputBindings: [
            {
              argName: "email",
              source: { kind: "req_params", field: "email" },
            },
          ],
        },
      ],
    };

    const ctx = {
      nodes: [tableNode, otherTableNode],
      endpoints: [endpoint],
      events: [],
      edges: [edge],
    };

    const res = handleColumnDeletion(ctx, {
      type: "column",
      nodeId: "table-users",
      column: { name: "email" },
      onConfirm: () => {},
    });

    // Verify column removed from nextNodes
    const nextTable = res.nextNodes.find((n) => n.id === "table-users");
    const nextColumns = nextTable?.data?.columns || [];
    expect(nextColumns.some((c) => c.name === "email")).toBe(false);
    expect(nextColumns.length).toBe(2);

    // Verify severed connection
    expect(res.severedConnections.length).toBe(1);
    expect(res.severedConnections[0]?.edgeId).toBe("edge-col");

    // Verify DB function cascade
    expect(res.cascadeElements.some((c) => c.label.includes("findByEmail"))).toBe(true);

    // Verify broken foreign key reference
    expect(res.brokenReferences.some((b) => b.referenceType === "Foreign Key")).toBe(true);

    // Verify broken endpoint pipeline step reference
    expect(res.brokenReferences.some((b) => b.referenceType === "Pipeline Step")).toBe(true);
  });

  it("handleIndexDeletion removes index and cascades fetchByIndex functions", () => {
    const ctx = {
      nodes: [tableNode],
      endpoints: [],
      events: [],
      edges: [],
    };

    const res = handleIndexDeletion(ctx, {
      type: "index",
      nodeId: "table-users",
      indexItem: { name: "users_email_idx" },
      onConfirm: () => {},
    });

    const nextTable = res.nextNodes.find((n) => n.id === "table-users");
    const nextIndexes = nextTable?.data?.indexes || [];
    expect(nextIndexes.length).toBe(0);
    expect(res.cascadeElements.some((c) => c.type === "fetchByIndex")).toBe(true);
  });

  it("handleSectionDeletion removes section from page", () => {
    const ctx = {
      nodes: [pageNode],
      endpoints: [],
      events: [],
      edges: [],
    };

    const res = handleSectionDeletion(ctx, {
      type: "section",
      nodeId: "page-home",
      section: { id: "sec-hero" },
      onConfirm: () => {},
    });

    const nextPage = res.nextNodes.find((n) => n.id === "page-home");
    const nextSections = nextPage?.data?.sections || [];
    expect(nextSections.length).toBe(0);
  });

  it("handleActionDeletion removes action and cascades orphaned page_ref nodes", () => {
    const edge: BackendEdge = {
      id: "edge-act",
      type: "connection",
      fractionalIndex: "a0",
      source: "page-home",
      sourceHandle: "events-act-submit",
      target: "page-ref-1",
    };

    const ctx = {
      nodes: [pageNode, pageRefNode],
      endpoints: [],
      events: [],
      edges: [edge],
    };

    const res = handleActionDeletion(ctx, {
      type: "action",
      nodeId: "page-home",
      action: { id: "act-submit", name: "SubmitButton" },
      onConfirm: () => {},
    });

    // Action removed from section
    const nextPage = res.nextNodes.find((n) => n.id === "page-home");
    const nextSections = nextPage?.data?.sections || [];
    expect(nextSections[0]?.actions.length).toBe(0);

    // Severed connection identified
    expect(res.severedConnections.length).toBe(1);

    // Orphaned page_ref cascaded and removed from nextNodes
    expect(res.cascadeElements.some((c) => c.id === "page-ref-1")).toBe(true);
    expect(res.nextNodes.some((n) => n.id === "page-ref-1")).toBe(false);
  });

  it("handleZoneDeletion removes zone from webApp", () => {
    const ctx = {
      nodes: [webAppNode],
      endpoints: [],
      events: [],
      edges: [],
    };

    const res = handleZoneDeletion(ctx, {
      type: "zone",
      nodeId: "webapp-1",
      zone: { id: "zone-admin" },
      onConfirm: () => {},
    });

    const nextApp = res.nextNodes.find((n) => n.id === "webapp-1");
    const nextZones = nextApp?.data?.zones || [];
    expect(nextZones.length).toBe(1);
    expect(nextZones[0]?.id).toBe("zone-public");
  });

  it("handleEndpointDeletion removes endpoint from endpoints list", () => {
    const ep1: Endpoint & { nodeId: string } = {
      id: "ep-1",
      nodeId: "service-1",
      name: "getUsers",
      type: "GET",
    };
    const ep2: Endpoint & { nodeId: string } = {
      id: "ep-2",
      nodeId: "service-1",
      name: "createUsers",
      type: "POST",
    };

    const ctx = {
      nodes: [],
      endpoints: [ep1, ep2],
      events: [],
      edges: [],
    };

    const res = handleEndpointDeletion(ctx, {
      type: "endpoint",
      nodeId: "service-1",
      endpoint: ep1,
      onConfirm: () => {},
    });

    expect(res.nextEndpoints.length).toBe(1);
    expect(res.nextEndpoints[0]?.id).toBe("ep-2");
  });

  it("handlePageRename updates label and cascades page_ref", () => {
    const edge: BackendEdge = {
      id: "edge-ref",
      type: "connection",
      fractionalIndex: "a0",
      source: "page-home",
      target: "page-ref-1",
    };

    const navigatingPage: BackendNode = {
      id: "page-about",
      type: "webPage",
      fractionalIndex: "a5",
      position: { x: 1000, y: 0 },
      data: {
        label: "/about",
        sections: [
          {
            id: "sec-nav",
            name: "NavigationSection",
            actions: [
              {
                id: "act-nav-home",
                name: "GoHome",
                event: "navigateToPage",
                targetPageId: "page-home",
              },
            ],
          },
        ],
      },
    };

    const ctx = {
      nodes: [pageNode, pageRefNode, navigatingPage],
      endpoints: [],
      events: [],
      edges: [edge],
    };

    const res = handlePageRename(ctx, {
      type: "pageRename",
      nodeId: "page-home",
      oldLabel: "/home",
      newLabel: "/landing",
      onConfirm: () => {},
    });

    const nextPage = res.nextNodes.find((n) => n.id === "page-home");
    expect(nextPage?.data?.label).toBe("/landing");

    // Cascaded page_ref description updated
    expect(res.cascadeElements.length).toBe(1);
    expect(res.cascadeElements[0]?.description).toContain('updated to "/landing"');

    // Broken reference tracked for other page's navigateToPage action
    expect(res.brokenReferences.length).toBe(1);
    expect(res.brokenReferences[0]?.referenceType).toBe("Navigation Target");
  });

  it("handleCustomDeletion produces target node representation", () => {
    const ctx = {
      nodes: [],
      endpoints: [],
      events: [],
      edges: [],
    };

    const res = handleCustomDeletion(ctx, {
      type: "custom",
      itemLabel: "Custom Item",
      itemType: "custom_type",
      onConfirm: () => {},
    });

    expect(res.targetNodes[0]?.label).toBe("Custom Item");
    expect(res.targetNodes[0]?.type).toBe("custom_type");
  });

  it("computeFileDiffs computes added, modified, and deleted files accurately", () => {
    const before: CompiledFile[] = [
      {
        filename: "apps/web/page.tsx",
        content: "export default function Page() { return 1; }",
        language: "typescript",
      },
      {
        filename: "apps/web/deleted.tsx",
        content: "deleted",
        language: "typescript",
      },
    ];
    const after: CompiledFile[] = [
      {
        filename: "apps/web/page.tsx",
        content: "export default function Page() { return 2; }",
        language: "typescript",
      },
      {
        filename: "apps/web/added.tsx",
        content: "added",
        language: "typescript",
      },
    ];

    const diff = computeFileDiffs(before, after, [
      { id: "page-1", label: "Page", type: "webPage" },
    ]);

    expect(diff.modifiedFiles).toEqual(["apps/web/page.tsx"]);
    expect(diff.deletedFiles).toEqual(["apps/web/deleted.tsx"]);
    expect(diff.addedFiles).toEqual(["apps/web/added.tsx"]);
    expect(diff.totalAffectedCount).toBe(3);
  });
});
