"use client";

import React, { useState, useCallback } from "react";
import { ExternalLink, Radio, RefreshCw, Square, Loader2 } from "lucide-react";
import { ServicePortInfo } from "@workspace/canvas/types";
import { openExternalUrl } from "@/lib/electron";
import { killPortProcess } from "@/lib/portKill";
import { toast } from "sonner";

interface PortsTabProps {
  ports: ServicePortInfo[];
  onRefresh?: () => void;
  onKillProcess?: (port: number | string) => Promise<boolean | void> | void;
}

export function PortsTab({ ports, onRefresh, onKillProcess }: PortsTabProps) {
  const [killingMap, setKillingMap] = useState<Record<string, boolean>>({});
  const [isKillingAll, setIsKillingAll] = useState(false);

  const handleKillProcess = useCallback(
    async (port: number | string) => {
      const portKey = String(port);
      setKillingMap((prev) => ({ ...prev, [portKey]: true }));

      try {
        if (onKillProcess) {
          await onKillProcess(port);
          toast.success(`Ended process on port ${port}`);
        } else {
          const res = await killPortProcess(port);
          if (res.success) {
            toast.success(
              res.message || `Ended process on port ${port} — port is now free`
            );
          } else {
            toast.error(res.error || `Failed to end process on port ${port}`);
          }
        }

        // Trigger immediate UI refresh
        onRefresh?.();
        // Follow-up refresh after 700ms to allow OS socket release
        setTimeout(() => {
          onRefresh?.();
        }, 700);
      } catch (err: any) {
        toast.error(err?.message || `Failed to kill process on port ${port}`);
      } finally {
        setKillingMap((prev) => ({ ...prev, [portKey]: false }));
      }
    },
    [onKillProcess, onRefresh]
  );

  const handleKillAllActive = useCallback(async () => {
    const activeList = ports.filter((p) => p.isOpen || p.status === "running");
    if (activeList.length === 0) return;

    setIsKillingAll(true);
    let successCount = 0;

    try {
      await Promise.all(
        activeList.map(async (p) => {
          try {
            if (onKillProcess) {
              await onKillProcess(p.port);
              successCount++;
            } else {
              const res = await killPortProcess(p.port);
              if (res.success) successCount++;
            }
          } catch {
            // continue with remaining ports
          }
        })
      );

      toast.success(
        `Ended ${successCount} running process${successCount !== 1 ? "es" : ""}`
      );
      onRefresh?.();
      setTimeout(() => onRefresh?.(), 700);
    } catch (err: any) {
      toast.error(err?.message || "Failed to end some processes");
    } finally {
      setIsKillingAll(false);
    }
  }, [ports, onKillProcess, onRefresh]);

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

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleKillAllActive}
              disabled={isKillingAll}
              className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors px-2 py-0.5 rounded border border-rose-800/40 disabled:opacity-50"
              title="End all running processes on active ports"
            >
              {isKillingAll ? (
                <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
              ) : (
                <Square className="w-2.5 h-2.5 fill-rose-400 text-rose-400" />
              )}
              <span>Kill All ({activeCount})</span>
            </button>
          )}

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
              const isKilling = killingMap[String(p.port)] === true;

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
                      <div className="flex items-center gap-1.5">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => openExternalUrl(url, e)}
                          className="p-1 rounded text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 transition-colors inline-flex items-center justify-center"
                          title={`Open ${url} in browser`}
                          aria-label={`Open port ${p.port} in browser`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleKillProcess(p.port)}
                          disabled={isKilling}
                          className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 transition-colors disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center"
                          title={`End running process on port ${p.port} (free port)`}
                          aria-label={`End process on port ${p.port}`}
                        >
                          {isKilling ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                          )}
                        </button>
                      </div>
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
