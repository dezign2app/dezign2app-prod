"use client";

import { useState, useCallback, useEffect } from "react";
import { isElectron, getElectronAPI } from "@/lib/electron";

interface UseDevServerStatusOptions {
  port: string | number;
}

export function useDevServerStatus({ port }: UseDevServerStatusOptions) {
  const [isServerRunning, setIsServerRunning] = useState<boolean | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const reloadPreview = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const checkServerStatus = useCallback(async (): Promise<boolean> => {
    const numericPort = parseInt(String(port), 10);
    if (isNaN(numericPort)) {
      setIsServerRunning(false);
      setIsCheckingServer(false);
      return false;
    }

    setIsCheckingServer(true);

    // 1. In Electron desktop mode: use native port check
    if (isElectron()) {
      const api = getElectronAPI();
      if (api?.network?.isPortOpen) {
        try {
          const open = await api.network.isPortOpen(numericPort);
          setIsServerRunning(open);
          setIsCheckingServer(false);
          return open;
        } catch {}
      }
    }

    // 2. In Browser mode: fast ping
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      await fetch(`http://localhost:${numericPort}`, {
        method: "GET",
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsServerRunning(true);
      setIsCheckingServer(false);
      return true;
    } catch {
      setIsServerRunning(false);
      setIsCheckingServer(false);
      return false;
    }
  }, [port]);

  useEffect(() => {
    checkServerStatus();
  }, [checkServerStatus, iframeKey]);

  useEffect(() => {
    if (isServerRunning === true) return;
    const interval = setInterval(() => {
      checkServerStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [isServerRunning, checkServerStatus]);

  return {
    isServerRunning,
    isCheckingServer,
    iframeKey,
    reloadPreview,
    checkServerStatus,
  };
}
