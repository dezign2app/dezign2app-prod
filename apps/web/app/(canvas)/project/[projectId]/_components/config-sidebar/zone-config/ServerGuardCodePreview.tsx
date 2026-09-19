import React from "react";
import { Code2, ChevronDown, ChevronRight, Copy, CheckCheck } from "lucide-react";
import { ServerGuardConfig } from "@workspace/canvas";
import { useState } from "react";

interface ServerGuardCodePreviewProps {
  isOpen: boolean;
  onToggle: () => void;
  guard: ServerGuardConfig | undefined;
  zoneName: string;
  /** The web app monorepo slug (e.g. "customer-portal") */
  appSlug?: string;
}

function buildLayoutCode(guard: ServerGuardConfig, zoneName: string, appSlug: string): string {
  const entityLabel = guard.entityLabel ?? "Entity";
  const fnName = guard.dbFunctionName ?? guard.dbFunctionId ?? "checkAccess";
  const fieldName = guard.entityField ?? "isActive";
  const expectedVal = guard.entityFieldExpectedValue ?? "true";
  const failRedirect = guard.failRedirect || "/unauthorized";
  const headerName = guard.headerName ?? "x-api-key";
  const requireSession = guard.requireSession !== false;

  const sessionImport = requireSession
    ? `import { auth } from "@/lib/auth";`
    : "";

  const sessionBlock = requireSession
    ? `
  // 1. Verify session
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
`
    : `
  // No session required — guard runs independently
`;

  let paramExpr = "";
  if (guard.param === "userId") {
    paramExpr = requireSession ? "session.user.id" : '""  // ⚠ userId needs a session';
  } else if (guard.param === "sessionToken") {
    paramExpr = requireSession ? "session.token" : '""  // ⚠ sessionToken needs a session';
  } else if (guard.param === "header") {
    paramExpr = `(await headers()).get("${headerName}") ?? ""`;
  }

  const guardBlock =
    guard.checkMode === "dbFunction"
      ? `
  // 2. Server guard: call ${fnName} on ${entityLabel}
  const guardResult = await db.${entityLabel}.${fnName}(${paramExpr});
  if (!guardResult) redirect("${failRedirect}");
`
      : `
  // 2. Server guard: check ${entityLabel}.${fieldName} === ${JSON.stringify(expectedVal)}
  const record = await db.${entityLabel}.findByUserId(${paramExpr});
  if (record?.${fieldName} !== ${JSON.stringify(expectedVal)}) redirect("${failRedirect}");
`;

  return `// apps/${appSlug}/app/(${zoneName.toLowerCase().replace(/\s+/g, "-")})/layout.tsx
// Auto-generated: Server Guard — ${zoneName}
// This file runs on the server (Node.js runtime) and is NOT Edge-compatible.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@workspace/db";
${sessionImport}
${sessionBlock.trimEnd()}

export default async function ${zoneName.replace(/\s+/g, "")}Layout({
  children,
}: {
  children: React.ReactNode;
}) {${sessionBlock}${guardBlock}
  return <>{children}</>;
}`;
}

export const ServerGuardCodePreview = ({
  isOpen,
  onToggle,
  guard,
  zoneName,
  appSlug = "web-app",
}: ServerGuardCodePreviewProps) => {
  const [copied, setCopied] = useState(false);

  const isReady =
    !!guard?.entityNodeId &&
    (guard.checkMode === "dbFunction" ? !!guard.dbFunctionId : !!guard.entityField);

  const code = isReady && guard ? buildLayoutCode(guard, zoneName, appSlug) : null;

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer nodrag"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Generated layout.tsx
          </span>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Server Guard
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isReady && code && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          {!isReady ? (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/40 text-[11px] text-muted-foreground">
              Configure the Server Guard above to see the generated layout code.
            </div>
          ) : (
            <>
              <div className="text-[11px] text-muted-foreground">
                Place this file at{" "}
                <code className="font-mono text-amber-300/80 bg-amber-500/10 px-1 py-0.5 rounded">
                  apps/{appSlug}/app/(zone)/layout.tsx
                </code>
                {" "}to protect all pages in this zone.
              </div>
              <div className="relative rounded-lg overflow-hidden border border-border/40">
                <div className="absolute top-0 left-0 right-0 h-7 bg-muted/60 border-b border-border/40 flex items-center px-3 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground ml-1">layout.tsx</span>
                </div>
                <pre className="pt-8 pb-4 px-4 text-[10.5px] font-mono leading-relaxed overflow-x-auto bg-background/60 text-foreground/80 whitespace-pre">
                  {code}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
