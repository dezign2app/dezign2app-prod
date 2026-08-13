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
  const generateLeafCode = (leaf: ConditionPrimitive): string => {
    if (leaf.type === "auth") {
      if (leaf.op === "signedOut") {
        return `  if (claims.userId) return { allowed: false, redirect: "${rule.redirects?.["no-auth"] || "/login"}" };`;
      }
      return `  if (!claims.userId) return { allowed: false, redirect: "${rule.redirects?.["no-auth"] || "/login"}" };`;
    }

    if (leaf.type === "orgRole") {
      const vals = (leaf.values || ["owner", "admin"]).map((v) => `"${v}"`).join(", ");
      const isNotIn = leaf.op === "notIn";
      return `  if (!claims.orgRole || ${isNotIn ? "" : "!"}[${vals}].includes(claims.orgRole)) return { allowed: false, redirect: "${rule.redirects?.["wrong-role"] || "/unauthorized"}" };`;
    }

    if (leaf.type === "plan") {
      const vals = (leaf.values || ["pro", "enterprise"]).map((v) => `"${v}"`).join(", ");
      const isNotIn = leaf.op === "notIn";
      return `  if (!claims.planId || ${isNotIn ? "" : "!"}[${vals}].includes(claims.planId)) return { allowed: false, redirect: "${rule.redirects?.["wrong-plan"] || "/pricing"}" };`;
    }

    if (leaf.type === "subscriptionStatus") {
      const vals = (leaf.values || ["active", "trialing"]).map((v) => `"${v}"`).join(", ");
      const isNotIn = leaf.op === "statusNotIn";
      return `  if (!claims.subscriptionStatus || ${isNotIn ? "" : "!"}[${vals}].includes(claims.subscriptionStatus)) return { allowed: false, redirect: "${rule.redirects?.["no-access"] || "/pricing"}" };`;
    }

    if (leaf.type === "access") {
      const notGranted = leaf.op === "notGranted";
      return `  if (${notGranted ? "claims.hasAccess" : "!claims.hasAccess"}) return { allowed: false, redirect: "${rule.redirects?.["no-access"] || "/pricing"}" };`;
    }

    if (leaf.type === "org") {
      return `  if (!claims.orgId) return { allowed: false, redirect: "${rule.redirects?.["no-org"] || "/select-org"}" };`;
    }

    if (leaf.type === "customClaim") {
      const key = leaf.key;
      if (leaf.op === "in" || leaf.op === "notIn") {
        const vals = ((leaf.values && leaf.values.length > 0) ? leaf.values : [String(leaf.value ?? "active")]).map((v) => `"${v}"`).join(", ");
        const isNotIn = leaf.op === "notIn";
        return `  if (!claims["${key}"] || ${isNotIn ? "" : "!"}[${vals}].includes(String(claims["${key}"]))) return { allowed: false, redirect: "${rule.redirects?.default || "/login"}" };`;
      }
      if (leaf.op === "eq") {
        return `  if (claims["${key}"] !== "${leaf.value || ""}") return { allowed: false, redirect: "${rule.redirects?.default || "/login"}" };`;
      }
      if (leaf.op === "neq") {
        return `  if (claims["${key}"] === "${leaf.value || ""}") return { allowed: false, redirect: "${rule.redirects?.default || "/login"}" };`;
      }
      if (leaf.op === "truthy") {
        return `  if (!claims["${key}"]) return { allowed: false, redirect: "${rule.redirects?.default || "/login"}" };`;
      }
      if (leaf.op === "falsy") {
        return `  if (claims["${key}"]) return { allowed: false, redirect: "${rule.redirects?.default || "/login"}" };`;
      }
    }
    return "";
  };

  const codeLines = leaves.map(generateLeafCode).filter(Boolean);

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
${codeLines.length > 0 ? codeLines.join("\n") + "\n" : '  if (!claims.userId) return { allowed: false, redirect: "/login" };\n'}  return { allowed: true };
}`}
          </pre>
        </div>
      )}
    </div>
  );
};
