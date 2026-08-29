import { PageInfo } from "./types";

export function generatePageHeaderComponent(
  pageMeta: PageInfo,
): string {
  const compName = `${pageMeta.componentName}Header`;
  return `"use client";

import React from "react";
import Link from "next/link";

export function ${compName}() {
  return (
    <header className="border-b border-border pb-6 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">${pageMeta.label}</h1>
        ${pageMeta.description ? `<p className="text-muted-foreground text-sm mt-1">${pageMeta.description}</p>` : ""}
      </div>
      <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium border border-border px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted">
        &larr; Back
      </Link>
    </header>
  );
}

export default ${compName};
`;
}

export default generatePageHeaderComponent;
