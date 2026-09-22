"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  authClient,
  useActiveOrganization,
  useListOrganizations,
} from "@/lib/auth-client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import {
  Building2,
  Users,
  CreditCard,
  ShieldAlert,
  Clock,
  XCircle,
  Loader2,
  ChevronsUpDown,
  Check,
  Plus,
  LayoutGrid,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";

import { GeneralTab } from "./_components/general-tab";
import { MembersTab } from "./_components/members-tab";
import { BillingTab } from "./_components/billing-tab";
import { DangerTab } from "./_components/danger-tab";
import { OrgSummaryGrid } from "./_components/org-summary-grid";
import { CreateOrgDialog } from "@/components/auth/org/create-org-dialog";

const TABS = [
  { id: "general", label: "General", icon: Building2 },
  { id: "members", label: "Members", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "danger", label: "Danger Zone", icon: ShieldAlert },
] as const;

type TabId = (typeof TABS)[number]["id"];

function OrganizationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramView = searchParams.get("view");
  const paramTab = searchParams.get("tab") as TabId | null;

  const { data: activeOrg, isPending: isActivePending } = useActiveOrganization();
  const { data: orgs, isPending: isListPending, refetch: refetchOrgs } = useListOrganizations();

  // Mode: "overview" (All Orgs summary grid) vs "detail" (Tabs for selected org)
  // Defaults to "overview" (All Organizations)
  const [viewMode, setViewMode] = useState<"overview" | "detail">(
    paramView === "detail" ? "detail" : "overview",
  );
  const [activeTab, setActiveTab] = useState<TabId>(paramTab || "general");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Sync state if URL search params change
  useEffect(() => {
    if (paramView === "detail") {
      setViewMode("detail");
    } else if (paramView === "all") {
      setViewMode("overview");
    }
    if (paramTab && TABS.some((t) => t.id === paramTab)) {
      setActiveTab(paramTab);
      setViewMode("detail");
    }
  }, [paramView, paramTab]);

  const seatStatus = useQuery(
    api.billing.getOrgSeatStatus,
    activeOrg?.id ? { organizationId: activeOrg.id } : "skip",
  );

  const isOwner = seatStatus?.isOwner ?? false;
  const visibleTabs = isOwner
    ? TABS
    : TABS.filter((tab) => tab.id === "general");

  useEffect(() => {
    if (!isOwner && activeTab !== "general") {
      setActiveTab("general");
    }
  }, [isOwner, activeTab]);

  const deletionStatus = useQuery(
    api.billing.getOrgDeletionStatus,
    activeOrg?.id ? { organizationId: activeOrg.id } : "skip",
  );

  const cancelOrgDeletion = useMutation(api.billing.cancelOrgDeletion);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelDeletion = async () => {
    if (!activeOrg?.id) return;
    setCancelling(true);
    try {
      await cancelOrgDeletion({ organizationId: activeOrg.id });
      toast.success("Deletion cancelled — your organization is safe");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel deletion");
    } finally {
      setCancelling(false);
    }
  };

  const handleSwitchOrg = async (orgId: string, orgName: string) => {
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
      setViewMode("detail");
      toast.success(`Switched to "${orgName}"`);
    } catch (e) {
      toast.error("Failed to switch workspace");
    }
  };

  if (isActivePending || isListPending) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If user has zero organizations created, guide to overview/creation
  if (!activeOrg && (!orgs || orgs.length === 0)) {
    return (
      <div className="container max-w-4xl py-12 px-4">
        <OrgSummaryGrid
          onSelectOrg={(id) => {
            setViewMode("detail");
          }}
        />
      </div>
    );
  }

  const orgItem = activeOrg
    ? { id: activeOrg.id, name: activeOrg.name, slug: activeOrg.slug }
    : null;

  return (
    <div className="container max-w-4xl py-8 px-4 space-y-6 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* TOP HEADER: Org Switcher / Overview Dropdown & Action Controls             */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-accent/50 text-foreground transition-all shadow-sm group focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label="Switch organization"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {viewMode === "overview" ? (
                    <LayoutGrid className="h-4 w-4" />
                  ) : activeOrg?.name ? (
                    activeOrg.name.charAt(0).toUpperCase()
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                </div>

                <div className="text-left min-w-[130px] max-w-[200px]">
                  <div className="text-xs font-bold truncate leading-tight">
                    {viewMode === "overview" ? "All Organizations" : activeOrg?.name || "Select Organization"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {viewMode === "overview"
                      ? `${orgs?.length || 0} workspaces`
                      : activeOrg?.slug ? `/${activeOrg.slug}` : "Workspace"}
                  </div>
                </div>

                <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0 opacity-70 group-hover:opacity-100 transition-opacity ml-1" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-64" align="start" sideOffset={6}>
              <DropdownMenuItem
                onClick={() => setViewMode("overview")}
                className="flex items-center justify-between cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold truncate">All Organizations Overview</span>
                </div>
                {viewMode === "overview" && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Switch Organization
              </DropdownMenuLabel>

              <DropdownMenuGroup>
                {orgs && orgs.length > 0 ? (
                  orgs.map((org) => {
                    const isSelected = viewMode === "detail" && activeOrg?.id === org.id;
                    return (
                      <DropdownMenuItem
                        key={org.id}
                        onClick={() => void handleSwitchOrg(org.id, org.name)}
                        className="flex items-center justify-between cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{org.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No organizations found
                  </div>
                )}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setCreateDialogOpen(true)}
                className="cursor-pointer text-xs justify-between"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-primary">New Organization</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {viewMode === "detail" && isOwner && (
            <Badge variant="secondary" className="text-[10px] font-medium">
              Owner
            </Badge>
          )}
        </div>

        {/* Right header actions */}
        <div className="flex items-center gap-2">
          {viewMode === "detail" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("overview")}
              className="text-xs gap-1.5 h-8"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>All Organizations</span>
            </Button>
          ) : activeOrg ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("detail")}
              className="text-xs gap-1.5 h-8"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Current: {activeOrg.name}</span>
            </Button>
          ) : null}

          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="text-xs gap-1.5 h-8 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Organization</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: All Organizations Summary Grid                               */}
      {/* ========================================================================= */}
      {viewMode === "overview" && (
        <OrgSummaryGrid
          onSelectOrg={(orgId) => {
            setViewMode("detail");
          }}
          onOpenBilling={(orgId) => {
            setActiveTab("billing");
            setViewMode("detail");
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 2: Selected Organization Tabs View                              */}
      {/* ========================================================================= */}
      {viewMode === "detail" && activeOrg && orgItem && (
        <>
          {/* Global deletion countdown banner */}
          {isOwner && deletionStatus && activeTab !== "danger" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-center gap-3">
              <Clock className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive flex-1">
                <span className="font-semibold">
                  Deletion scheduled — {deletionStatus.daysRemaining} day{deletionStatus.daysRemaining !== 1 ? "s" : ""} remaining.
                </span>{" "}
                Cancel in the{" "}
                <button
                  className="underline underline-offset-2 hover:opacity-80"
                  onClick={() => setActiveTab("danger")}
                >
                  Danger Zone
                </button>{" "}
                tab before{" "}
                {new Date(deletionStatus.deleteAfter).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                .
              </p>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-7 text-[11px] border-destructive/40 text-destructive hover:bg-destructive/10 gap-1"
                onClick={handleCancelDeletion}
                disabled={cancelling}
              >
                {cancelling ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                Cancel
              </Button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="border-b border-border">
            <nav className="flex gap-0 -mb-px overflow-x-auto">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDanger = tab.id === "danger";
                return (
                  <button
                    key={tab.id}
                    id={`org-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                      isActive
                        ? isDanger
                          ? "border-destructive text-destructive"
                          : "border-primary text-foreground"
                        : isDanger
                          ? "border-transparent text-muted-foreground hover:text-destructive hover:border-destructive/30"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.id === "danger" && deletionStatus && (
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive ml-0.5" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab content */}
          <div>
            {activeTab === "general" && (
              <GeneralTab
                orgId={activeOrg.id}
                orgName={activeOrg.name}
                orgSlug={activeOrg.slug}
                seatStatus={seatStatus}
                createdAt={activeOrg.createdAt ?? null}
              />
            )}
            {isOwner && activeTab === "members" && (
              <MembersTab activeOrg={orgItem} seatStatus={seatStatus} />
            )}
            {isOwner && activeTab === "billing" && (
              <BillingTab activeOrg={orgItem} seatStatus={seatStatus} />
            )}
            {isOwner && activeTab === "danger" && (
              <DangerTab activeOrg={orgItem} seatStatus={seatStatus} />
            )}
          </div>
        </>
      )}

      {/* Global Create Org Dialog */}
      <CreateOrgDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        existingOrgsCount={orgs?.length || 0}
        onCreated={(newOrg) => {
          void refetchOrgs();
          void handleSwitchOrg(newOrg.id, newOrg.name);
        }}
      />
    </div>
  );
}

export default function OrganizationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 w-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <OrganizationPageContent />
    </Suspense>
  );
}
