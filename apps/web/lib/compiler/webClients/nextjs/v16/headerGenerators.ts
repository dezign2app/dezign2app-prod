import { PageInfo } from "./types";

export function generatePageHeaderComponent(
  pageMeta: PageInfo,
): string {
  const compName = `${pageMeta.componentName}Header`;
  return `"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@workspace/ui/components/badge";

export function ${compName}() {
  return (
    <header className="border-b border-border pb-6 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">${pageMeta.label}</h1>
          <Badge variant="outline">
            Next.js Page
          </Badge>
          <Badge variant="secondary">
            ${pageMeta.accessType ? pageMeta.accessType.toUpperCase() : "PUBLIC"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          ${pageMeta.description || "Interactive Next.js page generated for WebClient canvas node."}
        </p>
      </div>
      <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium border border-border px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted">
        &larr; Back to Index
      </Link>
    </header>
  );
}

export default ${compName};
`;
}

export function generateRootIndexHeaderComponent(
  projectName: string,
): string {
  return `"use client";

import React from "react";
import { Badge } from "@workspace/ui/components/badge";

export function WebClientIndexHeader() {
  return (
    <header className="border-b border-border pb-6">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">${projectName} Web App</h1>
        <Badge variant="secondary">
          Next.js App
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        Select a Web Page below to interact with API trigger buttons and stringified JSON page load data.
      </p>
    </header>
  );
}

export default WebClientIndexHeader;
`;
}
