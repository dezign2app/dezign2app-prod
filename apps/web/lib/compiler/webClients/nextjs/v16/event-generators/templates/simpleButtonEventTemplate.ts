export function generateSimpleButtonEventTemplate({
  componentName,
  eventName,
  eventType,
  url,
  upperMethod,
  requireAuth = true,
  typeDefs,
}: {
  componentName: string;
  eventName: string;
  eventType: string;
  url: string;
  upperMethod: string;
  requireAuth?: boolean;
  typeDefs: string[];
}): string {
  return `"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";

${typeDefs.join("\n\n")}

export function ${componentName}({ onTrigger }: ${componentName}Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onTrigger?.(
        "${eventName}",
        "${eventType}",
        "${url}",
        "${upperMethod}",
        ${Boolean(requireAuth)},
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isSubmitting}
      className="cursor-pointer font-medium shadow-sm"
    >
      {isSubmitting ? "Executing..." : "${eventName}"}
    </Button>
  );
}

export default ${componentName};
`;
}
