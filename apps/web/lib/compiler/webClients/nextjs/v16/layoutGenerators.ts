import { PageInfo } from "./types";
import { CompiledFile, BackendNode, WebAppZone, ServerGuardConfig } from "@workspace/canvas/types";
import { slugToComponentName } from "./slugUtils";

export function generateRootLayout(
  projectName: string,
  pagesNavLinks?: string,
  showNav: boolean = false,
  hasProviders: boolean = false,
): string {
  const navBar = showNav && pagesNavLinks && pagesNavLinks.trim().length > 0
    ? `\n        <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-bold text-foreground flex items-center gap-2 text-sm hover:opacity-90 transition-opacity">
              <span>${projectName}</span>
            </Link>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              ${pagesNavLinks}
            </div>
          </div>
        </nav>`
    : "";

  const providersImport = hasProviders ? `\nimport { AppProviders } from "./providers";` : "";
  const childrenJsx = hasProviders
    ? `<AppProviders>{children}</AppProviders>`
    : `{children}`;

  return `import type { Metadata } from "next";${showNav && pagesNavLinks ? `\nimport Link from "next/link";` : ""}${providersImport}
import "@workspace/ui/globals.css";

export const metadata: Metadata = {
  title: "${projectName}",
  description: "${projectName} generated with Dezign2App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen antialiased flex flex-col font-sans">${navBar}
        <div className="flex-1">
          ${childrenJsx}
        </div>
      </body>
    </html>
  );
}
`;
}

export function generateSectionLayout(
  groupName: string,
  isAuthConnected: boolean = true,
  layoutDescription?: string,
  zone?: WebAppZone,
): string {
  const isPublic = groupName === "public";
  const componentName = slugToComponentName(groupName).replace(/Page$/, "") + "Layout";
  const descriptionDoc = layoutDescription
    ? `\n/**\n * Layout Specification:\n * ${layoutDescription.replace(/\n/g, "\n * ")}\n */`
    : "";

  if (isPublic || !isAuthConnected) {
    return `import React from "react";
${descriptionDoc}
export default function ${componentName}({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex-1">{children}</div>
    </div>
  );
}
`;
  }

  const failRedirect =
    zone?.rule?.redirects?.["wrong-role"] ||
    zone?.rule?.redirects?.["wrong-plan"] ||
    zone?.rule?.redirects?.["no-access"] ||
    zone?.rule?.redirects?.["no-auth"] ||
    zone?.rule?.redirects?.["default"] ||
    "/login";

  return `import React from "react";
${descriptionDoc}
/**
 * Next.js Protected Section Layout
 * Tier 2 Validation: Deep session verification via requireSession() helper
 */
export default async function ${componentName}({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const { requireSession } = await import("@/lib/auth/require-session");
    await requireSession("${failRedirect}");
  } catch (err) {
    if (
      Boolean(err) &&
      typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      String(err.digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const { redirect } = await import("next/navigation");
    redirect("${failRedirect}");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex-1">{children}</div>
    </div>
  );
}
`;
}

/**
 * Generates a server-side DB-check layout.tsx for a server-guard zone.
 * Runs in the Node.js runtime (not Edge) — can call DB functions directly.
 */
export function generateServerGuardLayout(
  groupName: string,
  guard: ServerGuardConfig,
  layoutDescription?: string,
): string {
  const componentName = slugToComponentName(groupName).replace(/Page$/, "") + "Layout";
  const entityLabel = guard.entityLabel || "Entity";
  const failRedirect = guard.failRedirect || "/unauthorized";
  const requireSession = guard.requireSession !== false;
  const headerName = guard.headerName || "x-api-key";

  const descriptionDoc = layoutDescription
    ? `\n/**\n * Layout Specification:\n * ${layoutDescription.replace(/\n/g, "\n * ")}\n */`
    : "";

  const sessionImport = requireSession ? `import { auth } from "@/lib/auth";\n` : "";

  const sessionBlock = requireSession
    ? `  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");\n`
    : "";

  let paramExpr: string;
  if (guard.param === "userId") {
    paramExpr = requireSession
      ? "session.user.id"
      : `"" /* ⚠ param=userId requires a session — enable requireSession or switch param */`;
  } else if (guard.param === "sessionToken") {
    paramExpr = requireSession
      ? "session.token"
      : `"" /* ⚠ param=sessionToken requires a session — enable requireSession or switch param */`;
  } else {
    paramExpr = `(await headers()).get("${headerName}") ?? ""`;
  }

  let guardBlock: string;
  if (guard.checkMode === "dbFunction") {
    const fnName = guard.dbFunctionName || guard.dbFunctionId || "checkAccess";
    guardBlock = `  // Server guard: ${fnName}() on ${entityLabel}
  const guardOk = await db.${entityLabel}.${fnName}(${paramExpr});
  if (!guardOk) redirect("${failRedirect}");\n`;
  } else {
    const fieldName = guard.entityField || "isActive";
    const expected = JSON.stringify(guard.entityFieldExpectedValue ?? "true");
    guardBlock = `  // Server guard: ${entityLabel}.${fieldName} === ${expected}
  const record = await db.${entityLabel}.findByUserId(${paramExpr});
  if (record?.${fieldName} !== ${expected}) redirect("${failRedirect}");\n`;
  }

  return `import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@workspace/db";
${sessionImport}${descriptionDoc}
/**
 * Next.js Server Guard Layout — ${groupName}
 * Runs a real DB check on every request (Node.js runtime, not Edge).
 * Generated by Dezign2App — do not edit manually.
 */
export default async function ${componentName}({
  children,
}: {
  children: React.ReactNode;
}) {
${sessionBlock}${guardBlock}
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex-1">{children}</div>
    </div>
  );
}
`;
}

/**
 * Generates section layout files for all route groups present in pagesInfo
 */
export function generateRouteGroupLayouts(
  pagesInfo: PageInfo[],
  isAuthConnected: boolean = true,
  webAppNode?: BackendNode,
): CompiledFile[] {
  const files: CompiledFile[] = [];
  const zones: WebAppZone[] = Array.isArray(webAppNode?.data?.zones)
    ? webAppNode.data.zones
    : [];

  // Collect all unique route group folder paths across pages
  // e.g. "(private)", "(private)/(subscribed)", "(public)"
  const prefixMap = new Map<string, { folderPath: string; leafGroup: string }>();

  pagesInfo.forEach((p) => {
    if (p.routeGroupHierarchy && p.routeGroupHierarchy.length > 0) {
      for (let i = 1; i <= p.routeGroupHierarchy.length; i++) {
        const subHierarchy = p.routeGroupHierarchy.slice(0, i);
        const folderPath = subHierarchy.map((g) => `(${g})`).join("/");
        const leafGroup = subHierarchy[subHierarchy.length - 1] ?? "public";
        prefixMap.set(folderPath, { folderPath, leafGroup });
      }
    } else {
      const g = p.routeGroup || "public";
      prefixMap.set(`(${g})`, { folderPath: `(${g})`, leafGroup: g });
    }
  });

  if (prefixMap.size === 0) {
    prefixMap.set("(public)", { folderPath: "(public)", leafGroup: "public" });
  }

  prefixMap.forEach(({ folderPath, leafGroup }) => {
    const matchedZone = zones.find(
      (z) =>
        z.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === leafGroup ||
        (leafGroup === "public" && (z.id === "zone-public" || z.accessType === "public")) ||
        (leafGroup === "private" && (z.id === "zone-private" || z.accessType === "protected")),
    );

    // If zone explicitly has layout disabled, skip generating layout.tsx
    if (matchedZone && matchedZone.hasLayout === false) {
      return;
    }

    // Server-guard zones get a DB-check layout instead of the JWT requireSession() layout
    if (
      matchedZone?.protectionMode === "server-guard" &&
      matchedZone.serverGuard?.entityNodeId
    ) {
      files.push({
        filename: `app/${folderPath}/layout.tsx`,
        language: "typescript",
        content: generateServerGuardLayout(
          leafGroup,
          matchedZone.serverGuard,
          matchedZone.layoutDescription,
        ),
      });
      return; // don't fall through to generateSectionLayout
    }

    // Default: JWT-based middleware + requireSession() layout
    files.push({
      filename: `app/${folderPath}/layout.tsx`,
      language: "typescript",
      content: generateSectionLayout(
        leafGroup,
        isAuthConnected,
        matchedZone?.layoutDescription,
        matchedZone,
      ),
    });
  });

  return files;
}
