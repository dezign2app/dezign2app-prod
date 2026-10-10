import { describe, it, expect } from "vitest";
import { BackendEdge, BackendNode } from "@/types/canvas";
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

  it("guards stateObjects with showDebugState and NEXT_PUBLIC_ENABLE_DEBUG_STATE to preserve clean layout", () => {
    const webPageNode: BackendNode = {
      id: "node-page-debug-toggle",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/admin",
        appSlug: "admin-app",
        sections: [
          {
            id: "sec-with-actions",
            name: "Orders Section",
            renderMode: "client",
            actions: [
              {
                id: "act-refresh",
                name: "Refresh",
                event: "click",
              },
            ],
            stateObjects: [
              {
                id: "st-order-count",
                name: "orderCount",
                type: "number",
                defaultValue: 42,
              },
            ],
          },
          {
            id: "sec-without-actions",
            name: "Metrics Only Section",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-revenue",
                name: "revenue",
                type: "number",
                defaultValue: 1000,
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);

    // 1. Verify OrdersSection has showDebugState setup, imports useState, and guards the label prefix while always rendering the value
    const ordersSecFile = result.files.find((f) => f.filename.includes("OrdersSection.tsx"));
    expect(ordersSecFile).toBeDefined();
    const ordersCode = ordersSecFile!.content;

    expect(ordersCode).toContain('import React, { useState } from "react";');
    expect(ordersCode).toContain("const showDebugState =");
    expect(ordersCode).toContain("process.env.NEXT_PUBLIC_ENABLE_DEBUG_STATE?.trim().toLowerCase() === \"true\"");
    expect(ordersCode).toContain("process.env.NEXT_PUBLIC_ENABLE_DEBUG_UI?.trim().toLowerCase() === \"true\"");
    expect(ordersCode).toContain('{showDebugState && <span className="text-muted-foreground">orderCount: </span>}');
    expect(ordersCode).toContain('String(orderCount)');
    expect(ordersCode).toContain("<CardContent>");
    expect(ordersCode).toContain("<RefreshAction");

    // 2. Verify MetricsOnlySection renders state values in CardContent and guards variable name prefix
    const metricsSecFile = result.files.find((f) => f.filename.includes("MetricsOnlySection.tsx"));
    expect(metricsSecFile).toBeDefined();
    const metricsCode = metricsSecFile!.content;

    expect(metricsCode).toContain("const showDebugState =");
    expect(metricsCode).toContain('{showDebugState && <span className="text-muted-foreground">revenue: </span>}');
    expect(metricsCode).toContain('String(revenue)');
    expect(metricsCode).toContain("<CardContent>");

    // 3. Verify .env and .env.example contain debug toggles
    const envFile = result.files.find((f) => f.filename === ".env");
    expect(envFile).toBeDefined();
    expect(envFile!.content).toContain("NEXT_PUBLIC_ENABLE_DEBUG_LOGS=false");
    expect(envFile!.content).toContain("NEXT_PUBLIC_ENABLE_DEBUG_STATE=false");

    const envExFile = result.files.find((f) => f.filename === ".env.example");
    expect(envExFile).toBeDefined();
    expect(envExFile!.content).toContain("NEXT_PUBLIC_ENABLE_DEBUG_LOGS=");
    expect(envExFile!.content).toContain("NEXT_PUBLIC_ENABLE_DEBUG_STATE=");
  });

  it("guards Output Log with showDebugLogs and NEXT_PUBLIC_ENABLE_DEBUG_LOGS in page files", () => {
    const webPageNode: BackendNode = {
      id: "node-page-logs-guard",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/api-tester",
        appSlug: "test-app",
        sections: [
          {
            id: "sec-trigger",
            name: "Trigger Section",
            actions: [
              {
                id: "act-run",
                name: "Run Test",
                event: "click",
              },
            ],
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "node-service-test",
      type: "service",
      position: { x: 300, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "TesterService",
        port: "8000",
      },
    };

    const endpoints = [
      {
        id: "ep-test",
        nodeId: "node-service-test",
        name: "/api/test",
        type: "POST" as const,
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "edge-act-to-ep",
        source: "node-page-logs-guard",
        target: "node-service-test",
        sourceHandle: "events-act-run",
        targetHandle: "endpoint-in-ep-test",
        type: "connection",
        fractionalIndex: "a0",
      },
    ];

    const result = compileNextjsV16WebClient(
      [webPageNode],
      endpoints,
      [],
      [webPageNode, serviceNode],
      edges,
    );
    const pageFile = result.files.find((f) => f.filename.endsWith("page.tsx"));
    expect(pageFile).toBeDefined();
    const pageCode = pageFile!.content;

    expect(pageCode).toContain("const showDebugLogs =");
    expect(pageCode).toContain("process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS?.trim().toLowerCase() === \"true\"");
    expect(pageCode).toContain("process.env.NEXT_PUBLIC_ENABLE_DEBUG_UI?.trim().toLowerCase() === \"true\"");
    expect(pageCode).toContain("{showDebugLogs && (");
    expect(pageCode).toContain("Output Log");
  });

  it("evaluates debug env toggles case-insensitively for TRUE, true, TRue, and trims whitespace", () => {
    const isTruthy = (val: string | undefined) => val?.trim().toLowerCase() === "true";

    expect(isTruthy("true")).toBe(true);
    expect(isTruthy("TRUE")).toBe(true);
    expect(isTruthy("TRue")).toBe(true);
    expect(isTruthy("TrUe")).toBe(true);
    expect(isTruthy(" True ")).toBe(true);

    expect(isTruthy(" Tru ")).toBe(false);
    expect(isTruthy("false")).toBe(false);
    expect(isTruthy("FALSE")).toBe(false);
    expect(isTruthy("")).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
    expect(isTruthy("0")).toBe(false);
  });

  it("compiles interactive Input with two-way store setter binding", () => {
    const webPageNode: BackendNode = {
      id: "node-page-search",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/search",
        appSlug: "search-app",
        sections: [
          {
            id: "sec-search-input",
            name: "Search Bar Section",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-query",
                name: "query",
                type: "string",
                storeName: "Search",
                renderConfig: {
                  enabled: true,
                  component: "input",
                  propMappings: {
                    inputType: "search",
                    placeholder: "Search catalog...",
                    readOnly: false,
                    onChangeMode: "two_way",
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const file = result.files.find((f) => f.filename.includes("SearchBarSection.tsx"));
    expect(file).toBeDefined();
    const code = file!.content;

    expect(code).toContain('"use client";');
    expect(code).toContain('import { useSearchStore } from "@/lib/stores";');
    expect(code).toContain('const query = useSearchStore((s) => s.query);');
    expect(code).toContain('const setQuery = useSearchStore((s) => s.setQuery);');
    expect(code).toContain('import { Input } from "@workspace/ui/components/input";');
    expect(code).toContain(
      '<Input key="st-query" type="search" value={String(query)} onChange={(e) => setQuery(e.target.value)} placeholder="Search catalog..." className="h-8 text-xs max-w-xs" />',
    );
  });

  it("compiles interactive Input with debounced updates, local buffer state, and Enter key commit", () => {
    const webPageNode: BackendNode = {
      id: "node-page-filter",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/filter",
        appSlug: "filter-app",
        sections: [
          {
            id: "sec-filter-input",
            name: "Filter Section",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-filter-text",
                name: "filterText",
                type: "string",
                storeName: "Catalog",
                renderConfig: {
                  enabled: true,
                  component: "input",
                  propMappings: {
                    inputType: "text",
                    placeholder: "Filter products...",
                    readOnly: false,
                    debounceUpdate: true,
                    debounceMs: 300,
                    commitOnEnter: true,
                    commitOnBlur: true,
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const file = result.files.find((f) => f.filename.includes("FilterSection.tsx"));
    expect(file).toBeDefined();
    const code = file!.content;

    expect(code).toContain('"use client";');
    expect(code).toContain('import React, { useState, useEffect } from "react";');
    expect(code).toContain('const filterText = useCatalogStore((s) => s.filterText);');
    expect(code).toContain('const setFilterText = useCatalogStore((s) => s.setFilterText);');
    expect(code).toContain('const [filterTextInput, setFilterTextInput] = useState<string>(String(filterText ?? ""));');
    expect(code).toContain('setFilterTextInput(String(filterText ?? ""));');
    expect(code).toContain('const timer = setTimeout(() => {');
    expect(code).toContain('setFilterText(filterTextInput);');
    expect(code).toContain('}, 300);');
    expect(code).toContain('value={filterTextInput}');
    expect(code).toContain('onChange={(e) => setFilterTextInput(e.target.value)}');
    expect(code).toContain('if (e.key === "Enter") { setFilterText(filterTextInput); }');
  });

  it("compiles numeric Input with number casting in onChange", () => {
    const webPageNode: BackendNode = {
      id: "node-page-qty",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/quantity",
        appSlug: "qty-app",
        sections: [
          {
            id: "sec-qty",
            name: "Quantity Section",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-qty",
                name: "quantity",
                type: "number",
                defaultValue: 1,
                renderConfig: {
                  enabled: true,
                  component: "input",
                  propMappings: {
                    inputType: "number",
                    placeholder: "Qty",
                    readOnly: false,
                    onChangeMode: "two_way",
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const file = result.files.find((f) => f.filename.includes("QuantitySection.tsx"));
    expect(file).toBeDefined();
    const code = file!.content;

    expect(code).toContain('const [quantity, setQuantity] = useState<number>(1);');
    expect(code).toContain('type="number"');
    expect(code).toContain('onChange={(e) => setQuantity(Number(e.target.value) || 0)}');
  });

  it("compiles Input and Button with dynamic state-driven disabled, readOnly flags, and UX attributes", () => {
    const webPageNode: BackendNode = {
      id: "node-page-dynamic-flags",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/profile",
        appSlug: "profile-app",
        sections: [
          {
            id: "sec-profile-form",
            name: "Profile Form Section",
            renderMode: "client",
            actions: [],
            states: [
              {
                id: "st-is-editing",
                name: "isEditing",
                type: "boolean",
                defaultValue: true,
              },
              {
                id: "st-is-loading",
                name: "isLoading",
                type: "boolean",
                defaultValue: false,
              },
            ],
            stateObjects: [
              {
                id: "st-username",
                name: "username",
                type: "string",
                defaultValue: "antigravity",
                renderConfig: {
                  enabled: true,
                  component: "input",
                  propMappings: {
                    inputType: "text",
                    placeholder: "Enter username...",
                    readOnlyMode: "state_binding",
                    readOnlyBinding: "isEditing",
                    readOnlyInverted: true,
                    disabledMode: "state_binding",
                    disabledBinding: "isLoading",
                    disabledInverted: false,
                    onChangeMode: "two_way",
                    autoFocus: true,
                    autoComplete: "username",
                    maxLength: 50,
                  },
                },
              },
              {
                id: "st-email-field",
                name: "email",
                type: "string",
                defaultValue: "dev@example.com",
                renderConfig: {
                  enabled: true,
                  component: "input",
                  propMappings: {
                    inputType: "email",
                    disabledMode: "expression",
                    disabledExpression: "isLoading || !isEditing",
                    readOnly: false,
                    onChangeMode: "two_way",
                  },
                },
              },
              {
                id: "st-save-btn",
                name: "canSave",
                type: "boolean",
                renderConfig: {
                  enabled: true,
                  component: "button",
                  propMappings: {
                    buttonSize: "sm",
                    disabledMode: "state_binding",
                    disabledBinding: "canSave",
                    disabledInverted: true,
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const file = result.files.find((f) => f.filename.includes("ProfileFormSection.tsx"));
    expect(file).toBeDefined();
    const code = file!.content;

    // Check dynamic readOnly and disabled binding
    expect(code).toContain("readOnly={!isEditing}");
    expect(code).toContain("disabled={Boolean(isLoading)}");
    expect(code).toContain("autoFocus");
    expect(code).toContain('autoComplete="username"');
    expect(code).toContain("maxLength={50}");

    // Check expression disabled
    expect(code).toContain("disabled={Boolean(isLoading || !isEditing)}");

    // Check button dynamic inverted disabled
    expect(code).toContain("<Button");
    expect(code).toContain("disabled={!canSave}");
  });

  it("compiles Input bound to State Store guard fields with hook imports and extractions", () => {
    const webPageNode: BackendNode = {
      id: "node-page-store-guards",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/settings",
        appSlug: "settings-app",
        sections: [
          {
            id: "sec-settings",
            name: "Settings Form Section",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-input-key",
                name: "apiKey",
                type: "string",
                defaultValue: "sk-12345",
                renderConfig: {
                  enabled: true,
                  component: "input",
                  propMappings: {
                    readOnlyMode: "state_binding",
                    readOnlyStoreName: "UserStore",
                    readOnlyBinding: "isLocked",
                    readOnlyInverted: false,
                    disabledMode: "state_binding",
                    disabledStoreName: "AuthStore",
                    disabledBinding: "isLoading",
                    disabledInverted: true,
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const file = result.files.find((f) => f.filename.includes("SettingsFormSection.tsx"));
    expect(file).toBeDefined();
    const code = file!.content;

    // Must import store hooks
    expect(code).toContain('import { useUserStore } from "@/lib/stores";');
    expect(code).toContain('import { useAuthStore } from "@/lib/stores";');

    // Must extract store variables
    expect(code).toContain("const isLocked = useUserStore((s) => s.isLocked);");
    expect(code).toContain("const isLoading = useAuthStore((s) => s.isLoading);");

    // Must generate dynamic guard JSX
    expect(code).toContain("readOnly={Boolean(isLocked)}");
    expect(code).toContain("disabled={!isLoading}");
  });

  it("generates store action dispatch and section trigger calls on state component click", () => {
    const webPageNode: BackendNode = {
      id: "node-page-clicks",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/dashboard",
        appSlug: "dash-app",
        sections: [
          {
            id: "sec-metrics",
            name: "Metrics Section",
            renderMode: "client",
            actions: [
              {
                id: "act-refresh",
                name: "refreshDashboard",
                event: "click",
              },
            ],
            stateObjects: [
              {
                id: "st-counter",
                name: "counter",
                type: "number",
                defaultValue: 10,
                storeName: "CartStore",
                renderConfig: {
                  enabled: true,
                  component: "button",
                  clickAction: "dispatch_store_action",
                  targetStoreActionName: "incrementCounter",
                },
              },
              {
                id: "st-badge",
                name: "badgeStatus",
                type: "string",
                defaultValue: "Online",
                renderConfig: {
                  enabled: true,
                  component: "badge",
                  clickAction: "trigger_event",
                  targetActionId: "act-refresh",
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const file = result.files.find((f) => f.filename.includes("MetricsSection.tsx"));
    expect(file).toBeDefined();
    const code = file!.content;

    // Must import store
    expect(code).toContain('import { useCartStore } from "@/lib/stores";');

    // Must extract state and mutator action
    expect(code).toContain("const counter = useCartStore((s) => s.counter);");
    expect(code).toContain("const incrementCounter = useCartStore((s) => s.incrementCounter);");

    // Must wire store action dispatch
    expect(code).toContain("onClick={() => incrementCounter()}");

    // Must wire section action trigger
    expect(code).toContain('onClick={() => onTrigger?.("refreshDashboard", "click", "", "POST")}');
  });

  it("supports copying static text or store variables to clipboard", () => {
    const webPageNode: BackendNode = {
      id: "node-page-copy",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/share",
        appSlug: "share-app",
        sections: [
          {
            id: "sec-share",
            name: "Share Section",
            renderMode: "client",
            actions: [],
            stateObjects: [
              {
                id: "st-static-copy",
                name: "shareLink",
                type: "string",
                defaultValue: "temp",
                renderConfig: {
                  enabled: true,
                  component: "button",
                  clickAction: "copy_to_clipboard",
                  copySourceMode: "static",
                  copyStaticValue: "https://example.com/invite/123",
                  copyToastMessage: "Link copied!",
                },
              },
              {
                id: "st-store-copy",
                name: "authToken",
                type: "string",
                defaultValue: "xyz",
                renderConfig: {
                  enabled: true,
                  component: "badge",
                  clickAction: "copy_to_clipboard",
                  copySourceMode: "store_var",
                  copyStoreName: "AuthStore",
                  copyStoreVar: "sessionToken",
                  copyToastMessage: "Token copied!",
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient([webPageNode]);
    const file = result.files.find((f) => f.filename.includes("ShareSection.tsx"));
    expect(file).toBeDefined();
    const code = file!.content;

    // Must import AuthStore
    expect(code).toContain('import { useAuthStore } from "@/lib/stores";');

    // Must extract sessionToken from AuthStore
    expect(code).toContain("const sessionToken = useAuthStore((s) => s.sessionToken);");

    // Must generate static clipboard copy
    expect(code).toContain('navigator.clipboard?.writeText("https://example.com/invite/123")');
    expect(code).toContain('toast.success("Link copied!")');

    // Must generate store var clipboard copy
    expect(code).toContain('navigator.clipboard?.writeText(typeof sessionToken === "object" ? JSON.stringify(sessionToken) : String(sessionToken))');
    expect(code).toContain('toast.success("Token copied!")');
  });
});





