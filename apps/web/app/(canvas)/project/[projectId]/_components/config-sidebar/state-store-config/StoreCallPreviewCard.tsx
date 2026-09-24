"use client";

import React, { useState } from "react";
import { Code2, Copy, Check, Sparkles } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";

function toPascalCase(str: string): string {
  const clean = str.trim();
  if (!clean) return "";
  if (/[\s\-_]/.test(clean)) {
    return clean
      .split(/[\s\-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export interface StoreCallPreviewCardProps {
  storeName: string;
  actionName: string;
  actionType?: string;
  targetFieldName?: string;
  updateSource?: string;
  valuePath?: string;
  customValue?: string;
  parameterMappings?: Record<string, string>;
  sourceKind?: "response" | "payload" | "message";
  subtitle?: string;
}

export function generateCompiledStoreCallSnippet({
  storeName,
  actionName,
  actionType,
  targetFieldName,
  updateSource,
  valuePath,
  customValue,
  parameterMappings,
  sourceKind = "response",
}: {
  storeName: string;
  actionName: string;
  actionType?: string;
  targetFieldName?: string;
  updateSource?: string;
  valuePath?: string;
  customValue?: string;
  parameterMappings?: Record<string, string>;
  sourceKind?: "response" | "payload" | "message";
}): string {
  const rawStoreName = storeName.replace(/Store$/i, "");
  const hookName = `use${toPascalCase(rawStoreName)}Store`;
  const rootVar = sourceKind === "message" ? "message" : sourceKind === "payload" ? "payload" : "response";

  if (actionName === "reset" || actionType === "reset") {
    return `${hookName}.getState().reset();`;
  }

  if (actionName === "populate" || actionType === "populate") {
    const validMappings = parameterMappings
      ? Object.entries(parameterMappings).filter(([_, p]) => Boolean(p && p.trim()))
      : [];

    if (validMappings.length > 0) {
      const fieldLines = validMappings
        .map(([f, p]) => {
          const accessor = p
            .trim()
            .split(".")
            .map((part, i) => (i === 0 ? part : `?.${part}`))
            .join("");
          return `  ${f}: ${rootVar}?.${accessor},`;
        })
        .join("\n");
      return `${hookName}.getState().populate({\n${fieldLines}\n});`;
    }

    if (targetFieldName) {
      if (valuePath && valuePath.trim()) {
        const accessor = valuePath
          .trim()
          .split(".")
          .map((part, i) => (i === 0 ? part : `?.${part}`))
          .join("");
        return `${hookName}.getState().populate({\n  ${targetFieldName}: ${rootVar}?.${accessor},\n});`;
      }
      return `${hookName}.getState().populate({\n  ${targetFieldName}: ${rootVar},\n});`;
    }

    return `${hookName}.getState().populate({\n  /* Map store fields above */\n});`;
  }

  // Custom action with parameter mappings
  if (actionType === "custom" && parameterMappings && Object.keys(parameterMappings).length > 0) {
    const args = Object.values(parameterMappings).map((p) => {
      if (!p || !p.trim()) return "undefined";
      const accessor = p
        .trim()
        .split(".")
        .map((part, i) => (i === 0 ? part : `?.${part}`))
        .join("");
      return `${rootVar}?.${accessor}`;
    });
    return `${hookName}.getState().${actionName}(${args.join(", ")});`;
  }

  // Setters or single-argument actions
  if (updateSource === "static") {
    const val = customValue && customValue.trim() ? customValue.trim() : "true";
    return `${hookName}.getState().${actionName}(${val});`;
  }

  if (updateSource === "direct") {
    return `${hookName}.getState().${actionName}();`;
  }

  if (valuePath && valuePath.trim()) {
    const accessor = valuePath
      .trim()
      .split(".")
      .map((part, i) => (i === 0 ? part : `?.${part}`))
      .join("");
    return `${hookName}.getState().${actionName}(${rootVar}?.${accessor});`;
  }

  return `${hookName}.getState().${actionName}(${rootVar});`;
}

export const StoreCallPreviewCard: React.FC<StoreCallPreviewCardProps> = ({
  storeName,
  actionName,
  actionType,
  targetFieldName,
  updateSource,
  valuePath,
  customValue,
  parameterMappings,
  sourceKind = "response",
  subtitle,
}) => {
  const [copied, setCopied] = useState(false);

  const snippet = generateCompiledStoreCallSnippet({
    storeName,
    actionName,
    actionType,
    targetFieldName,
    updateSource,
    valuePath,
    customValue,
    parameterMappings,
    sourceKind,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col rounded-lg border border-border/70 overflow-hidden bg-slate-950 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-1.5">
          <Code2 size={13} className="text-indigo-400" />
          <span className="text-[11px] font-semibold tracking-wide text-slate-200">
            Compiled Store Function Call
          </span>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 border-indigo-500/40 text-indigo-400 bg-indigo-950/40"
          >
            Live Code Preview
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-1.5 text-[10px] text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-1"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>

      <div className="p-3 font-mono text-[11px] leading-relaxed text-indigo-200/90 whitespace-pre overflow-x-auto selection:bg-indigo-500/30">
        <code>{snippet}</code>
      </div>

      <div className="px-3 py-1.5 bg-slate-900/50 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Sparkles size={10} className="text-amber-400" />
          {subtitle || "Executes reactively on event trigger"}
        </span>
        <span className="font-mono text-slate-500">Zustand v5</span>
      </div>
    </div>
  );
};
