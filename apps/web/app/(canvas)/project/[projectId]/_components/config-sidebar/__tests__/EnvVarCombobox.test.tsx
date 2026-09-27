import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnvVarCombobox } from "../EnvVarCombobox";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

// Mock @workspace/ui components
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
      {typeof children === "function" ? children("AWS_ACCESS_KEY_ID") : children}
    </div>
  ),
  ComboboxItem: ({ children, value }: any) => (
    <div data-testid="combobox-item" data-value={value}>
      {children}
    </div>
  ),
  ComboboxEmpty: ({ children }: any) => <div data-testid="combobox-empty">{children}</div>,
}));

describe("EnvVarCombobox", () => {
  beforeEach(() => {
    useBackendCanvasStore.setState({
      nodes: [
        {
          id: "storage-node-1",
          type: "storage",
          position: { x: 0, y: 0 },
          data: {
            label: "Storage",
            storageProvider: "s3",
            envVars: [
              { id: "e1", name: "AWS_ACCESS_KEY_ID" },
              { id: "e2", name: "AWS_SECRET_ACCESS_KEY" },
              { id: "e3", name: "AWS_REGION" },
              { id: "e4", name: "S3_ENDPOINT_URL" },
            ],
            buckets: [
              { id: "bucket-1", name: "media-bucket" },
            ],
          },
        },
        {
          id: "service-node-2",
          type: "service",
          position: { x: 200, y: 0 },
          data: {
            label: "API Service",
            envVars: [
              { id: "s1", name: "PORT" },
              { id: "s2", name: "NODE_ENV" },
              { id: "s3", name: "JWT_SECRET" },
            ],
          },
        },
      ] as any,
    });
  });

  it("shows ONLY the environment variables configured on this node", () => {
    const handleValueChange = vi.fn();
    render(
      <EnvVarCombobox
        value="AWS_ACCESS_KEY_ID"
        onValueChange={handleValueChange}
        nodeId="storage-node-1"
      />
    );

    const comboboxEl = screen.getByTestId("mock-combobox");
    const items = JSON.parse(comboboxEl.getAttribute("data-items") || "[]");

    // Must include the 4 configured env vars
    expect(items).toContain("AWS_ACCESS_KEY_ID");
    expect(items).toContain("AWS_SECRET_ACCESS_KEY");
    expect(items).toContain("AWS_REGION");
    expect(items).toContain("S3_ENDPOINT_URL");
    expect(items).toHaveLength(4);

    // Must NOT contain vars from other nodes on the canvas
    expect(items).not.toContain("PORT");
    expect(items).not.toContain("NODE_ENV");
    expect(items).not.toContain("JWT_SECRET");

    // Must NOT contain unconfigured default suggestions
    expect(items).not.toContain("AWS_SESSION_TOKEN");
    expect(items).not.toContain("AWS_ROLE_ARN");
    expect(items).not.toContain("AWS_DEFAULT_REGION");
  });

  it("resolves the parent node env vars when nodeId is a bucket id", () => {
    const handleValueChange = vi.fn();
    render(
      <EnvVarCombobox
        value="AWS_REGION"
        onValueChange={handleValueChange}
        nodeId="bucket-1"
      />
    );

    const comboboxEl = screen.getByTestId("mock-combobox");
    const items = JSON.parse(comboboxEl.getAttribute("data-items") || "[]");

    expect(items).toEqual([
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      "S3_ENDPOINT_URL",
    ]);
  });
});
