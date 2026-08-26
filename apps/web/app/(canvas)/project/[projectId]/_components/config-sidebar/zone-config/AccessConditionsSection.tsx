import React from "react";
import { SlidersHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ConditionPrimitive, SubscriptionStatus } from "@workspace/canvas";
import { AccessConditionsSectionProps } from "./access-conditions/types";
import {
  getClaimColumnInfo,
  getClaimKey,
  getNormalizedOp,
  getLeafValues,
  getLeafSingleVal,
} from "./access-conditions/utils";
import { ConfiguredClaimsBanner } from "./access-conditions/ConfiguredClaimsBanner";
import { ConditionCard } from "./access-conditions/ConditionCard";
import { ConnectedPagesList } from "./access-conditions/ConnectedPagesList";

const VALID_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "expired",
];

const isSubscriptionStatus = (v: string): v is SubscriptionStatus =>
  VALID_SUBSCRIPTION_STATUSES.includes(v as SubscriptionStatus);

const filterSubscriptionStatuses = (vals: string[]): SubscriptionStatus[] =>
  vals.filter(isSubscriptionStatus);

export const AccessConditionsSection = ({
  isOpen,
  onToggle,
  leaves,
  connectedPages,
  authClaims = [],
  authNodeLabel,
  isAuthConnected = false,
  allNodes = [],
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
}: AccessConditionsSectionProps) => {
  // Handle changing claim selection on a leaf condition
  const handleClaimChange = (idx: number, newClaimKey: string) => {
    if (!onUpdateCondition) return;
    const currentLeaf = leaves[idx];
    if (!currentLeaf) return;

    const colInfo = getClaimColumnInfo(newClaimKey, authClaims, allNodes);
    const existingVals = getLeafValues(currentLeaf);
    const defaultVals =
      existingVals.length > 0
        ? existingVals
        : colInfo.enumValues && colInfo.enumValues.length > 0
        ? [colInfo.enumValues[0]!]
        : [];

    if (newClaimKey === "auth") {
      onUpdateCondition(idx, { type: "auth", op: "signedIn" });
    } else if (newClaimKey === "orgRole") {
      onUpdateCondition(idx, {
        type: "orgRole",
        op: "in",
        values: defaultVals,
      });
    } else if (newClaimKey === "subscriptionStatus") {
      onUpdateCondition(idx, {
        type: "subscriptionStatus",
        op: "statusIn",
        values: filterSubscriptionStatuses(defaultVals),
      });
    } else if (newClaimKey === "planId" || newClaimKey === "plan") {
      onUpdateCondition(idx, {
        type: "plan",
        op: "in",
        values: defaultVals,
      });
    } else if (newClaimKey === "org") {
      onUpdateCondition(idx, { type: "org", op: "required" });
    } else if (newClaimKey === "access") {
      onUpdateCondition(idx, { type: "access", op: "granted" });
    } else {
      onUpdateCondition(idx, {
        type: "customClaim",
        key: newClaimKey,
        op: "in",
        values: defaultVals,
      });
    }
  };

  // Handle changing operator on a leaf condition
  const handleOperatorChange = (idx: number, leaf: ConditionPrimitive, newOp: string) => {
    if (!onUpdateCondition) return;
    const claimKey = getClaimKey(leaf);
    const values = getLeafValues(leaf);
    const singleVal = getLeafSingleVal(leaf);
    const colInfo = getClaimColumnInfo(claimKey, authClaims, allNodes);
    const fallbackVals = values.length ? values : colInfo.enumValues || [];

    if (leaf.type === "auth") {
      onUpdateCondition(idx, { type: "auth", op: newOp === "signedOut" ? "signedOut" : "signedIn" });
      return;
    }

    if (claimKey === "orgRole") {
      onUpdateCondition(idx, {
        type: "orgRole",
        op: newOp === "notIn" ? "notIn" : "in",
        values: fallbackVals,
      });
      return;
    }

    if (claimKey === "subscriptionStatus") {
      onUpdateCondition(idx, {
        type: "subscriptionStatus",
        op: newOp === "notIn" ? "statusNotIn" : "statusIn",
        values: filterSubscriptionStatuses(fallbackVals),
      });
      return;
    }

    if (claimKey === "planId" || claimKey === "plan") {
      onUpdateCondition(idx, {
        type: "plan",
        op: newOp === "notIn" ? "notIn" : "in",
        values: fallbackVals,
      });
      return;
    }

    if (newOp === "in" || newOp === "notIn") {
      onUpdateCondition(idx, {
        type: "customClaim",
        key: claimKey,
        op: newOp,
        values: fallbackVals,
      });
    } else if (newOp === "eq" || newOp === "neq") {
      onUpdateCondition(idx, {
        type: "customClaim",
        key: claimKey,
        op: newOp,
        value: singleVal || (colInfo.enumValues && colInfo.enumValues[0]) || "",
      });
    } else {
      onUpdateCondition(idx, {
        type: "customClaim",
        key: claimKey,
        op: newOp as "truthy" | "falsy",
      });
    }
  };

  // Handle values text change (comma separated)
  const handleValuesChange = (idx: number, leaf: ConditionPrimitive, text: string) => {
    if (!onUpdateCondition) return;
    const parsedValues = text
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const claimKey = getClaimKey(leaf);
    const currentNormalizedOp = getNormalizedOp(leaf);

    if (claimKey === "orgRole") {
      onUpdateCondition(idx, {
        type: "orgRole",
        op: currentNormalizedOp === "notIn" ? "notIn" : "in",
        values: parsedValues,
      });
    } else if (claimKey === "subscriptionStatus") {
      onUpdateCondition(idx, {
        type: "subscriptionStatus",
        op: currentNormalizedOp === "notIn" ? "statusNotIn" : "statusIn",
        values: filterSubscriptionStatuses(parsedValues),
      });
    } else if (claimKey === "planId" || claimKey === "plan") {
      onUpdateCondition(idx, {
        type: "plan",
        op: currentNormalizedOp === "notIn" ? "notIn" : "in",
        values: parsedValues,
      });
    } else {
      const op: "in" | "notIn" = currentNormalizedOp === "notIn" ? "notIn" : "in";
      onUpdateCondition(idx, {
        type: "customClaim",
        key: claimKey,
        op,
        values: parsedValues,
      });
    }
  };

  // Handle single scalar value change
  const handleSingleValChange = (idx: number, leaf: ConditionPrimitive, val: string) => {
    if (!onUpdateCondition) return;
    const claimKey = getClaimKey(leaf);
    const currentNormalizedOp = getNormalizedOp(leaf);
    const op: "eq" | "neq" = currentNormalizedOp === "neq" ? "neq" : "eq";

    onUpdateCondition(idx, {
      type: "customClaim",
      key: claimKey,
      op,
      value: val,
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer nodrag"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Access Conditions
          </span>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {leaves.length} {leaves.length === 1 ? "rule" : "rules"}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col gap-4 pt-2 border-t border-border/50">
          <ConfiguredClaimsBanner
            authClaims={authClaims}
            authNodeLabel={authNodeLabel}
            isAuthConnected={isAuthConnected}
            onAddCondition={onAddCondition}
          />

          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground font-medium">
              Condition Group (AND Evaluation)
            </Label>

            <Select
              onValueChange={(val) => {
                if (val.startsWith("claim:")) {
                  const claimKey = val.replace("claim:", "");
                  if (claimKey === "orgRole") onAddCondition("orgRole");
                  else if (claimKey === "subscriptionStatus") onAddCondition("subscriptionStatus");
                  else if (claimKey === "planId" || claimKey === "plan") onAddCondition("plan");
                  else onAddCondition("customClaim", claimKey);
                } else {
                  onAddCondition(val as ConditionPrimitive["type"]);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs w-[170px] bg-background">
                <SelectValue placeholder="+ Add Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auth" className="text-xs">Signed In</SelectItem>

                {authClaims.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-indigo-400 uppercase border-b border-border mt-1">
                      Configured Auth Claims
                    </div>
                    {authClaims.map((claim) => (
                      <SelectItem key={`claim-${claim.key}`} value={`claim:${claim.key}`} className="text-xs font-mono">
                        Claim: {claim.key || claim.targetValue}
                      </SelectItem>
                    ))}
                  </>
                )}

                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase border-t border-border mt-1">
                  Preset Rules
                </div>
                <SelectItem value="org" className="text-xs">Org Required</SelectItem>
                <SelectItem value="orgRole" className="text-xs">Org Role (Owner/Admin)</SelectItem>
                <SelectItem value="access" className="text-xs">Creem Payments Access</SelectItem>
                <SelectItem value="subscriptionStatus" className="text-xs">Subscription Status</SelectItem>
                <SelectItem value="plan" className="text-xs">Plan Tier</SelectItem>
                <SelectItem value="customClaim" className="text-xs">Custom Claim</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2.5">
            {leaves.map((leaf, idx) => (
              <ConditionCard
                key={idx}
                idx={idx}
                leaf={leaf}
                authClaims={authClaims}
                allNodes={allNodes}
                onRemoveCondition={onRemoveCondition}
                onUpdateCondition={onUpdateCondition}
                onClaimChange={handleClaimChange}
                onOperatorChange={handleOperatorChange}
                onValuesChange={handleValuesChange}
                onSingleValChange={handleSingleValChange}
              />
            ))}
          </div>

          <ConnectedPagesList connectedPages={connectedPages} />
        </div>
      )}
    </div>
  );
};
