"use client";

import React, { useState } from "react";
import {
  authClient,
  useActiveOrganization,
  useListOrganizations,
} from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import {
  Building2,
  Users,
  CreditCard,
  Plus,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@workspace/ui/components/card";
import { toast } from "sonner";
import { CreateOrgDialog } from "@/components/auth/org/create-org-dialog";

interface OrgSummaryGridProps {
  onSelectOrg: (orgId: string) => void;
  onOpenBilling?: (orgId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: {
    label: "Active Plan",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  canceled: {
    label: "Canceled",
    color: "text-muted-foreground bg-muted border-border",
  },
  past_due: {
    label: "Past Due",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  expired: {
    label: "Expired",
    color: "text-destructive bg-destructive/10 border-destructive/20",
  },
  trialing: {
    label: "Trial",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  inactive: {
    label: "No Active Plan",
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
};

export function OrgSummaryGrid({ onSelectOrg, onOpenBilling }: OrgSummaryGridProps) {
  const { data: activeOrg } = useActiveOrganization();
  const { data: orgs, isPending: isOrgsPending, refetch: refetchOrgs } = useListOrganizations();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const orgIds = orgs ? orgs.map((o) => o.id) : [];

  const summaries = useQuery(
    api.billing.getUserOrganizationsSummary,
    orgIds.length > 0 ? { organizationIds: orgIds } : "skip",
  );

  const handleSwitchOrg = async (orgId: string, orgName: string) => {
    if (activeOrg?.id === orgId) return;

    setSwitchingId(orgId);
    try {
      await authClient.organization.setActive({ organizationId: orgId });
      if (typeof window !== "undefined") {
        localStorage.setItem("preferred_workspace", orgId);
        window.dispatchEvent(
          new CustomEvent("auth:workspace-changed", {
            detail: { organizationId: orgId },
          }),
        );
      }
      toast.success(`Switched to "${orgName}"`);
    } catch (e) {
      toast.error("Failed to switch workspace");
    } finally {
      setSwitchingId(null);
    }
  };

  if (isOrgsPending) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summaryMap = new Map((summaries || []).map((s) => [s.organizationId, s]));

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">My Organizations</h2>
          <p className="text-xs text-muted-foreground">
            Manage your team workspaces, seat limits, and member permissions.
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          size="sm"
          className="gap-1.5 shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Organization</span>
        </Button>
      </div>

      {/* Grid of Organizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orgs && orgs.length > 0 ? (
          orgs.map((org) => {
            const isCurrent = activeOrg?.id === org.id;
            const summary = summaryMap.get(org.id);
            const role = summary?.role || "member";
            const isOwner = summary?.isOwner || role === "owner";
            const statusKey = summary?.status || "inactive";
            const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.inactive;

            const totalSeats = summary?.totalSeats || 1;
            const usedSeats = summary?.usedSeats || 1;
            const seatPct = Math.min(100, Math.round((usedSeats / totalSeats) * 100));

            return (
              <Card
                key={org.id}
                className={`relative flex flex-col transition-all hover:border-primary/40 ${
                  isCurrent ? "border-primary shadow-sm ring-1 ring-primary/20" : "border-border"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CardTitle className="text-sm font-semibold truncate text-foreground">
                            {org.name}
                          </CardTitle>
                          {isCurrent && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                              Active
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-[11px] text-muted-foreground truncate">
                          /{org.slug}
                        </CardDescription>
                      </div>
                    </div>

                    <Badge
                      variant="secondary"
                      className="text-[10px] font-normal uppercase tracking-wider capitalize shrink-0"
                    >
                      {role}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 flex-1 pb-3 text-xs">
                  {/* Status & Seats */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">Status</span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusCfg?.color}`}
                    >
                      {statusCfg?.label}
                    </span>
                  </div>

                  {/* Seat usage */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>Seats</span>
                      </span>
                      <span>
                        {usedSeats} / {totalSeats} used
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${seatPct}%`,
                          background:
                            seatPct >= 90
                              ? "hsl(var(--destructive))"
                              : "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 pb-4 border-t border-border/50 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant={isCurrent ? "outline" : "default"}
                    onClick={() => {
                      if (!isCurrent) {
                        void handleSwitchOrg(org.id, org.name);
                      }
                      onSelectOrg(org.id);
                    }}
                    disabled={switchingId === org.id}
                    className="flex-1 text-xs gap-1.5"
                  >
                    {switchingId === org.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isCurrent ? (
                      "Manage Settings"
                    ) : (
                      <>
                        <span>Switch Workspace</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>

                  {isOwner && onOpenBilling && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenBilling(org.id)}
                      className="text-xs px-2 text-muted-foreground hover:text-foreground"
                      title="View Billing & Seats"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center space-y-3 border border-dashed rounded-xl p-8">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-semibold">No Organizations Yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create an organization to invite teammates, share system architecture designs, and collaborate.
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
              className="mt-2 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Organization</span>
            </Button>
          </div>
        )}

        {/* Create New Org Card */}
        {orgs && orgs.length > 0 && (
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="flex flex-col items-center justify-center min-h-[190px] rounded-xl border border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-muted/20 transition-all group cursor-pointer"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
              Create New Organization
            </span>
            <span className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">
              Set up another dedicated workspace for a new project or client team.
            </span>
          </button>
        )}
      </div>

      <CreateOrgDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        existingOrgsCount={orgs?.length || 0}
        onCreated={() => {
          void refetchOrgs();
        }}
      />
    </div>
  );
}
