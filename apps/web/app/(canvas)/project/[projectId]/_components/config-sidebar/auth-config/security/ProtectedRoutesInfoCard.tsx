import React from "react";
import { ShieldCheck } from "lucide-react";

export const ProtectedRoutesInfoCard: React.FC = () => {
  return (
    <div className="flex flex-col gap-2.5 p-3.5 bg-amber-500/8 rounded-lg border border-amber-500/25 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>Protected Routes & Authorization Header</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium">
          Bearer Token
        </span>
      </div>
      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
        When client pages or actions invoke protected backend endpoints, the{" "}
        <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono text-[10px] text-amber-900 dark:text-amber-200 font-semibold">
          Authorization: Bearer &lt;token&gt;
        </code>{" "}
        header is automatically added and forwarded on authenticated client calls.
      </p>
    </div>
  );
};
