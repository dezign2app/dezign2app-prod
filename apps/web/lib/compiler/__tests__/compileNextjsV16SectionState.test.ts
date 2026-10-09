import { describe, it, expect } from "vitest";
import { BackendNode } from "@/types/canvas";
import { compileNextjsV16WebClient } from "../webClients/nextjs/v16";

describe("compileNextjsV16SectionState", () => {
  it("generates typed useState hooks in client section components when section.states are present", () => {
    const webPageNode: BackendNode = {
      id: "node-page-stateful",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/products",
        appSlug: "product-store",
        sections: [
          {
            id: "sec-filters",
            name: "Filter Section",
            renderMode: "client",
            loadStrategy: "eager",
            actions: [],
            states: [
              {
                id: "st-search",
                name: "searchQuery",
                type: "string",
                defaultValue: "shoes",
              },
              {
                id: "st-page",
                name: "pageNumber",
                type: "number",
                defaultValue: 1,
              },
              {
                id: "st-in-stock",
                name: "inStockOnly",
                type: "boolean",
                defaultValue: true,
              },
              {
                id: "st-tags",
                name: "selectedTags",
                type: "array",
                defaultValue: ["running", "sport"],
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const filterSectionFile = result.files.find((f) =>
      f.filename.includes("FilterSection.tsx"),
    );

    expect(filterSectionFile).toBeDefined();
    const code = filterSectionFile!.content;

    // Must be a client component
    expect(code).toContain('"use client";');
    // Must import useState from react
    expect(code).toMatch(/import React,\s*{\s*useState\s*}\s*from\s*"react";/);
    // Must declare useState for each defined state variable
    expect(code).toContain('const [searchQuery, setSearchQuery] = useState<string>("shoes");');
    expect(code).toContain("const [pageNumber, setPageNumber] = useState<number>(1);");
    expect(code).toContain("const [inStockOnly, setInStockOnly] = useState<boolean>(true);");
    expect(code).toContain('const [selectedTags, setSelectedTags] = useState<unknown[]>(["running","sport"]);');
  });

  it("automatically forces client component mode when section defines states even if renderMode is server", () => {
    const webPageNode: BackendNode = {
      id: "node-page-auto-client",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/dashboard",
        appSlug: "dash-app",
        sections: [
          {
            id: "sec-metric",
            name: "Metric Section",
            renderMode: "server", // declared server, but has local states
            loadStrategy: "eager",
            actions: [],
            states: [
              {
                id: "st-expanded",
                name: "isExpanded",
                type: "boolean",
                defaultValue: false,
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const metricSectionFile = result.files.find((f) =>
      f.filename.includes("MetricSection.tsx"),
    );

    expect(metricSectionFile).toBeDefined();
    const code = metricSectionFile!.content;

    // Must promote to "use client" because useState is required
    expect(code).toContain('"use client";');
    expect(code).toContain("const [isExpanded, setIsExpanded] = useState<boolean>(false);");
  });

  it("imports and calls Zustand store hook when a section action has storeActionBinding", () => {
    const webPageNode: BackendNode = {
      id: "node-page-checkout",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/checkout",
        appSlug: "shop-app",
        sections: [
          {
            id: "sec-cart-summary",
            name: "Cart Summary",
            renderMode: "server",
            actions: [
              {
                id: "act-clear-cart",
                name: "Clear Cart",
                event: "click",
                storeActionBinding: {
                  storeName: "Cart",
                  actionName: "reset",
                  actionType: "custom",
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const cartSummaryFile = result.files.find((f) =>
      f.filename.includes("CartSummarySection.tsx"),
    );

    expect(cartSummaryFile).toBeDefined();
    const code = cartSummaryFile!.content;

    expect(code).toContain('"use client";');
    expect(code).toContain('import { useCartStore } from "@/lib/stores";');
    expect(code).toContain("const cartStore = useCartStore();");
  });

  it("imports and binds Zustand store fields when section.stateObjects are configured", () => {
    const webPageNode: BackendNode = {
      id: "node-page-catalog",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/catalog",
        appSlug: "shop-app",
        sections: [
          {
            id: "sec-cart-display",
            name: "Cart Widget",
            renderMode: "server",
            actions: [],
            stateObjects: [
              {
                id: "st-items",
                name: "items",
                type: "array",
                storeName: "Cart",
                defaultValue: [],
              },
              {
                id: "st-total",
                name: "totalPrice",
                type: "number",
                storeName: "Cart",
                defaultValue: 0,
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const cartWidgetFile = result.files.find((f) =>
      f.filename.includes("CartWidgetSection.tsx"),
    );

    expect(cartWidgetFile).toBeDefined();
    const code = cartWidgetFile!.content;

    // Forces client component because of Zustand store subscription
    expect(code).toContain('"use client";');
    // Store hook import
    expect(code).toContain('import { useCartStore } from "@/lib/stores";');
    // Specific field selectors
    expect(code).toContain("const items = useCartStore((s) => s.items);");
    expect(code).toContain("const totalPrice = useCartStore((s) => s.totalPrice);");
    // State rendered in CardContent
    expect(code).toContain("<CardContent>");
    expect(code).toContain("items:");
    expect(code).toContain("totalPrice:");
  });

  it("respects renderConfig.enabled = false by hiding state from UI while keeping store subscription", () => {
    const webPageNode: BackendNode = {
      id: "node-page-hidden-state",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/dashboard",
        appSlug: "shop-app",
        sections: [
          {
            id: "sec-metrics",
            name: "Metrics",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-secret",
                name: "internalToken",
                type: "string",
                storeName: "Auth",
                renderConfig: {
                  enabled: false,
                },
              },
              {
                id: "st-public",
                name: "activeUsers",
                type: "number",
                storeName: "Analytics",
                renderConfig: {
                  enabled: true,
                  component: "badge",
                  label: "Online Users",
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const metricsFile = result.files.find((f) =>
      f.filename.includes("MetricsSection.tsx"),
    );

    expect(metricsFile).toBeDefined();
    const code = metricsFile!.content;

    // Subscribed in code
    expect(code).toContain("const internalToken = useAuthStore((s) => s.internalToken);");
    expect(code).toContain("const activeUsers = useAnalyticsStore((s) => s.activeUsers);");

    // But internalToken is NOT in JSX
    expect(code).not.toContain("internalToken:");
    // activeUsers is rendered with Badge
    expect(code).toContain("<Badge");
    expect(code).toContain("Online Users:");
  });

  it("renders configured shadcn Switch and copy_to_clipboard click action with sonner toast", () => {
    const webPageNode: BackendNode = {
      id: "node-page-interactive",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/settings",
        appSlug: "shop-app",
        sections: [
          {
            id: "sec-toggles",
            name: "Settings Controls",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-dark",
                name: "darkMode",
                type: "boolean",
                storeName: "Theme",
                renderConfig: {
                  enabled: true,
                  component: "switch",
                  label: "Dark Mode Enabled",
                },
              },
              {
                id: "st-apikey",
                name: "apiKey",
                type: "string",
                storeName: "Api",
                renderConfig: {
                  enabled: true,
                  component: "badge",
                  clickAction: "copy_to_clipboard",
                  copyToastMessage: "API Key copied!",
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const controlsFile = result.files.find((f) =>
      f.filename.includes("SettingsControlsSection.tsx"),
    );

    expect(controlsFile).toBeDefined();
    const code = controlsFile!.content;

    expect(code).toContain('import { Switch } from "@workspace/ui/components/switch";');
    expect(code).toContain('import { Badge } from "@workspace/ui/components/badge";');
    expect(code).toContain('import { toast } from "sonner";');
    expect(code).toContain("<Switch checked={Boolean(darkMode)} />");
    expect(code).toContain('toast.success("API Key copied!")');
  });

  it("correctly compiles component prop mappings for input, button, progress, and avatar", () => {
    const webPageNode: BackendNode = {
      id: "node-page-form",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/profile",
        appSlug: "test-app",
        sections: [
          {
            id: "sec-profile-form",
            name: "Profile Form Section",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-user-email",
                name: "userEmail",
                type: "string",
                defaultValue: "test@example.com",
                renderConfig: {
                  enabled: true,
                  component: "input",
                  propMappings: {
                    inputType: "email",
                    placeholder: "Enter user email...",
                    readOnly: true,
                    disabled: false,
                    valueBinding: "userEmail",
                  },
                },
              },
              {
                id: "st-submit-btn",
                name: "isSubmitting",
                type: "boolean",
                renderConfig: {
                  enabled: true,
                  component: "button",
                  propMappings: {
                    buttonSize: "lg",
                    disabled: true,
                  },
                },
              },
              {
                id: "st-avatar-pic",
                name: "avatarUrl",
                type: "string",
                defaultValue: "https://example.com/pic.jpg",
                renderConfig: {
                  enabled: true,
                  component: "avatar",
                  propMappings: {
                    avatarSrc: "https://example.com/pic.jpg",
                    avatarFallback: "JD",
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const formFile = result.files.find((f) =>
      f.filename.includes("ProfileFormSection.tsx"),
    );

    expect(formFile).toBeDefined();
    const code = formFile!.content;

    expect(code).toContain('import { Input } from "@workspace/ui/components/input";');
    expect(code).toContain('import { Button } from "@workspace/ui/components/button";');
    expect(code).toContain('import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";');
    expect(code).toContain(
      '<Input key="st-user-email" type="email" value={userEmail} placeholder="Enter user email..." readOnly className="h-8 text-xs max-w-xs" />',
    );
    expect(code).toContain('size="lg" disabled');
    expect(code).toContain('<AvatarImage src="https://example.com/pic.jpg" alt="avatarUrl" />');
    expect(code).toContain('<AvatarFallback>JD</AvatarFallback>');
  });
});

