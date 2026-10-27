import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode, CustomTypeItem, CustomTypeField } from "@/types/canvas";
import { Endpoint, isValidConnection } from "@workspace/canvas";

describe("Service Endpoint Types Synchronization Engine", () => {
  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-service-endpoint-sync-test");
  });

  it("automatically creates a companion TypesNode with strictly typed endpoints when a ServiceNode is added", () => {
    const store = useBackendCanvasStore.getState();
    const serviceId = "srv-orders-test";

    // 1. Add ServiceNode
    store.addNode({
      id: serviceId,
      type: "service",
      position: { x: 100, y: 100 },
      data: {
        label: "Orders Service",
      },
    });

    const state = useBackendCanvasStore.getState();
    const companionTypesNode = state.nodes.find(
      (n: BackendNode) =>
        n.type === "types" &&
        (n.id === `types-service-${serviceId}` ||
          Boolean(n.data?.isServiceEndpointSchemas)),
    );

    expect(companionTypesNode).toBeDefined();
    if (!companionTypesNode) return;

    expect(companionTypesNode.data?.label).toBe("Orders Service Types");
    expect(companionTypesNode.data?.isServiceEndpointSchemas).toBe(true);
    expect(companionTypesNode.data?.sourceServiceId).toBe(serviceId);

    // Verify companion edge exists linking TypesNode (source) to ServiceNode (target)
    const companionEdge = state.edges.find(
      (e) => e.source === companionTypesNode.id && e.target === serviceId,
    );
    expect(companionEdge).toBeDefined();
    expect(companionEdge?.sourceHandle).toBe("types-out");
    expect(companionEdge?.targetHandle).toBe("types-in");
    expect(companionEdge?.type).toBe("type-reference");

    // The default health check endpoint types should be generated
    const types: CustomTypeItem[] = companionTypesNode.data?.types || [];
    expect(types.length).toBeGreaterThan(0);

    const healthResponse = types.find(
      (t) => t.name.includes("Health") && t.name.endsWith("Response"),
    );
    expect(healthResponse).toBeDefined();
    expect(healthResponse?.fields?.some((f) => f.name === "status" && f.type === "string")).toBe(true);
    expect(healthResponse?.fields?.some((f) => f.name === "timestamp" && f.type === "string")).toBe(true);

    // Verify strictly NO 'any' or 'unknown' types exist anywhere in the generated types
    types.forEach((t: CustomTypeItem) => {
      (t.fields || []).forEach((f: CustomTypeField) => {
        expect(f.type).not.toBe("any");
        expect(f.type).not.toBe("unknown");
        expect(f.type).not.toContain("any");
        expect(f.type).not.toContain("unknown");
      });
    });
  });

  it("updates the companion TypesNode when new endpoints with responseFields are added or modified", () => {
    const store = useBackendCanvasStore.getState();
    const serviceId = "srv-catalog-test";

    store.addNode({
      id: serviceId,
      type: "service",
      position: { x: 100, y: 100 },
      data: {
        label: "Catalog Service",
      },
    });

    const epId = "ep-get-products";
    const newEndpoint: Endpoint = {
      id: epId,
      name: "/api/products",
      type: "GET",
      responseFields: [
        { id: "rf-1", name: "productId", type: "string", required: false},
        { id: "rf-2", name: "price", type: "number", required:true },
        { id: "rf-3", name: "inStock", type: "boolean", required:false },
      ],
    };

    store.addEndpoint(serviceId, newEndpoint);

    const state = useBackendCanvasStore.getState();
    const companionNode = state.nodes.find(
      (n: BackendNode) => n.id === `types-service-${serviceId}`,
    );

    expect(companionNode).toBeDefined();
    const types: CustomTypeItem[] = companionNode?.data?.types || [];

    const productsResponse = types.find(
      (t) => t.name.includes("Products") && t.name.endsWith("Response"),
    );
    expect(productsResponse).toBeDefined();
    expect(productsResponse?.fields).toBeDefined();

    const fields = productsResponse?.fields || [];
    expect(fields.find((f) => f.name === "productId")?.type).toBe("string");
    expect(fields.find((f) => f.name === "price")?.type).toBe("number");
    expect(fields.find((f) => f.name === "inStock")?.type).toBe("boolean");

    // Update endpoint response fields
    store.updateEndpoint(epId, {
      responseFields: [
        { id: "rf-1", name: "productId", type: "string", required: false },
        { id: "rf-2", name: "price", type: "number", required: true },
        { id: "rf-3", name: "inStock", type: "boolean", required: false },
        { id: "rf-4", name: "rating", type: "number", required: false },
      ],
    });

    const stateAfterUpdate = useBackendCanvasStore.getState();
    const companionAfterUpdate = stateAfterUpdate.nodes.find(
      (n: BackendNode) => n.id === `types-service-${serviceId}`,
    );
    const updatedTypes: CustomTypeItem[] = companionAfterUpdate?.data?.types || [];
    const updatedResponse = updatedTypes.find(
      (t) => t.name.includes("Products") && t.name.endsWith("Response"),
    );
    expect(updatedResponse?.fields?.some((f) => f.name === "rating" && f.type === "number")).toBe(true);

    // Delete endpoint
    store.deleteEndpoint(epId);
    const stateAfterDelete = useBackendCanvasStore.getState();
    const companionAfterDelete = stateAfterDelete.nodes.find(
      (n: BackendNode) => n.id === `types-service-${serviceId}`,
    );
    const typesAfterDelete: CustomTypeItem[] = companionAfterDelete?.data?.types || [];
    expect(typesAfterDelete.some((t) => t.name.includes("Products") && t.name.endsWith("Response"))).toBe(false);
  });

  it("cascade deletes the companion TypesNode when the ServiceNode is deleted", () => {
    const store = useBackendCanvasStore.getState();
    const serviceId = "srv-payments-test";

    store.addNode({
      id: serviceId,
      type: "service",
      position: { x: 100, y: 100 },
      data: {
        label: "Payments Service",
      },
    });

    const stateBefore = useBackendCanvasStore.getState();
    expect(stateBefore.nodes.some((n: BackendNode) => n.id === `types-service-${serviceId}`)).toBe(true);
    expect(stateBefore.edges.some((e) => e.target === serviceId && e.source === `types-service-${serviceId}`)).toBe(true);

    // Delete service node
    store.deleteNode(serviceId);

    const stateAfter = useBackendCanvasStore.getState();
    expect(stateAfter.nodes.some((n: BackendNode) => n.id === serviceId)).toBe(false);
    expect(stateAfter.nodes.some((n: BackendNode) => n.id === `types-service-${serviceId}`)).toBe(false);
    expect(stateAfter.edges.some((e) => e.target === serviceId || e.source === `types-service-${serviceId}`)).toBe(false);
  });

  it("creates an edge that satisfies canvas and Convex isValidConnection validators", () => {
    const store = useBackendCanvasStore.getState();
    const serviceId = "srv-validation-check";

    store.addNode({
      id: serviceId,
      type: "service",
      position: { x: 500, y: 100 },
      data: {
        label: "Auth Service",
      },
    });

    const state = useBackendCanvasStore.getState();
    const typesNodeId = `types-service-${serviceId}`;
    const edge = state.edges.find((e) => e.target === serviceId && e.source === typesNodeId);
    expect(edge).toBeDefined();
    expect(edge?.sourceHandle).toBe("types-out");
    expect(edge?.targetHandle).toBe("types-in");
    expect(edge?.type).toBe("type-reference");

    const validation = isValidConnection(
      "types",
      edge?.sourceHandle,
      "service",
      edge?.targetHandle,
    );
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      expect(validation.edgeType).toBe("type-reference");
    }
  });

  it("updates the companion TypesNode label when the ServiceNode is renamed", () => {
    const store = useBackendCanvasStore.getState();
    const serviceId = "srv-billing-test";

    store.addNode({
      id: serviceId,
      type: "service",
      position: { x: 100, y: 100 },
      data: {
        label: "Billing Service",
      },
    });

    store.updateNode(serviceId, {
      data: {
        label: "Invoice Service",
      },
    });

    const state = useBackendCanvasStore.getState();
    const companion = state.nodes.find((n: BackendNode) => n.id === `types-service-${serviceId}`);
    expect(companion).toBeDefined();
    expect(companion?.data?.label).toBe("Invoice Service Types");
    expect(companion?.data?.sourceServiceName).toBe("Invoice Service");
  });

  it("manually re-syncs companion TypesNode via syncServiceTypes store action", () => {
    const store = useBackendCanvasStore.getState();
    const serviceId = "srv-manual-sync-test";

    store.addNode({
      id: serviceId,
      type: "service",
      position: { x: 100, y: 100 },
      data: {
        label: "Inventory Service",
      },
    });

    const epId = "ep-inv-1";
    store.addEndpoint(serviceId, {
      id: epId,
      name: "/stock",
      summary: "List Stock",
      type: "GET",
      responseFields: [
        { id: "rf-1", name: "sku", type: "string", required: true },
        { id: "rf-2", name: "quantity", type: "number", required: true },
      ],
    });

    const syncResult = store.syncServiceTypes(serviceId);
    expect(syncResult.success).toBe(true);
    expect(syncResult.nodeLabel).toBe("Inventory Service");
    expect(syncResult.typesCount).toBeGreaterThanOrEqual(1);

    const state = useBackendCanvasStore.getState();
    const companion = state.nodes.find((n: BackendNode) => n.id === `types-service-${serviceId}`);
    expect(companion).toBeDefined();

    const types: CustomTypeItem[] = companion?.data?.types || [];
    const stockResponse = types.find((t) => t.name.includes("Stock") && t.name.endsWith("Response"));
    expect(stockResponse).toBeDefined();
    expect(stockResponse?.fields?.some((f) => f.name === "sku" && f.type === "string")).toBe(true);
    expect(stockResponse?.fields?.some((f) => f.name === "quantity" && f.type === "number")).toBe(true);
  });
});
