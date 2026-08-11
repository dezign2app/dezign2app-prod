import React from "react";
import { Code2, ChevronDown, ChevronRight } from "lucide-react";
import { ConditionPrimitive, ProtectionRule, WebAppZone } from "@workspace/canvas";

interface MiddlewareCodePreviewSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  currentZone: WebAppZone;
  rule: ProtectionRule;
  leaves: ConditionPrimitive[];
}

export const MiddlewareCodePreviewSection = ({
  isOpen,
  onToggle,
  currentZone,
  rule,
  leaves,
}: MiddlewareCodePreviewSectionProps) => {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer nodrag"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Code Preview
          </span>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Generated Middleware
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground font-medium">
            Edge Middleware Evaluation Function
          </span>
          <pre className="p-3 bg-muted/80 rounded-lg text-[11px] font-mono border border-border/60 overflow-x-auto text-foreground">
{`// Evaluated deterministically in proxy.ts
export function evaluateZone_${currentZone.id.replace(/[^a-zA-Z0-9]/g, "_")}(claims: SessionClaims) {
  if (!claims.userId) return { allowed: false, redirect: "${rule.redirects?.["no-auth"] || "/login"}" };
${leaves.some((l) => l.type === "orgRole") ? `  if (!claims.orgRole || !["owner", "admin"].includes(claims.orgRole)) return { allowed: false, redirect: "${rule.redirects?.["wrong-role"] || "/unauthorized"}" };\n` : ""}${leaves.some((l) => l.type === "access") ? `  if (!claims.hasAccess) return { allowed: false, redirect: "${rule.redirects?.["no-access"] || "/pricing"}" };\n` : ""}  return { allowed: true };
}`}
          </pre>
        </div>
      )}
    </div>
  );
};
