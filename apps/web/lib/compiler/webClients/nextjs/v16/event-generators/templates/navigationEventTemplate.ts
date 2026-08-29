export function generateNavigationEventTemplate(
  componentName: string,
  eventName: string,
  targetRoute?: string,
): string {
  const route = targetRoute || "/";
  return `"use client";

import React from "react";
import Link from "next/link";

export interface ${componentName}Props {
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
    </Link>
  );
}

export default ${componentName};
`;
}
