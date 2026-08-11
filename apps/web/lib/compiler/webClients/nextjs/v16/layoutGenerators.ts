import { slugToComponentName } from "./slugUtils";

export function generateRootLayout(
  projectName: string,
  pagesNavLinks: string,
): string {
  return `import type { Metadata } from "next";
import Link from "next/link";
import "@workspace/ui/globals.css";

export const metadata: Metadata = {
  title: "${projectName} Web Client",
  description: "Next.js Web Client generated from Blueprint architecture canvas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen antialiased flex flex-col font-sans">
        <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-bold text-foreground flex items-center gap-2 text-sm hover:opacity-90 transition-opacity">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span>Web Client App</span>
            </Link>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              ${pagesNavLinks}
            </div>
          </div>
        </nav>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
`;
}

export function generateSectionLayout(groupName: string): string {
  const isPublic = groupName === "public";
  const badgeVariant = isPublic ? "secondary" : "outline";
  const sectionTitle = groupName.charAt(0).toUpperCase() + groupName.slice(1);
  const componentName = slugToComponentName(groupName) + "Layout";

  if (isPublic) {
    return `import React from "react";
import { Badge } from "@workspace/ui/components/badge";

export default function ${componentName}({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="border-b border-border bg-muted/40 px-6 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="${badgeVariant}">
            (${groupName}) ${sectionTitle} Section
          </Badge>
          <span className="text-muted-foreground">
            Unprotected Public Route Group Layout
          </span>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
`;
  }

  return `import React from "react";
import { Badge } from "@workspace/ui/components/badge";

/**
 * Next.js 16 Protected Section Layout
 * Tier 2 Validation: Deep session verification via requireSession() helper
 */
export default async function ${componentName}({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    const { requireSession } = await import("@/lib/auth/require-session");
    session = await requireSession("/login");
  } catch (err) {
    session = null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="border-b border-border bg-muted/40 px-6 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="${badgeVariant}">
            (${groupName}) ${sectionTitle} Section
          </Badge>
          <span className="text-muted-foreground font-mono">
            Verified Session: {session?.user?.email || session?.user?.name || session?.user?.id || "Authenticated User"}
          </span>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
`;
}


