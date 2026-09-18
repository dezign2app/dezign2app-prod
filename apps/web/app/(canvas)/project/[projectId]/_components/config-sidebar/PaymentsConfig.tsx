import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  CreditCard,
  Plus,
  Trash,
  PlugZap,
  ShieldCheck,
  Database,
  Table as TableIcon,
  CheckCircle2,
} from "lucide-react";
import {
  PaymentsPlanConfig,
  PAYMENTS_SUBSCRIPTION_TABLE_DEFINITION,
  SUBSCRIPTION_STATUSES,
  DEFAULT_DATABASE_NODE_LABEL,
  DEFAULT_DATABASE_ENGINE,
  DEFAULT_DATABASE_ENV_VARS,
  getUniqueNodeLabel,
} from "@workspace/canvas";

export const PaymentsConfig = ({
  id,
  nodeId,
}: {
  id: string;
  nodeId: string;
}) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === nodeId),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const edges = useBackendCanvasStore((s) => s.edges);
  const nodes = useBackendCanvasStore((s) => s.nodes);

  if (!node) return null;

  const data = node.data;

  const updateData = (changes: Partial<typeof data>) => {
    updateNode(nodeId, { data: { ...data, ...changes } });
  };

  const plans: PaymentsPlanConfig[] = data.plans || [
    { id: "plan-free", name: "Free Tier", price: "$0", interval: "monthly" },
    { id: "plan-pro", name: "Pro Plan", price: "$29", interval: "monthly" },
    { id: "plan-enterprise", name: "Enterprise", price: "$199", interval: "monthly" },
  ];

  // Connected Auth Server node via injects-plugin edge
  const connectedAuthEdge = edges.find(
    (e) =>
      (e.source === nodeId && e.targetHandle === "payments-plugin-in") ||
      (e.target === nodeId && e.sourceHandle === "injects-plugin-out"),
  );
  const connectedAuthNode = connectedAuthEdge
    ? nodes.find(
        (n) =>
          n.id ===
          (connectedAuthEdge.source === nodeId
            ? connectedAuthEdge.target
            : connectedAuthEdge.source),
      )
    : null;

  const subscriptionEntity = nodes.find(
    (n) =>
      (n.type === "entity" || n.type === "db_ref") &&
      (n.data?.label?.toLowerCase() === "subscription" ||
        n.data?.label?.toLowerCase() === "subscriptions"),
  );

  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  const handleAddSubscriptionTable = () => {
    let dbNode = nodes.find((n) => n.type === "database" && n.data?.dbEngine !== "redis");
    let dbId = dbNode?.id;

    if (!dbId) {
      dbId = crypto.randomUUID();
      const dbLabel = getUniqueNodeLabel(nodes, DEFAULT_DATABASE_NODE_LABEL, "database");
      addNode({
        id: dbId,
        type: "database",
        position: { x: (node.position?.x ?? 0) - 250, y: (node.position?.y ?? 0) + 250 },
        data: {
          label: dbLabel,
          dbEngine: DEFAULT_DATABASE_ENGINE,
          dbType: "relational",
          dbCategory: "sql",
          dbConnectionType: "env_var",
          connectionStringEnv: DEFAULT_DATABASE_ENV_VARS.connectionStringEnv,
          dbFilePathEnv: DEFAULT_DATABASE_ENV_VARS.dbFilePathEnv,
          color: "#f59e0b",
          isDefault: true,
        },
      });
    }

    const tableId = `entity-${Date.now()}-subscription`;
    addNode({
      id: tableId,
      type: "entity",
      position: { x: node.position?.x ?? 0, y: (node.position?.y ?? 0) + 250 },
      data: {
        label: "subscription",
        description: PAYMENTS_SUBSCRIPTION_TABLE_DEFINITION.description,
        columns: PAYMENTS_SUBSCRIPTION_TABLE_DEFINITION.defaultColumns,
        indexes: PAYMENTS_SUBSCRIPTION_TABLE_DEFINITION.defaultIndexes
          ? [...PAYMENTS_SUBSCRIPTION_TABLE_DEFINITION.defaultIndexes]
          : [],
        databaseId: dbId,
      },
    });

    if (dbId) {
      addEdge({
        id: `edge-${dbId}-${tableId}`,
        source: dbId,
        target: tableId,
        sourceHandle: "database-source",
        targetHandle: "database-entity-target",
        type: "database-connection",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-4 pb-12 text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded border border-emerald-500/30 shadow-sm flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" /> PAYMENTS SERVICE
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {data.label || "Creem Payments"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure Creem.io subscription plans, webhook event mapping, and plugin injection settings.
        </p>
      </div>

      {/* Code Injection Connection Status */}
      <div className="p-3 bg-muted/20 border border-border/40 rounded-lg flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <PlugZap className="w-3.5 h-3.5 text-emerald-500" /> Better Auth Plugin Connection
          </Label>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
              connectedAuthNode
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-muted text-muted-foreground border-border/40"
            }`}
          >
            {connectedAuthNode ? "Wired via injects-plugin edge" : "Not Wired"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Connecting Payments → Auth automatically registers <code className="font-mono">@creem_io/better-auth</code> into the Auth Server's generated <code className="font-mono">plugins</code> array.
        </p>
      </div>

      {/* Environment Secret Config */}
      <div className="grid grid-cols-2 gap-3 p-3.5 bg-muted/20 rounded-lg border border-border/40">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">API Key Env Reference</Label>
          <Input
            className="h-8 text-xs font-mono"
            value={data.apiKeyEnv || "CREEM_API_KEY"}
            onChange={(e) => updateData({ apiKeyEnv: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Webhook Secret Env Ref</Label>
          <Input
            className="h-8 text-xs font-mono"
            value={data.webhookSecretEnv || "CREEM_WEBHOOK_SECRET"}
            onChange={(e) => updateData({ webhookSecretEnv: e.target.value })}
          />
        </div>
      </div>

      {/* Subscription Plans Table */}
      <div className="flex flex-col gap-3 p-3.5 bg-muted/20 rounded-lg border border-border/40">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Subscription Plan Tiers</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const updated = [
                ...plans,
                { id: `plan-${Date.now()}`, name: "New Plan", price: "$49", interval: "monthly" as const },
              ];
              updateData({ plans: updated });
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Plan
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {plans.map((plan, idx) => (
            <div
              key={plan.id}
              className="grid grid-cols-12 gap-2 items-center p-2 rounded bg-background border border-border/50 text-xs"
            >
              <div className="col-span-3">
                <Input
                  className="h-7 text-xs font-mono"
                  value={plan.id}
                  placeholder="plan-id"
                  onChange={(e) => {
                    const updated = [...plans];
                    if (updated[idx]) {
                      updated[idx].id = e.target.value;
                      updateData({ plans: updated });
                    }
                  }}
                />
              </div>
              <div className="col-span-4">
                <Input
                  className="h-7 text-xs font-medium"
                  value={plan.name}
                  placeholder="Plan Name"
                  onChange={(e) => {
                    const updated = [...plans];
                    if (updated[idx]) {
                      updated[idx].name = e.target.value;
                      updateData({ plans: updated });
                    }
                  }}
                />
              </div>
              <div className="col-span-2">
                <Input
                  className="h-7 text-xs font-mono"
                  value={plan.price}
                  placeholder="$29"
                  onChange={(e) => {
                    const updated = [...plans];
                    if (updated[idx]) {
                      updated[idx].price = e.target.value;
                      updateData({ plans: updated });
                    }
                  }}
                />
              </div>
              <div className="col-span-2">
                <Select
                  value={plan.interval}
                  onValueChange={(val: PaymentsPlanConfig["interval"]) => {
                    const updated = [...plans];
                    if (updated[idx]) {
                      updated[idx].interval = val;
                      updateData({ plans: updated });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                    <SelectItem value="yearly" className="text-xs">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => {
                    const updated = plans.filter((_, i) => i !== idx);
                    updateData({ plans: updated });
                  }}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscriptions Table & Customization */}
      <div className="flex flex-col gap-3 p-3.5 bg-muted/20 rounded-lg border border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <Label className="text-xs font-semibold">Subscriptions Database Table</Label>
          </div>
          {subscriptionEntity ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Added to Schema           </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              onClick={handleAddSubscriptionTable}
            >
              <TableIcon className="w-3.5 h-3.5 mr-1" /> Add Table to Canvas
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {subscriptionEntity
            ? "The subscription entity is on your canvas. Click the table node on the canvas to add custom fields (e.g. seats, metadata, billing details)."
            : "Add the subscriptions table as a visual entity node on the canvas to customize fields, or let the compiler synthesize standard fields automatically."}
        </p>

        {/* Predefined Statuses */}
        <div className="flex flex-col gap-1.5 pt-1">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase">
            Predefined Subscription Statuses
          </Label>
          <div className="flex flex-wrap gap-1">
            {SUBSCRIPTION_STATUSES.map((status) => (
              <span
                key={status}
                className="px-1.5 py-0.5 rounded bg-background text-[10px] font-mono text-muted-foreground border border-border/60"
              >
                {status}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Exposed Claims Contract */}
      <div className="flex flex-col gap-2 p-3 bg-muted/20 border border-border/40 rounded-lg">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Published Claims Contract (Read-Only)
        </Label>
        <p className="text-xs text-muted-foreground">
          Claims exposed to Auth Server and downstream WebApp Access Conditions:
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["hasAccess", "accessExpiresAt", "subscriptionStatus", "planId", "inGracePeriod"].map((claim) => (
            <span key={claim} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] border border-emerald-500/20">
              {claim}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
