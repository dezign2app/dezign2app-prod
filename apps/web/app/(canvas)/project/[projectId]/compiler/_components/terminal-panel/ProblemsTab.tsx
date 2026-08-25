"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

export function ProblemsTab() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-slate-400 font-sans select-none">
      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
      <p className="text-sm font-medium text-slate-300">
        No problems have been detected in the workspace.
      </p>
      <p className="text-xs text-slate-400 mt-1">
        All routes, schema types, and client endpoints are valid.
      </p>
    </div>
  );
}
