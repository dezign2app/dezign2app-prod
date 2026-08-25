"use client";

import React from "react";

interface OutputTabProps {
  outputLogs: string[];
}

export function OutputTab({ outputLogs }: OutputTabProps) {
  return (
    <div className="h-full overflow-y-auto p-3 text-slate-300 font-mono text-xs space-y-1">
      {outputLogs.length > 0 ? (
        outputLogs.map((line, idx) => (
          <div key={idx} className="leading-relaxed">
            {line}
          </div>
        ))
      ) : (
        <div className="text-slate-400 space-y-1">
          <p className="text-slate-200 font-semibold">[Monorepo Build Output]</p>
          <p>✔ Compiler engine ready.</p>
          <p>✔ Turbopack and StackBlitz integration initialized.</p>
          <p className="text-slate-400">Waiting for next compile trigger...</p>
        </div>
      )}
    </div>
  );
}
