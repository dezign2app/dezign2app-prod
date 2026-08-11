import React from "react";
import { SlidersHorizontal, ChevronDown, ChevronRight, Trash2, ShieldCheck } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ConditionPrimitive, SessionClaimConfig } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";

interface AccessConditionsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  leaves: ConditionPrimitive[];
  connectedPages: BackendNode[];
  authClaims?: SessionClaimConfig[];
  authNodeLabel?: string;
  isAuthConnected?: boolean;
  onAddCondition: (type: ConditionPrimitive["type"], customKey?: string) => void;
  onRemoveCondition: (index: number) => void;
}

export const AccessConditionsSection = ({
  isOpen,
  onToggle,
  leaves,
  connectedPages,
  authClaims = [],
  authNodeLabel,
  isAuthConnected = false,
  onAddCondition,
  onRemoveCondition,
}: AccessConditionsSectionProps) => {
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
          {/* Configured Auth Claims Banner */}
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                  Configured Auth Claims
                </span>
                {isAuthConnected && authNodeLabel && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-mono">
                    {authNodeLabel}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {authClaims.length} {authClaims.length === 1 ? "claim" : "claims"} configured
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-1">
              {authClaims.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                  No claims configured in AuthNode.
                </span>
              ) : (
                authClaims.map((claim) => {
                  const delivery = claim.deliveryMode || claim.destination || "jwt";
                  return (
                    <button
                      key={claim.key}
                      onClick={() => {
                        if (claim.key === "orgRole") onAddCondition("orgRole");
                        else if (claim.key === "subscriptionStatus") onAddCondition("subscriptionStatus");
                        else if (claim.key === "planId" || claim.key === "plan") onAddCondition("plan");
                        else onAddCondition("customClaim", claim.key);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-background hover:bg-indigo-500/10 text-foreground font-mono text-xs border border-indigo-500/30 transition-colors group cursor-pointer"
                      title={`Click to add condition for claim '${claim.key}' (${delivery})`}
                    >
                      <span className="font-medium text-indigo-500 dark:text-indigo-400">{claim.key}</span>
                      <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                        {delivery}
                      </span>
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                        +
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

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
                <SelectItem value="org" className="text-xs">Org Required</SelectItem>
                <SelectItem value="orgRole" className="text-xs">Org Role (Owner/Admin)</SelectItem>
                <SelectItem value="access" className="text-xs">Creem Payments Access</SelectItem>
                <SelectItem value="subscriptionStatus" className="text-xs">Subscription Status</SelectItem>
                <SelectItem value="plan" className="text-xs">Plan Tier</SelectItem>
                <SelectItem value="customClaim" className="text-xs">Custom Claim</SelectItem>

                {authClaims.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase border-t border-border mt-1">
                      Auth Node Claims
                    </div>
                    {authClaims.map((claim) => (
                      <SelectItem key={`claim-${claim.key}`} value={`claim:${claim.key}`} className="text-xs font-mono">
                        Claim: {claim.key}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            {leaves.map((leaf, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50 text-xs shadow-xs"
              >
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-semibold text-indigo-400 uppercase">{leaf.type}</span>
                  <span className="text-muted-foreground">{"->"}</span>
                  <span className="text-foreground">
                    {leaf.type === "auth" && `auth.${leaf.op}`}
                    {leaf.type === "org" && `org.${leaf.op}`}
                    {leaf.type === "orgRole" && `orgRole ${leaf.op} [${leaf.values.join(", ")}]`}
                    {leaf.type === "access" && `access.${leaf.op} (Creem billing cycle)`}
                    {leaf.type === "subscriptionStatus" && `status ${leaf.op} [${leaf.values.join(", ")}]`}
                    {leaf.type === "plan" && `plan ${leaf.op} [${leaf.values.join(", ")}]`}
                    {leaf.type === "customClaim" && `claim[${leaf.key}] ${leaf.op}`}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveCondition(idx)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
            <Label className="text-xs text-muted-foreground font-medium">
              Connected WebClient Pages ({connectedPages.length})
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {connectedPages.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                  No WebClient pages connected to this zone handle yet.
                </span>
              ) : (
                connectedPages.map((p) => (
                  <span
                    key={p.id}
                    className="px-2 py-0.5 rounded bg-background text-foreground font-mono text-xs border border-border"
                  >
                    {p.data?.label || "Page"}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
