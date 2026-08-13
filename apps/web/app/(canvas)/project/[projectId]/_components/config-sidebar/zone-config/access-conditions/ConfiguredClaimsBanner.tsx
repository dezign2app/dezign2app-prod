import React from "react";
import { ShieldCheck } from "lucide-react";
import { SessionClaimConfig, ConditionPrimitive } from "@workspace/canvas";

interface ConfiguredClaimsBannerProps {
  authClaims: SessionClaimConfig[];
  authNodeLabel?: string;
  isAuthConnected: boolean;
  onAddCondition: (type: ConditionPrimitive["type"], customKey?: string) => void;
}

export const ConfiguredClaimsBanner: React.FC<ConfiguredClaimsBannerProps> = ({
  authClaims,
  authNodeLabel,
  isAuthConnected,
  onAddCondition,
}) => {
  return (
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
            const displayLabel = claim.key || claim.targetValue;
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
                title={`Click to add condition for claim '${displayLabel}' (${delivery})`}
              >
                <span className="font-medium text-indigo-500 dark:text-indigo-400">{displayLabel}</span>
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
  );
};
