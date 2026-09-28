import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackendNode, Endpoint } from "@workspace/canvas/types";
import {
  createEnvExtraSource,
  getAvailableSources,
} from "../sourcePaths";
import { BindingSourceEditor } from "../BindingSourceEditor";
import { StepBinding } from "../types";
import { resolveSource } from "@/lib/compiler/generators/routeGenerator/pipeline/sourceResolver";
import { PipelineRenderContext } from "@/lib/compiler/generators/routeGenerator/pipeline/types";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="mock-select" data-value={value} onClick={() => onValueChange?.("env")}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: any) => (
    <button role="combobox" className={className}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder, children }: any) => (
    <span>{children || placeholder}</span>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="mock-select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectSeparator: () => <hr />,
}));

vi.mock("@workspace/ui/components/combobox", () => ({
  Combobox: ({ children, items }: any) => (
    <div data-testid="mock-combobox" data-items={JSON.stringify(items)}>
      {children}
    </div>
  ),
  ComboboxInput: (props: any) => <input data-testid="combobox-input" {...props} />,
  ComboboxContent: ({ children }: any) => <div data-testid="combobox-content">{children}</div>,
  ComboboxList: ({ children }: any) => (
    <div data-testid="combobox-list">
      {typeof children === "function" ? children("STRIPE_SECRET_KEY") : children}
    </div>
  ),
  ComboboxItem: ({ children, value }: any) => (
    <div data-testid="combobox-item" data-value={value}>
      {children}
    </div>
  ),
  ComboboxEmpty: ({ children }: any) => <div data-testid="combobox-empty">{children}</div>,
}));

describe("pipeline-step-editor: .env field/schema mapping", () => {
  const mockServiceNode: BackendNode = {
    id: "service-payments",
    type: "service",
    position: { x: 0, y: 0 },
    fractionalIndex: "a0",
    data: {
      label: "Payments Service",
      envVars: [
        { id: "e1", name: "STRIPE_SECRET_KEY", description: "Stripe Secret Key" },
        { id: "e2", name: "WEBHOOK_SIGNING_SECRET", description: "Webhook Secret" },
      ],
    },
  };

  const mockEndpoint: Endpoint = {
    id: "ep-1",
    name: "Create Charge",
    type: "POST",
    pathParams: [],
    queryParams: [],
    requestBody: {
      id: "rb-1",
      fields: [{ id: "f1", name: "amount", type: "number", required: true }],
    },
  };

  it("createEnvExtraSource strictly extracts envVars configured on the target node without hardcoding", () => {
    const envSource = createEnvExtraSource([mockServiceNode], "service-payments");

    expect(envSource.id).toBe("env");
    expect(envSource.kind).toBe("env");
    expect(envSource.label).toBe("Environment (.env)");
    expect(envSource.rootVariableName).toBe("process.env");

    const paths = envSource.paths.map((p) => p.path);
    expect(paths).toContain("STRIPE_SECRET_KEY");
    expect(paths).toContain("WEBHOOK_SIGNING_SECRET");
    expect(paths).not.toContain("NODE_ENV");
    expect(paths).not.toContain("PORT");
    expect(paths).not.toContain("AWS_ACCESS_KEY_ID");
  });

  it("createEnvExtraSource returns empty paths if the target node has no envVars configured", () => {
    const emptyNode: BackendNode = {
      id: "service-empty",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Empty Service",
        envVars: [],
      },
    };

    const envSource = createEnvExtraSource([emptyNode], "service-empty");
    expect(envSource.paths).toHaveLength(0);
  });

  it("getAvailableSources includes .env source with the node's configured envVars", () => {
    const sources = getAvailableSources(
      mockEndpoint,
      [],
      [mockServiceNode],
      undefined,
      [],
      "service-payments",
    );

    const envSource = sources.find((s) => s.id === "env" || s.kind === "env");
    expect(envSource).toBeDefined();
    expect(envSource?.paths.map((p) => p.path)).toEqual([
      "STRIPE_SECRET_KEY",
      "WEBHOOK_SIGNING_SECRET",
    ]);
  });

  it("renders EnvVarCombobox when source.kind is env", () => {
    useBackendCanvasStore.setState({ nodes: [mockServiceNode] as any });

    const binding: StepBinding = {
      argName: "apiKey",
      source: { kind: "env", field: "STRIPE_SECRET_KEY" },
    };

    const envSource = createEnvExtraSource([mockServiceNode], "service-payments");

    render(
      <BindingSourceEditor
        binding={binding}
        availableSources={[envSource]}
        serviceNodeId="service-payments"
        onChange={vi.fn()}
      />,
    );

    const comboboxEl = screen.getByTestId("mock-combobox");
    const items = JSON.parse(comboboxEl.getAttribute("data-items") || "[]");
    expect(items).toContain("STRIPE_SECRET_KEY");
    expect(items).toContain("WEBHOOK_SIGNING_SECRET");
  });

  it("resolveSource compiles env kind to process.env.<FIELD>", () => {
    const ctx: PipelineRenderContext = {
      bodyVar: "body",
      priorOutputs: new Map(),
    };

    expect(
      resolveSource({ kind: "env", field: "STRIPE_SECRET_KEY" }, ctx),
    ).toBe("process.env.STRIPE_SECRET_KEY");

    expect(
      resolveSource({ kind: "env", field: "CUSTOM_VAR_123" }, ctx),
    ).toBe("process.env.CUSTOM_VAR_123");
  });
});
