import { describe, it, expect } from "vitest";
import { getAvailableSources } from "../utils";
import { isEndpointPipelineUnconfigured } from "@/lib/utils/pipelineValidation";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode, Endpoint } from "@/types/canvas";

describe("External Node Pipeline Integration", () => {
  it("flags external endpoints as unconfigured if output schema is missing", () => {
    const externalNode: BackendNode = {
      id: "ext-1",
      type: "external",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Stripe API",
        baseUrl: "https://api.stripe.com/v1",
      },
    };

    const emptyEndpoint: Endpoint = {
      id: "ep-charge",
      name: "/v1/charges",
      type: "POST",
      responseBody: { id: "res-1", fields: [], rawJson: "" },
    };

    // Output schema is missing -> should return true (unconfigured)
    expect(
      isEndpointPipelineUnconfigured(emptyEndpoint, externalNode.id, [externalNode]),
    ).toBe(true);

    const configuredEndpoint: Endpoint = {
      id: "ep-charge-2",
      name: "/v1/charges",
      type: "POST",
      responseBody: {
        id: "res-2",
        rawJson: JSON.stringify({
          id: "ch_123",
          amount: 2000,
          customer: { email: "test@example.com" },
        }),
      },
    };

    // Output schema defined -> should return false (configured)
    expect(
      isEndpointPipelineUnconfigured(configuredEndpoint, externalNode.id, [externalNode]),
    ).toBe(false);
  });

  it("extracts nested output paths from external node endpoint for downstream pipeline steps", () => {
    const externalNode: BackendNode = {
      id: "ext-stripe",
      type: "external",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Stripe",
        baseUrl: "https://api.stripe.com",
      },
    };

    const externalEndpoint: Endpoint = {
      id: "ep-charge-call",
      name: "/v1/charges",
      type: "POST",
      responseBody: {
        id: "res-charge",
        rawJson: JSON.stringify({
          id: "ch_999",
          amount: 5000,
          billing_details: {
            email: "jane@example.com",
            address: {
              city: "Austin",
              postal_code: "78701",
            },
          },
        }),
      },
    };

    // Register external endpoint in canvas store
    useBackendCanvasStore.setState({
      endpoints: [{ ...externalEndpoint, nodeId: externalNode.id }],
    });

    const stepCallingExternal = {
      id: "step-1",
      name: "createCharge",
      type: "service_call" as const,
      databaseId: externalNode.id,
      tableNodeId: externalEndpoint.id,
      outputVariable: "chargeResult",
    };

    const sources = getAvailableSources(
      undefined,
      [stepCallingExternal],
      [externalNode],
    );

    const stepSource = sources.find((s) => s.stepId === "step-1");
    expect(stepSource).toBeDefined();

    const paths = stepSource?.paths.map((p) => p.path) || [];
    expect(paths).toContain("id");
    expect(paths).toContain("amount");
    expect(paths).toContain("billing_details.email");
    expect(paths).toContain("billing_details.address.city");
    expect(paths).toContain("billing_details.address.postal_code");
  });

  it("flags external endpoints as unconfigured if baseUrl is missing or empty", () => {
    const nodeWithoutBaseUrl: BackendNode = {
      id: "ext-unconfigured-url",
      type: "external",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "OpenAI API",
        baseUrl: "", // Missing base URL
      },
    };

    const endpointWithSchema: Endpoint = {
      id: "ep-completion",
      name: "/v1/chat/completions",
      type: "POST",
      responseBody: {
        id: "res-completion",
        rawJson: JSON.stringify({ choices: [{ message: { content: "hello" } }] }),
      },
    };

    // Even with responseBody defined, missing baseUrl should flag as unconfigured (error)
    expect(
      isEndpointPipelineUnconfigured(endpointWithSchema, nodeWithoutBaseUrl.id, [
        nodeWithoutBaseUrl,
      ]),
    ).toBe(true);

    // Now configure the baseUrl
    const nodeWithBaseUrl: BackendNode = {
      ...nodeWithoutBaseUrl,
      data: {
        ...nodeWithoutBaseUrl.data,
        baseUrl: "https://api.openai.com/v1",
      },
    };

    // Once baseUrl is configured, it is no longer unconfigured
    expect(
      isEndpointPipelineUnconfigured(endpointWithSchema, nodeWithBaseUrl.id, [
        nodeWithBaseUrl,
      ]),
    ).toBe(false);
  });
});
