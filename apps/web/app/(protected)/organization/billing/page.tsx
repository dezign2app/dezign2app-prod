"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useActiveOrganization, useSession } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import {
  CreditCard,
  Building2,
  Users,
  Zap,
  Calendar,
  ArrowLeft,
  ChevronRight,
  Shield,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@workspace/ui/components/card";
import { BuySeatsDialog } from "@/components/auth/org/buy-seats-dialog";

const STATUS_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  active: {
    label: "Active Plan",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    desc: "Your organization has active access to the visual compiler, AI architecture tools, and team canvas.",
  },
  canceled: {
    label: "Subscription Canceled",
    color: "text-muted-foreground bg-muted border-border",
    desc: "The owner's subscription has been canceled. Renew to unlock project creation and editing.",
  },
  past_due: {
    label: "Past Due",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    desc: "Payment retry is in progress. Please update your payment method to prevent access interruption.",
  },
  expired: {
    label: "Expired",
    color: "text-destructive bg-destructive/10 border-destructive/20",
    desc: "Your organization plan has expired. Please renew your plan to continue modifying projects.",
  },
  trialing: {
    label: "Trial Active",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    desc: "You are currently in an active trial period.",
  },
  inactive: {
    label: "No Active Subscription",
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    desc: "An active plan from the organization owner is required to edit and compile team projects.",
  },
};

export default function OrganizationBillingPage() {
  const { data: session } = useSession();
  const { data: activeOrg, isPending: isOrgPending } = useActiveOrganization();
  const [buySeatsOpen, setBuySeatsOpen] = useState(false);

  const seatStatus = useQuery(
    api.billing.getOrgSeatStatus,
    activeOrg?.id ? { organizationId: activeOrg.id } : "skip",
  );

  const userEmail = session?.user?.email ?? "";
  const earlyBeliever = useQuery(
    api.billing.getUserEarlyBeliever,
    userEmail ? { email: userEmail } : "skip",
  );

  if (isOrgPending) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="container max-w-4xl py-16 px-4 text-center space-y-4">
        <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">No Organization Selected</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Please select an organization workspace to view its billing and seat configuration.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/organization?view=all">View All Organizations</Link>
        </Button>
      </div>
    );
  }

  const isOwner = seatStatus?.isOwner ?? false;
  const statusKey = seatStatus?.status || "inactive";
  const DEFAULT_STATUS_CONFIG = {
    label: "No Active Subscription",
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    desc: "An active plan from the organization owner is required to edit and compile team projects.",
  };
  const statusCfg = STATUS_CONFIG[statusKey] ?? DEFAULT_STATUS_CONFIG;

  const totalSeats = seatStatus?.totalSeats ?? 1;
  const usedSeats = seatStatus?.usedSeats ?? 1;
  const seatUsePct = Math.min(100, Math.round((usedSeats / totalSeats) * 100));

  const orgItem = { id: activeOrg.id, name: activeOrg.name, slug: activeOrg.slug };

  return (
    <div className="container max-w-4xl py-8 px-4 space-y-6 animate-in fade-in duration-300">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground">
          <Link href="/organization">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Organization Settings</span>
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link href="/organization?view=all">
            <span>Switch Organization</span>
          </Link>
        </Button>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground leading-tight">
                {activeOrg.name} Billing & Seats
              </h1>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusCfg.color}`}
              >
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Workspace /{activeOrg.slug} &bull; {isOwner ? "Owner View" : "Member View"}
            </p>
          </div>
        </div>

        {isOwner && (
          <Button
            size="sm"
            onClick={() => setBuySeatsOpen(true)}
            className="gap-1.5 text-xs shadow-sm shrink-0"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Add Seats</span>
          </Button>
        )}
      </div>

      {/* Plan Status Banner */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Subscription & Workspace Status</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-normal capitalize">
              {statusCfg.label}
            </Badge>
          </div>
          <CardDescription className="text-xs leading-relaxed mt-1">
            {statusCfg.desc}
          </CardDescription>
        </CardHeader>

        {!isOwner && (
          <CardContent className="pt-0 pb-4 text-xs text-muted-foreground">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              This organization workspace is administered by the owner. Only owners can purchase additional seats or modify subscription plans.
            </div>
          </CardContent>
        )}

        {isOwner && statusKey !== "active" && (
          <CardFooter className="pt-0 pb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <Button asChild size="sm" className="text-xs gap-1.5">
              <Link href="/pricing">
                <span>Renew Subscription on Pricing Page</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Seat Allocation Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Seat Allocation</h2>
            <p className="text-xs text-muted-foreground">
              Number of teammates who can actively access and collaborate in this workspace.
            </p>
          </div>
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBuySeatsOpen(true)}
              className="text-xs gap-1.5"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Buy Extra Seats</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 text-center border-border">
            <div className="text-2xl font-bold text-foreground">{seatStatus?.baseSeats ?? 1}</div>
            <div className="text-xs text-muted-foreground mt-1">Base Plan Seats</div>
          </Card>

          <Card className="p-4 text-center border-border">
            <div className="text-2xl font-bold text-foreground">{seatStatus?.extraSeats ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Additional Extra Seats</div>
          </Card>

          <Card className="p-4 text-center border-border bg-primary/5 border-primary/20">
            <div className="text-2xl font-bold text-primary">{totalSeats}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Team Capacity</div>
          </Card>
        </div>

        {/* Seat Usage Progress Bar */}
        <Card className="p-5 border-border space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Capacity Utilization</span>
            <span className="text-muted-foreground">
              {usedSeats} of {totalSeats} seats assigned ({seatUsePct}%)
            </span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${seatUsePct}%`,
                background:
                  seatUsePct >= 90
                    ? "hsl(var(--destructive))"
                    : seatUsePct >= 70
                      ? "hsl(38 92% 50%)"
                      : "hsl(var(--primary))",
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>{seatStatus?.availableSeats ?? 0} seats available for new invitations</span>
            <Link
              href="/organization?tab=members"
              className="text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>Manage Team Members</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Early Believer Card (if applicable) */}
      {earlyBeliever && (
        <Card className="border-primary/30 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Early Believer Benefits</h3>
            <Badge className="text-[10px] ml-auto">
              {earlyBeliever.discountPercent}% Lifetime Discount
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-primary/20 bg-background/50 p-3">
              <div className="text-sm font-bold text-foreground">{earlyBeliever.totalSeats}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Seats Included</div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-background/50 p-3">
              <div className="text-sm font-bold text-foreground">
                ${earlyBeliever.totalPaid.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Total Invested</div>
            </div>
          </div>

          {earlyBeliever.maxSubscriptionEnd > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Access valid until{" "}
                {new Date(earlyBeliever.maxSubscriptionEnd).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Buy Seats Dialog */}
      <BuySeatsDialog
        open={buySeatsOpen}
        onOpenChange={setBuySeatsOpen}
        activeOrg={orgItem}
        seatStatus={seatStatus ?? null}
      />
    </div>
  );
}
