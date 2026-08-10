import React from "react";
import { Label } from "@workspace/ui/components/label";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Code2 } from "lucide-react";
import { AuthConfigSectionProps } from "./types";
import { generateAuthConfig } from "@/lib/compiler/auth/better-auth/v1.6/generators/generateAuthConfig";

export const AuthCodePreviewSection: React.FC<AuthConfigSectionProps> = ({
  data,
}) => {
  const generatedCode = generateAuthConfig(data);

  return (
    <AccordionItem
      value="preview"
      className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 text-left flex-1">
          <Code2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Generated Code Preview
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium">
            auth.ts
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1">
        <div className="flex flex-col gap-3 pt-2">
          <Label className="text-xs font-semibold">Generated <code className="font-mono">auth.ts</code></Label>
          <pre className="p-3 bg-muted/80 rounded-lg text-[11px] font-mono border border-border/60 overflow-x-auto text-foreground whitespace-pre">
            {generatedCode}
          </pre>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
