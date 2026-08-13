export interface EventComponentMeta {
  componentName: string;
  eventName: string;
  eventType: string;
  url: string;
  method: string;
}

export function generateEventComponent(
  eventName: string,
  eventType: string,
  url: string,
  method: string,
  componentName: string,
): string {
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
