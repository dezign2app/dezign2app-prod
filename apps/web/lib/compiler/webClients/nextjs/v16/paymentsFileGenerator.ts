// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  paymentsFileGenerator
// LAYER:   generators / webClients / nextjs / v16
// PURPOSE: Generates payment artifacts (Creem.io client, database sync helper,
//          checkout endpoint, webhook handler, products route, pricing UI,
//          environment variables, and package dependencies) when a Payments node
//          is connected to a Next.js WebApp or Auth server.
// ═══════════════════════════════════════════════════════════════════════════

import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledFile, PaymentsPlanConfig } from "@workspace/canvas/types";

export interface GeneratePaymentsFilesParams {
  files: CompiledFile[];
  webAppNode?: BackendNode;
  authNode?: BackendNode | null;
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
  effectiveAppSlug?: string;
}

/**
 * Resolves the Payments node associated with this WebApp:
 * 1. Direct edge between Payments node and WebAppNode
 * 2. Edge between Payments node and the AuthNode connected to this WebApp
 * 3. Explicit paymentsNodeId property on WebAppNode
 * 4. Fallback: If exactly 1 Payments node and at most 1 WebApp exist in the canvas
 */
export function resolvePaymentsNode(
  webAppNode?: BackendNode,
  authNode?: BackendNode | null,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
): BackendNode | null {
  const paymentsNodes = allNodes.filter((n) => n.type === "payments");
  if (paymentsNodes.length === 0) return null;

  // 1. Check explicit paymentsNodeId
  if (webAppNode?.data?.paymentsNodeId) {
    const explicitNode = paymentsNodes.find((n) => n.id === webAppNode.data?.paymentsNodeId);
    if (explicitNode) return explicitNode;
  }

  // 2. Direct edge to webAppNode
  if (webAppNode) {
    const webAppEdge = allEdges.find(
      (e) =>
        (e.source === webAppNode.id && paymentsNodes.some((p) => p.id === e.target)) ||
        (e.target === webAppNode.id && paymentsNodes.some((p) => p.id === e.source)),
    );
    if (webAppEdge) {
      const pId = webAppEdge.source === webAppNode.id ? webAppEdge.target : webAppEdge.source;
      const matched = paymentsNodes.find((n) => n.id === pId);
      if (matched) return matched;
    }
  }

  // 3. Edge to AuthNode (injects-plugin edge into Better Auth)
  if (authNode) {
    const authEdge = allEdges.find(
      (e) =>
        (e.target === authNode.id && paymentsNodes.some((p) => p.id === e.source)) ||
        (e.source === authNode.id && paymentsNodes.some((p) => p.id === e.target)) ||
        (e.target === authNode.id && e.targetHandle === "payments-plugin-in"),
    );
    if (authEdge) {
      const pId = authEdge.target === authNode.id ? authEdge.source : authEdge.target;
      const matched = paymentsNodes.find((n) => n.id === pId);
      if (matched) return matched;
    }
  }

  // 4. Fallback: Single payments node & single webApp on canvas
  const allWebApps = allNodes.filter((n) => n.type === "webApp");
  if (paymentsNodes.length === 1 && allWebApps.length <= 1) {
    return paymentsNodes[0] || null;
  }

  return null;
}

/**
 * Generates the Creem client singleton file (lib/creem.ts)
 */
export function generateCreemClientFile(apiKeyEnv: string = "CREEM_API_KEY"): CompiledFile {
  return {
    filename: "lib/creem.ts",
    language: "typescript",
    content: `import { createCreem } from "creem_io";

export const creem = createCreem({
  apiKey: process.env.${apiKeyEnv} || "",
  testMode: process.env.NODE_ENV !== "production",
});
`,
  };
}

/**
 * Generates database subscription synchronizer (lib/billing/sync-subscription.ts)
 */
export function generateSubscriptionSyncFile(): CompiledFile {
  return {
    filename: "lib/billing/sync-subscription.ts",
    language: "typescript",
    content: `/**
 * Synchronizes Creem billing events with the local database (subscriptions and users).
 * Updates active user plan, customer IDs, and period timestamps.
 */
export interface SyncSubscriptionParams {
  userId?: string;
  customerEmail?: string;
  creemCustomerId?: string;
  creemSubscriptionId: string;
  plan: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "expired" | "unpaid" | "paused";
  currentPeriodStart?: number | string;
  currentPeriodEnd?: number | string;
  cancelAtPeriodEnd?: boolean;
}

export async function syncSubscriptionToDatabase(params: SyncSubscriptionParams) {
  try {
    // Attempt dynamic database client import if @workspace/db is compiled
    const db = await import("@workspace/db").catch(() => null);

    if (db) {
      // 1. Try to find existing subscription for this user
      if (params.userId && "findSubscriptionsByUserId" in db && typeof db.findSubscriptionsByUserId === "function") {
        const existing = db.findSubscriptionsByUserId(params.userId);
        const firstMatch = Array.isArray(existing) && existing.length > 0 ? existing[0] : undefined;
        if (firstMatch && "updateSubscription" in db && typeof db.updateSubscription === "function") {
          return db.updateSubscription(firstMatch.id, {
            creemSubscriptionId: params.creemSubscriptionId,
            creemCustomerId: params.creemCustomerId,
            plan: params.plan,
            status: params.status,
            currentPeriodStart: String(params.currentPeriodStart || ""),
            currentPeriodEnd: String(params.currentPeriodEnd || ""),
            cancelAtPeriodEnd: params.cancelAtPeriodEnd,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Otherwise create a new subscription record
      if ("createSubscription" in db && typeof db.createSubscription === "function") {
        return db.createSubscription({
          userId: params.userId,
          creemSubscriptionId: params.creemSubscriptionId,
          creemCustomerId: params.creemCustomerId,
          plan: params.plan,
          status: params.status,
          currentPeriodStart: String(params.currentPeriodStart || ""),
          currentPeriodEnd: String(params.currentPeriodEnd || ""),
          cancelAtPeriodEnd: params.cancelAtPeriodEnd,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    console.log("[Billing Sync] Synced subscription in memory/event log:", {
      creemSubscriptionId: params.creemSubscriptionId,
      plan: params.plan,
      status: params.status,
      customerEmail: params.customerEmail,
      userId: params.userId,
    });

    return { success: true };
  } catch (error) {
    console.error("[Billing Sync Error] Failed to persist subscription to database:", error);
    return { success: false, error };
  }
}
`,
  };
}

/**
 * Generates the Creem Checkout creation route (app/api/billing/checkout/route.ts)
 */
export function generateCreemCheckoutRoute(hasAuth: boolean = true): CompiledFile {
  if (hasAuth) {
    return {
      filename: "app/api/billing/checkout/route.ts",
      language: "typescript",
      content: `import { NextRequest, NextResponse } from "next/server";
import { creem } from "@/lib/creem";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized: Active user session required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { productId, returnUrl } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "Missing required productId" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = returnUrl || \`\${appUrl}/dashboard?checkout=success\`;

    const checkout = await creem.checkouts.create({
      productId,
      successUrl,
      customer: {
        email: session.user.email,
      },
      metadata: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (error) {
    console.error("Creem checkout session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
`,
    };
  }

  return {
    filename: "app/api/billing/checkout/route.ts",
    language: "typescript",
    content: `import { NextRequest, NextResponse } from "next/server";
import { creem } from "@/lib/creem";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { productId, returnUrl, email, customerEmail, userId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "Missing required productId" },
        { status: 400 }
      );
    }

    const targetEmail = email || customerEmail;
    if (!targetEmail) {
      return NextResponse.json(
        { error: "Missing required customer email" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = returnUrl || \`\${appUrl}/dashboard?checkout=success\`;

    const checkout = await creem.checkouts.create({
      productId,
      successUrl,
      customer: {
        email: targetEmail,
      },
      metadata: {
        userId,
      },
    });

    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (error) {
    console.error("Creem checkout session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
`,
  };
}

/**
 * Generates the Creem Webhook handler with HMAC-SHA256 verification (app/api/webhooks/creem/route.ts)
 */
export function generateCreemWebhookRoute(webhookSecretEnv: string = "CREEM_WEBHOOK_SECRET"): CompiledFile {
  return {
    filename: "app/api/webhooks/creem/route.ts",
    language: "typescript",
    content: `import { NextRequest, NextResponse } from "next/server";
import { syncSubscriptionToDatabase } from "@/lib/billing/sync-subscription";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payloadString = await request.text();
    const signature = request.headers.get("creem-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing creem-signature header" }, { status: 400 });
    }

    const webhookSecret = process.env.${webhookSecretEnv};
    if (!webhookSecret) {
      console.error("Webhook secret environment variable ${webhookSecretEnv} is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Verify HMAC-SHA256 signature using native Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payloadString)
    );

    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== signatureHex) {
      console.error("Invalid Creem webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(payloadString);
    const eventType = event.type || event.eventType;
    const eventData = event.object || event.data || {};

    console.log(\`[Creem Webhook] Received valid event: \${eventType}\`, {
      id: eventData.id,
      customerId: eventData.customer?.id,
    });

    const creemSubId = eventData.subscription?.id || eventData.id || "";
    const customerId = eventData.customer?.id || "";
    const customerEmail = eventData.customer?.email || "";
    const userId = eventData.metadata?.userId || undefined;
    const planName = eventData.product?.name?.toLowerCase() || eventData.metadata?.plan || "pro";

    switch (eventType) {
      case "checkout.completed": {
        await syncSubscriptionToDatabase({
          userId,
          customerEmail,
          creemCustomerId: customerId,
          creemSubscriptionId: creemSubId,
          plan: planName,
          status: "active",
          currentPeriodStart: Date.now(),
          currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
        break;
      }
      case "subscription.active":
      case "subscription.paid":
      case "subscription.update": {
        await syncSubscriptionToDatabase({
          userId,
          customerEmail,
          creemCustomerId: customerId,
          creemSubscriptionId: creemSubId,
          plan: planName,
          status: "active",
          currentPeriodStart: eventData.current_period_start || Date.now(),
          currentPeriodEnd: eventData.current_period_end || (Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        break;
      }
      case "subscription.canceled": {
        await syncSubscriptionToDatabase({
          userId,
          customerEmail,
          creemCustomerId: customerId,
          creemSubscriptionId: creemSubId,
          plan: planName,
          status: "canceled",
          cancelAtPeriodEnd: true,
        });
        break;
      }
      case "subscription.expired": {
        await syncSubscriptionToDatabase({
          userId,
          customerEmail,
          creemCustomerId: customerId,
          creemSubscriptionId: creemSubId,
          plan: "free",
          status: "expired",
        });
        break;
      }
      default:
        console.log(\`[Creem] Unhandled event type: \${eventType}\`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Creem Webhook] Processing error:", err);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 400 });
  }
}
`,
  };
}

/**
 * Generates the products and active plan catalog API route (app/api/billing/products/route.ts)
 */
export function generateCreemProductsRoute(plans: PaymentsPlanConfig[] = []): CompiledFile {
  return {
    filename: "app/api/billing/products/route.ts",
    language: "typescript",
    content: `import { NextResponse } from "next/server";

export const revalidate = 3600;

export const SUBSCRIPTION_PLANS = ${JSON.stringify(plans, null, 2)};

export async function GET() {
  return NextResponse.json({
    plans: SUBSCRIPTION_PLANS,
  });
}
`,
  };
}

/**
 * Generates modern pricing cards component (components/billing/pricing-plans.tsx)
 */
export function generatePricingPlansComponent(plans: PaymentsPlanConfig[] = []): CompiledFile {
  return {
    filename: "components/billing/pricing-plans.tsx",
    language: "typescript",
    content: `"use client";

import React, { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export interface PlanItem {
  id: string;
  name: string;
  price: string;
  interval: "monthly" | "yearly";
  features?: string[];
  isPopular?: boolean;
}

const DEFAULT_PLANS: PlanItem[] = ${JSON.stringify(
  plans.length > 0
    ? plans.map((p) => ({
        ...p,
        features: [
          "Full feature access",
          "Real-time database sync",
          "Dedicated email support",
        ],
        isPopular: p.id.includes("pro"),
      }))
    : [
        {
          id: "plan-free",
          name: "Free Tier",
          price: "$0",
          interval: "monthly",
          features: ["Community access", "Basic analytics", "Standard support"],
        },
        {
          id: "plan-pro",
          name: "Pro Plan",
          price: "$29",
          interval: "monthly",
          isPopular: true,
          features: [
            "Unlimited access",
            "Priority SLA support",
            "Custom webhooks",
          ],
        },
        {
          id: "plan-enterprise",
          name: "Enterprise",
          price: "$199",
          interval: "monthly",
          features: ["Dedicated account manager", "Custom domain", "99.99% uptime SLA"],
        },
      ],
  null,
  2
)};

export function PricingPlans({ plans = DEFAULT_PLANS }: { plans?: PlanItem[] }) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const filteredPlans = plans.filter((p) => p.interval === billingCycle);
  const displayPlans = filteredPlans.length > 0 ? filteredPlans : plans;

  const handleCheckout = async (plan: PlanItem) => {
    try {
      setLoadingPlanId(plan.id);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: plan.id }),
      });

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to initiate checkout");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Billing Cycle Switcher */}
      <div className="flex justify-center mb-10">
        <div className="relative flex p-1 bg-muted/60 rounded-xl border border-border/50">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={\`px-4 py-2 text-xs font-semibold rounded-lg transition-all \${
              billingCycle === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }\`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={\`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 \${
              billingCycle === "yearly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }\`}
          >
            Annual Billing
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {displayPlans.map((plan) => {
          const isLoading = loadingPlanId === plan.id;
          return (
            <div
              key={plan.id}
              className={\`relative flex flex-col p-6 rounded-2xl border transition-all duration-200 \${
                plan.isPopular
                  ? "border-emerald-500 bg-card shadow-xl ring-1 ring-emerald-500/20"
                  : "border-border bg-card/60 shadow-sm hover:shadow-md"
              }\`}
            >
              {plan.isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[11px] font-bold tracking-wide uppercase bg-emerald-500 text-white rounded-full shadow-sm">
                  Most Popular
                </span>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-xs text-muted-foreground">/{plan.interval}</span>
                </div>
              </div>

              {/* Features List */}
              <ul className="flex-1 space-y-3 mb-6 text-xs text-muted-foreground">
                {(plan.features || ["Full feature access", "Real-time updates"]).map(
                  (feature, fIdx) => (
                    <li key={fIdx} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  )
                )}
              </ul>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleCheckout(plan)}
                className={\`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 \${
                  plan.isPopular
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                } disabled:opacity-50\`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting to checkout...
                  </>
                ) : plan.price === "$0" ? (
                  "Get Started Free"
                ) : (
                  \`Upgrade to \${plan.name}\`
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`,
  };
}

/**
 * Main generator entry point: Injects Creem client, database synchronizer, checkout route,
 * webhook route, products catalog route, pricing UI component, dependencies into package.json,
 * and environment secrets into .env / .env.example.
 */
export function generatePaymentsFilesAndDependencies({
  files,
  webAppNode,
  authNode,
  allNodes = [],
  allEdges = [],
}: GeneratePaymentsFilesParams): void {
  const paymentsNode = resolvePaymentsNode(webAppNode, authNode, allNodes, allEdges);
  if (!paymentsNode) return;

  const data = paymentsNode.data || {};
  const apiKeyEnv = data.apiKeyEnv || "CREEM_API_KEY";
  const webhookSecretEnv = data.webhookSecretEnv || "CREEM_WEBHOOK_SECRET";
  const plans: PaymentsPlanConfig[] = data.plans || [];

  // 1. Emit lib/creem.ts
  files.push(generateCreemClientFile(apiKeyEnv));

  // 2. Emit lib/billing/sync-subscription.ts
  files.push(generateSubscriptionSyncFile());

  // 3. Emit Checkout, Webhook, and Products API Routes
  files.push(generateCreemCheckoutRoute(Boolean(authNode)));
  files.push(generateCreemWebhookRoute(webhookSecretEnv));
  files.push(generateCreemProductsRoute(plans));

  // 4. Emit Pricing Component
  files.push(generatePricingPlansComponent(plans));

  // 5. Update package.json to include creem_io
  const pkgFileIdx = files.findIndex((f) => f.filename === "package.json");
  if (pkgFileIdx !== -1) {
    try {
      const pkgObj = JSON.parse(files[pkgFileIdx]!.content);
      pkgObj.dependencies = pkgObj.dependencies || {};
      pkgObj.dependencies["creem_io"] = "^1.0.0";
      files[pkgFileIdx]!.content = JSON.stringify(pkgObj, null, 2);
    } catch (_err) {
      // Preserve existing content on parse failure
    }
  }

  // 6. Update .env and .env.example
  const envLines: string[] = [
    "",
    "# Creem Payments & Subscription Billing",
    `${apiKeyEnv}=creem_test_your_api_key_here`,
    `${webhookSecretEnv}=your_creem_webhook_secret_here`,
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  ];

  plans.forEach((plan) => {
    const slug = (plan.name || plan.id).toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    envLines.push(`CREEM_PRODUCT_ID_${slug}=prod_${plan.id}`);
  });

  const envContentToAdd = envLines.join("\n") + "\n";

  // Append to .env
  const existingEnvIdx = files.findIndex((f) => f.filename === ".env");
  if (existingEnvIdx !== -1) {
    if (!files[existingEnvIdx]!.content.includes(apiKeyEnv)) {
      files[existingEnvIdx]!.content += envContentToAdd;
    }
  } else {
    files.push({
      filename: ".env",
      language: "dotenv",
      content: envContentToAdd.trimStart(),
    });
  }

  // Append to .env.example
  const existingEnvExIdx = files.findIndex((f) => f.filename === ".env.example");
  if (existingEnvExIdx !== -1) {
    if (!files[existingEnvExIdx]!.content.includes(apiKeyEnv)) {
      files[existingEnvExIdx]!.content += envContentToAdd;
    }
  } else {
    files.push({
      filename: ".env.example",
      language: "dotenv",
      content: envContentToAdd.trimStart(),
    });
  }
}
