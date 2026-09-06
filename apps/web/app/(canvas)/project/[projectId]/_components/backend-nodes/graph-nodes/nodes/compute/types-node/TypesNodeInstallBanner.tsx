"use client";

import React from "react";
import { AlertCircle, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";
import type { TypesNodeInstallBannerProps } from "./types";

export const TypesNodeInstallBanner: React.FC<TypesNodeInstallBannerProps> = ({
  packageName,
  installError,
  isRefreshing,
  onRefresh,
}) => {
  return (
    <div className="mx-2.5 p-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <AlertCircle size={13} className="text-red-500 shrink-0" />
        <span>Missing from node_modules</span>
      </div>
      <p className="text-[10px] text-red-300/80 leading-tight">
        {installError ||
          `Package "${packageName || "dependency"}" saved to package.json. Run pnpm i to install.`}
      </p>
      <div className="flex items-center justify-between gap-1 mt-0.5 bg-black/40 px-1.5 py-0.5 rounded border border-red-500/20 font-mono text-[9px] text-red-200">
        <span className="truncate">pnpm i</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText("pnpm i");
              toast.success("Copied: pnpm i");
            }
          }}
          className="hover:text-white p-0.5 cursor-pointer"
          title="Copy install command"
        >
          <Copy size={10} />
        </button>
      </div>
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[9px] font-semibold border border-red-500/30 transition-colors cursor-pointer disabled:opacity-50 mt-1"
        title="Re-check node_modules and extract types"
      >
        <RefreshCw size={10} className={cn(isRefreshing && "animate-spin")} />
        <span>{isRefreshing ? "Checking..." : "Check Again / Sync"}</span>
      </button>
    </div>
  );
};
