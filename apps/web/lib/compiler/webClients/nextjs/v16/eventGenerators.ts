export interface EventComponentMeta {
  componentName: string;
  eventName: string;
  eventType: string;
  url: string;
  method: string;
  targetRoute?: string;
  targetPageLabel?: string;
}

export function generateEventComponent(
  eventName: string,
  eventType: string,
  url: string,
  method: string,
  componentName: string,
  targetRoute?: string,
  targetPageLabel?: string,
): string {
  if (eventType === "navigateToPage") {
    const route = targetRoute || "/";
    const label = targetPageLabel || route;
    return `"use client";

import React from "react";
import Link from "next/link";

interface ${componentName}Props {
  onTrigger?: (eventName: string, eventType: string, url: string, method: string) => void;
}

export function ${componentName}({ onTrigger }: ${componentName}Props) {
  return (
    <Link
      href="${route}"
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 cursor-pointer"
    >
      <span>${eventName}</span>
      <span className="text-xs opacity-75 font-mono">(&rarr; ${label})</span>
    </Link>
  );
}

export default ${componentName};
`;
  }

  return `"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";

interface ${componentName}Props {
  onTrigger: (eventName: string, eventType: string, url: string, method: string) => void;
}

export function ${componentName}({ onTrigger }: ${componentName}Props) {
  return (
    <Button
      type="button"
      onClick={() => onTrigger("${eventName}", "${eventType}", "${url}", "${method}")}
      className="flex items-center gap-2 cursor-pointer"
    >
      <span>${eventName}</span>
      <span className="text-xs opacity-75 font-mono">(${eventType})</span>
    </Button>
  );
}

export default ${componentName};
`;
}
