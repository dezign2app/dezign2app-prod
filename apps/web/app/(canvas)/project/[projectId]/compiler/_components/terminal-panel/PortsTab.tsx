"use client";

import React from "react";
import { ExternalLink, Radio, RefreshCw } from "lucide-react";
import { ServicePortInfo } from "@workspace/canvas/types";
import { openExternalUrl } from "@/lib/electron";

interface PortsTabProps {
  ports: ServicePortInfo[];
  onRefresh?: () => void;
}

export function PortsTab({ ports, onRefresh }: PortsTabProps) {
  if (ports.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-slate-400 font-sans select-none">
        <Radio className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm font-medium text-slate-300">
          No services configured with ports
        </p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
          Run <code className="text-sky-400 font-mono">pnpm dev</code> or{" "}
          <code className="text-sky-400 font-mono">docker compose</code> in the
          Terminal to start backend services and expose HTTP/TCP ports.
        </p>
      </div>
    );
  }

  const activeCount = ports.filter((p) => p.isOpen || p.status === "running").length;

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-3 font-sans">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Port Monitoring:</span>
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            {activeCount} of {ports.length} ports actively listening
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
            title="Refresh port status"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Check Now</span>
          </button>
        )}
      </div>

      <div className="border border-border/40 rounded-lg overflow-hidden bg-[#0d1117]/60">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#161b22] text-slate-400 border-b border-border/40">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Port</th>
              <th className="px-3 py-2.5 font-semibold">Process / Service</th>
              <th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20 text-slate-200">
            {ports.map((p, idx) => {
              const isActive = p.isOpen === true || p.status === "running";
              const url = p.url || `http://localhost:${p.port}`;

              return (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    isActive ? "hover:bg-emerald-950/20" : "hover:bg-slate-800/30 opacity-75"
                  }`}
                >
                  <td className="px-3 py-2.5 font-bold">
                    <span className={isActive ? "text-emerald-400" : "text-slate-400"}>
                      {p.port}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-200 font-sans font-medium text-[11px]">
                    {p.name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-[11px]">
                    {p.type || "HTTP"}
                  </td>
                  <td className="px-3 py-2.5">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-slate-800/80 text-slate-400 border border-slate-700/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span>Inactive</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isActive ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => openExternalUrl(url, e)}
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline text-[11px] font-sans"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[10px] italic font-sans">
                        Offline
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
