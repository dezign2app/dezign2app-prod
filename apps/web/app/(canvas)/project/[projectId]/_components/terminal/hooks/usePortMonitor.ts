"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { ServicePortInfo } from "@workspace/canvas/types";

/**
 * Probes whether a specific port or URL is actively open and listening.
 * - In Electron: Silent OS-level TCP socket check (net.Socket) via Electron API.
 * - In Web: Lightweight HEAD request with AbortController timeout.
 */
export async function checkPortListening(
  port: number | string,
  rawUrl?: string,
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

  // 2. Web browser fetch probe fallback
  const targetUrl =
    rawUrl || (!isNaN(portNum) && portNum > 0 ? `http://localhost:${portNum}` : "");
  if (!targetUrl) return false;

  const finalUrl =
    targetUrl.startsWith("http://") || targetUrl.startsWith("https://")
      ? targetUrl
      : `http://${targetUrl}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);

    await fetch(finalUrl, {
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

interface UsePortMonitorProps {
  ports: ServicePortInfo[];
  pollIntervalMs?: number;
}

export function usePortMonitor({
  ports,
  pollIntervalMs = 2500,
}: UsePortMonitorProps) {
  const [openPortMap, setOpenPortMap] = useState<Record<string, boolean>>({});
  const isCheckingRef = useRef(false);

  const portsSignature = ports
    .map((p) => `${p.port}-${p.name}-${p.url}`)
    .join(",");

  const checkAllPorts = useCallback(async () => {
    if (ports.length === 0 || isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const results = await Promise.all(
        ports.map(async (p) => {
          const isOpen = await checkPortListening(p.port, p.url);
          return { key: String(p.port), isOpen };
        }),
      );

      setOpenPortMap((prev) => {
        const next: Record<string, boolean> = { ...prev };
        let changed = false;
        results.forEach(({ key, isOpen }) => {
          if (next[key] !== isOpen) {
            next[key] = isOpen;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    } finally {
      isCheckingRef.current = false;
    }
  }, [portsSignature]);

  // Periodic polling + window focus trigger
  useEffect(() => {
    if (ports.length === 0) return;

    checkAllPorts();

    const interval = setInterval(checkAllPorts, pollIntervalMs);
    const handleFocus = () => checkAllPorts();

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [checkAllPorts, pollIntervalMs, ports.length]);

  // Monitored ports with live real-time status
  const monitoredPorts: ServicePortInfo[] = ports.map((p) => {
    const portKey = String(p.port);
    const isOpen = openPortMap[portKey] === true;

    return {
      ...p,
      isOpen,
      status: isOpen ? "running" : "inactive",
    };
  });

  const activePortsCount = monitoredPorts.filter((p) => p.isOpen).length;

  return {
    monitoredPorts,
    activePortsCount,
    openPortMap,
    refreshPorts: checkAllPorts,
  };
}
