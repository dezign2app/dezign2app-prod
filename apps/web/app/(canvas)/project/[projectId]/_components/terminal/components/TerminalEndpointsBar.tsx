"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { openExternalUrl, isElectron, getElectronAPI } from "@/lib/electron";
import { ServiceEndpoint, DetectedPort } from "../types";

interface TerminalEndpointsBarProps {
  serviceEndpoints: ServiceEndpoint[];
  detectedPorts?: DetectedPort[];
}

/**
 * Probes whether a port/endpoint is actively reachable.
 * - In Electron: Uses silent OS-level TCP socket check (net.Socket) with 0 HTTP traffic / 0 log pollution.
 * - In Web: Uses lightweight HEAD request with no-cors mode.
 */
async function checkEndpointReachable(
  rawUrl: string,
  port: string | number,
): Promise<boolean> {
  const portNum = typeof port === "number" ? port : parseInt(String(port), 10);

  // 1. Silent OS-level TCP socket check (Electron mode)
  if (isElectron() && !isNaN(portNum) && portNum > 0) {
    const api = getElectronAPI();
    if (api?.network?.isPortOpen) {
      try {
        return await api.network.isPortOpen(portNum);
      } catch {
        return false;
      }
    }
  }

  // 2. Web browser preview fallback
  if (!rawUrl) return false;
  const targetUrl =
    rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : `http://${rawUrl}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);

    await fetch(targetUrl, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export function TerminalEndpointsBar({
  serviceEndpoints = [],
  detectedPorts = [],
}: TerminalEndpointsBarProps) {
  const [reachabilityMap, setReachabilityMap] = useState<
    Record<string, boolean>
  >({});

  // Combine statically inferred monorepo endpoints + live detected runtime ports
  const allEndpoints: Array<{
    name: string;
    port: string | number;
    url: string;
    type: "web" | "service" | "port";
  }> = [
    ...serviceEndpoints.map((s) => ({
      name: s.name,
      port: s.port,
      url: s.url,
      type: s.type === "web" ? ("web" as const) : ("service" as const),
    })),
  ];

  // Add detected runtime ports if not already in endpoints
  const existingPorts = new Set(allEndpoints.map((e) => String(e.port)));
  for (const dp of detectedPorts) {
    if (!existingPorts.has(String(dp.port))) {
      existingPorts.add(String(dp.port));
      allEndpoints.push({
        name: `Port ${dp.port}`,
        port: dp.port,
        url: dp.url,
        type: "port",
      });
    }
  }

  const endpointSignature = allEndpoints
    .map((e) => `${e.name}-${e.port}-${e.url}`)
    .join(",");

  const probeAll = useCallback(async () => {
    if (allEndpoints.length === 0) return;

    const results = await Promise.all(
      allEndpoints.map(async (ep) => {
        const isLive = await checkEndpointReachable(ep.url, ep.port);
        return { key: `${ep.name}-${ep.port}`, isLive };
      }),
    );

    setReachabilityMap((prev) => {
      const next = { ...prev };
      results.forEach(({ key, isLive }) => {
        next[key] = isLive;
      });
      return next;
    });
  }, [endpointSignature]);

  // Periodic silent reachability probe with relaxed 8-second interval + window focus trigger
  useEffect(() => {
    if (allEndpoints.length === 0) return;

    probeAll();

    const interval = setInterval(probeAll, 8000);
    const handleFocus = () => probeAll();

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [probeAll, allEndpoints.length]);

  if (allEndpoints.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-sidebar-accent/30 border-b border-sidebar-border text-[11px] shrink-0">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-0.5">
        <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Globe className="w-3 h-3 text-sky-400" />
          <span>Live Endpoints:</span>
        </span>

        {allEndpoints.map((ep) => {
          const key = `${ep.name}-${ep.port}`;
          const isReachable = reachabilityMap[key] === true;

          return (
            <a
              key={key}
              href={ep.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openExternalUrl(ep.url, e)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sidebar-accent/60 hover:bg-sidebar-accent border border-sidebar-border text-sidebar-foreground transition-colors shrink-0 text-[11px] cursor-pointer"
              title={`${ep.name} (${ep.url}) • ${
                isReachable ? "Online / Reachable" : "Offline / Unreachable"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  isReachable
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse"
                    : "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]"
                }`}
              />
              <span className="font-medium">{ep.name}</span>
              <span className="text-muted-foreground font-mono">:{ep.port}</span>
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
            </a>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 pl-2 shrink-0">
        <span className="text-[10px] bg-sidebar-accent text-muted-foreground px-1.5 py-0.5 rounded font-mono border border-sidebar-border">
          wterm WASM
        </span>
      </div>
    </div>
  );
}
