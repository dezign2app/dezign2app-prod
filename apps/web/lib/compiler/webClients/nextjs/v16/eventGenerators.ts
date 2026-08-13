export interface EventComponentMeta {
  componentName: string;
  eventName: string;
  eventType: string;
  url: string;
  method: string;
  targetRoute?: string;
  targetPageLabel?: string;
  requireAuth?: boolean;
  customHeaders?: Record<string, string>;
  queryParams?: Record<string, string>;
  requestBody?: unknown;
}

export function generateEventComponent(
  eventName: string,
  eventType: string,
  url: string,
  method: string,
  componentName: string,
  targetRoute?: string,
  targetPageLabel?: string,
  requireAuth: boolean = true,
  customHeaders?: Record<string, string>,
  queryParams?: Record<string, string>,
  requestBody?: unknown,
): string {
  if (eventType === "navigateToPage") {
    const route = targetRoute || "/";
    const label = targetPageLabel || route;
    return `"use client";

import React from "react";
import Link from "next/link";

interface ${componentName}Props {
  onTrigger?: (
    eventName: string,
    eventType: string,
    url: string,
    method: string,
    requireAuth?: boolean,
    customHeaders?: Record<string, string>,
    queryParams?: Record<string, string>,
    requestBody?: unknown,
  ) => void;
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

  const headersJson = customHeaders ? JSON.stringify(customHeaders) : "undefined";
  const paramsJson = queryParams ? JSON.stringify(queryParams) : "undefined";
  const bodyJson = requestBody ? JSON.stringify(requestBody) : "undefined";

  return `"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";

interface ${componentName}Props {
  onTrigger: (
    eventName: string,
    eventType: string,
    url: string,
    method: string,
    requireAuth?: boolean,
    customHeaders?: Record<string, string>,
    queryParams?: Record<string, string>,
    requestBody?: unknown,
  ) => void;
}

export function ${componentName}({ onTrigger }: ${componentName}Props) {
  return (
    <Button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onTrigger(
          "${eventName}",
          "${eventType}",
          "${url}",
          "${method}",
          ${Boolean(requireAuth)},
          ${headersJson},
          ${paramsJson},
          ${bodyJson}
        );
      }}
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
