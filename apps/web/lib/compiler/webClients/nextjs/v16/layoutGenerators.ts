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
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased flex flex-col font-sans">
        <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-bold text-white flex items-center gap-2 text-sm hover:opacity-90 transition-opacity">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Web Client App</span>
            </Link>
            <div className="flex items-center gap-4 text-xs text-slate-300">
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
  const badgeColor = isPublic
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
  const sectionTitle = groupName.charAt(0).toUpperCase() + groupName.slice(1);

  return `import React from "react";
import { Badge } from "@workspace/ui/components/badge";

export default function ${slugToComponentName(groupName)}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-900/40 px-6 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="${badgeColor}">
            (${groupName}) ${sectionTitle} Section
          </Badge>
          <span className="text-slate-400">
            Next.js App Router Route Group Layout
          </span>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
`;
}

export function generatePageLayout(pageSlug: string): string {
  return `import React from "react";

export default function ${slugToComponentName(pageSlug)}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full flex flex-col flex-1">
      {children}
    </div>
  );
}
`;
}
