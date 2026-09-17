import { describe, it, expect } from "vitest";
import { compileMonorepo } from "../compileMonorepo";
import { compileDatabaseNodes } from "../compileDatabaseNodes";
import { prepareNodeForAddition } from "../../stores/backendCanvas/node/nodeCreation";
import { NodeCreationCanvasState } from "../../stores/backendCanvas/node/types";
import { createGraphNodeData } from "@/app/(canvas)/project/[projectId]/_components/GraphView/utils";
import { BackendNode, BackendEdge } from "@/types/canvas";

describe("Creem Payments Node & Next.js 16 Compiler Integration", () => {
  it("initializes payments node with default Creem plans and secrets via prepareNodeForAddition", () => {
    const rawNode: Omit<BackendNode, "fractionalIndex"> = {
      id: "node-payments-1",
      type: "payments",
      position: { x: 100, y: 100 },
      data: {
        label: "My Subscriptions",
      },
    };

    const currentState: NodeCreationCanvasState = {
      nodes: [],
      edges: [],
      pendingNodeUpserts: [],
      pendingEdgeUpserts: [],
      endpoints: [],
      pendingEndpointUpserts: [],
    };

    const result = prepareNodeForAddition(rawNode, currentState);
    const addedNode = result.nodes.find((n) => n.id === "node-payments-1");

    expect(addedNode).toBeDefined();
    expect(addedNode?.data?.provider).toBe("creem");
    expect(addedNode?.data?.apiKeyEnv).toBe("CREEM_API_KEY");
    expect(addedNode?.data?.webhookSecretEnv).toBe("CREEM_WEBHOOK_SECRET");
    expect(addedNode?.data?.plans).toHaveLength(3);
    expect(addedNode?.data?.plans?.[0]?.name).toBe("Free Tier");
    expect(addedNode?.data?.plans?.[1]?.name).toBe("Pro Plan");
  });

  it("creates default graph node data for payments type in createGraphNodeData", () => {
    const data = createGraphNodeData("payments", "Billing Service", []);
    expect(data.label).toBe("Billing Service");
    expect(data.provider).toBe("creem");
    expect(data.apiKeyEnv).toBe("CREEM_API_KEY");
    expect(data.webhookSecretEnv).toBe("CREEM_WEBHOOK_SECRET");
    expect(data.plans).toHaveLength(3);
  });

  it("compiles Creem client, checkout route, webhook route, env vars, and package.json when Payments is wired to Auth & WebApp", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp-1",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "SaaS App",
        appSlug: "saas-app",
        port: "3000",
      },
    };

    const pageNode: BackendNode = {
      id: "node-page-1",
      type: "webPage",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "/",
        appSlug: "saas-app",
      },
    };

    const authNode: BackendNode = {
      id: "node-auth-1",
      type: "auth",
      position: { x: -200, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Better Auth",
        framework: "better_auth",
        version: "v1.6",
      },
    };

    const paymentsNode: BackendNode = {
      id: "node-payments-1",
      type: "payments",
      position: { x: -400, y: 0 },
      fractionalIndex: "a3",
      data: {
        label: "Creem Payments",
        provider: "creem",
        apiKeyEnv: "CREEM_API_KEY",
        webhookSecretEnv: "CREEM_WEBHOOK_SECRET",
        plans: [
          { id: "starter", name: "Starter", price: "$15", interval: "monthly" },
          { id: "pro", name: "Pro", price: "$49", interval: "monthly" },
        ],
      },
    };

    const edges: BackendEdge[] = [
      // WebApp <-> Page
      {
        id: "edge-webapp-page",
        source: "node-webapp-1",
        sourceHandle: "public-in",
        target: "node-page-1",
        targetHandle: "page-in",
        type: "connection",
        fractionalIndex: "e0",
      },
      // Auth -> WebApp
      {
        id: "edge-auth-webapp",
        source: "node-auth-1",
        sourceHandle: "auth-out",
        target: "node-webapp-1",
        targetHandle: "auth-in",
        type: "connection",
        fractionalIndex: "e1",
      },
      // Payments -> Auth (plugin injection edge)
      {
        id: "edge-payments-auth",
        source: "node-payments-1",
        sourceHandle: "injects-plugin-out",
        target: "node-auth-1",
        targetHandle: "payments-plugin-in",
        type: "identity-connection",
        fractionalIndex: "e2",
      },
    ];

    const result = compileMonorepo([webAppNode, pageNode, authNode, paymentsNode], [], [], edges);

    // 1. Verify lib/creem.ts
    const creemFile = result.files.find((f) => f.filename === "apps/saas-app/lib/creem.ts");
    expect(creemFile).toBeDefined();
    expect(creemFile?.content).toContain('import { createCreem } from "creem_io";');
    expect(creemFile?.content).toContain("process.env.CREEM_API_KEY");

    // 2. Verify Checkout route
    const checkoutRoute = result.files.find((f) => f.filename === "apps/saas-app/app/api/billing/checkout/route.ts");
    expect(checkoutRoute).toBeDefined();
    expect(checkoutRoute?.content).toContain("creem.checkouts.create");
    expect(checkoutRoute?.content).toContain("auth.api.getSession");

    // 3. Verify Webhook route with HMAC signature verification
    const webhookRoute = result.files.find((f) => f.filename === "apps/saas-app/app/api/webhooks/creem/route.ts");
    expect(webhookRoute).toBeDefined();
    expect(webhookRoute?.content).toContain('request.headers.get("creem-signature")');
    expect(webhookRoute?.content).toContain('crypto.subtle.importKey');
    expect(webhookRoute?.content).toContain("checkout.completed");

    // 4. Verify package.json dependency
    const pkgFile = result.files.find((f) => f.filename === "apps/saas-app/package.json");
    expect(pkgFile).toBeDefined();
    const pkgJson = JSON.parse(pkgFile!.content);
    expect(pkgJson.dependencies["creem_io"]).toBe("^1.0.0");

    // 5. Verify .env and .env.example
    const envFile = result.files.find((f) => f.filename === "apps/saas-app/.env");
    expect(envFile).toBeDefined();
    expect(envFile?.content).toContain("CREEM_API_KEY=creem_test_your_api_key_here");
    expect(envFile?.content).toContain("CREEM_WEBHOOK_SECRET=your_creem_webhook_secret_here");
    expect(envFile?.content).toContain("CREEM_PRODUCT_ID_STARTER=prod_starter");
    expect(envFile?.content).toContain("CREEM_PRODUCT_ID_PRO=prod_pro");

    // 6. Verify lib/auth.ts includes customSession claims for plan and creemCustomerId
    const authFile = result.files.find((f) => f.filename === "apps/saas-app/lib/auth.ts");
    expect(authFile).toBeDefined();
    expect(authFile?.content).toContain("customSession");
    expect(authFile?.content).toContain('"plan" in user');
    expect(authFile?.content).toContain('"creemCustomerId" in user');

    // 7. Verify sync-subscription helper
    const syncSubFile = result.files.find((f) => f.filename === "apps/saas-app/lib/billing/sync-subscription.ts");
    expect(syncSubFile).toBeDefined();
    expect(syncSubFile?.content).toContain("syncSubscriptionToDatabase");
    expect(syncSubFile?.content).toContain("createSubscription");
    expect(syncSubFile?.content).toContain("findSubscriptionsByUserId");

    // 8. Verify products API route and pricing UI component
    const productsRoute = result.files.find((f) => f.filename === "apps/saas-app/app/api/billing/products/route.ts");
    expect(productsRoute).toBeDefined();
    expect(productsRoute?.content).toContain("starter");
    expect(productsRoute?.content).toContain("pro");

    const pricingComponent = result.files.find((f) => f.filename === "apps/saas-app/components/billing/pricing-plans.tsx");
    expect(pricingComponent).toBeDefined();
    expect(pricingComponent?.content).toContain("handleCheckout");
    expect(pricingComponent?.content).toContain("/api/billing/checkout");
  });

  it("does NOT generate Creem payment files when Payments node is not connected to the WebApp", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp-2",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Free Tool",
        appSlug: "free-tool",
        port: "3000",
      },
    };

    const pageNode: BackendNode = {
      id: "node-page-2",
      type: "webPage",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "/",
        appSlug: "free-tool",
      },
    };

    const edges: BackendEdge[] = [
      {
        id: "edge-webapp-page-2",
        source: "node-webapp-2",
        sourceHandle: "public-in",
        target: "node-page-2",
        targetHandle: "page-in",
        type: "connection",
        fractionalIndex: "e0",
      },
    ];

    const result = compileMonorepo([webAppNode, pageNode], [], [], edges);

    const creemFile = result.files.find((f) => f.filename === "apps/free-tool/lib/creem.ts");
    expect(creemFile).toBeUndefined();

    const checkoutRoute = result.files.find((f) => f.filename === "apps/free-tool/app/api/billing/checkout/route.ts");
    expect(checkoutRoute).toBeUndefined();

    const webhookRoute = result.files.find((f) => f.filename === "apps/free-tool/app/api/webhooks/creem/route.ts");
    expect(webhookRoute).toBeUndefined();

    const pkgFile = result.files.find((f) => f.filename === "apps/free-tool/package.json");
    if (pkgFile) {
      const pkgJson = JSON.parse(pkgFile.content);
      expect(pkgJson.dependencies?.["creem_io"]).toBeUndefined();
    }
  });

  it("synthesizes subscription table with default columns into database package when Payments node is present", () => {
    const paymentsNode: BackendNode = {
      id: "node-payments-db",
      type: "payments",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Creem Billing",
        provider: "creem",
      },
    };

    const dbResult = compileDatabaseNodes([paymentsNode], []);
    const connectionFile = dbResult.files.find((f) => f.filename === "connection.ts");
    const helpersFile = dbResult.files.find((f) => f.filename === "helpers/subscription.ts");

    expect(connectionFile).toBeDefined();
    expect(connectionFile?.content).toContain("CREATE TABLE IF NOT EXISTS \\\"subscription\\\"");
    expect(connectionFile?.content).toContain("creemSubscriptionId");
    expect(connectionFile?.content).toContain("creemCustomerId");
    expect(connectionFile?.content).toContain("currentPeriodEnd");

    expect(helpersFile).toBeDefined();
    expect(helpersFile?.content).toContain("SubscriptionRow");
  });

  it("preserves user-defined custom columns when subscription entity is placed on canvas", () => {
    const paymentsNode: BackendNode = {
      id: "node-payments-db",
      type: "payments",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Creem Billing",
        provider: "creem",
      },
    };

    const customSubscriptionEntity: BackendNode = {
      id: "node-custom-sub",
      type: "entity",
      position: { x: 100, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "subscription",
        columns: [
          { name: "id", type: "text", isPrimaryKey: true },
          { name: "customCreditsRemaining", type: "integer" },
          { name: "enterpriseTierSlug", type: "text" },
        ],
      },
    };

    const dbResult = compileDatabaseNodes([paymentsNode, customSubscriptionEntity], []);
    const connectionFile = dbResult.files.find((f) => f.filename === "connection.ts");
    const helpersFile = dbResult.files.find((f) => f.filename === "helpers/subscription.ts");

    expect(connectionFile).toBeDefined();
    // Preserves custom columns in SQL DDL
    expect(connectionFile?.content).toContain("customCreditsRemaining");
    expect(connectionFile?.content).toContain("enterpriseTierSlug");
    // Backfills missing core payment columns
    expect(connectionFile?.content).toContain("creemSubscriptionId");
    expect(connectionFile?.content).toContain("creemCustomerId");
    expect(connectionFile?.content).toContain("status");

    expect(helpersFile).toBeDefined();
    expect(helpersFile?.content).toContain("customCreditsRemaining");
    expect(helpersFile?.content).toContain("enterpriseTierSlug");
  });

  it("generates standalone checkout route and adds workspace db dependency when Payments node is connected to WebApp without Auth", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp-no-auth",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Billing App",
        appSlug: "billing-app",
      },
    };

    const paymentsNode: BackendNode = {
      id: "node-payments-direct",
      type: "payments",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Direct Creem",
        provider: "creem",
      },
    };

    const edges: BackendEdge[] = [
      {
        id: "edge-webapp-payments",
        source: "node-payments-direct",
        target: "node-webapp-no-auth",
        type: "connection",
        fractionalIndex: "e0",
      },
    ];

    const result = compileMonorepo([webAppNode, paymentsNode], [], [], edges);

    const checkoutRoute = result.files.find((f) => f.filename === "apps/billing-app/app/api/billing/checkout/route.ts");
    expect(checkoutRoute).toBeDefined();
    // Standalone checkout route should not require lib/auth
    expect(checkoutRoute?.content).not.toContain('import { auth } from "@/lib/auth";');
    expect(checkoutRoute?.content).toContain("targetEmail = email || customerEmail");

    // Package.json should include both creem_io and @workspace/db
    const pkgFile = result.files.find((f) => f.filename === "apps/billing-app/package.json");
    expect(pkgFile).toBeDefined();
    const pkgJson = JSON.parse(pkgFile!.content);
    expect(pkgJson.dependencies["creem_io"]).toBe("^1.0.0");
    expect(pkgJson.dependencies["@workspace/db"]).toBe("workspace:*");
  });
});

