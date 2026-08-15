"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { openExternalUrl } from "@/lib/electron";
import { TerminalTab, ServiceEndpoint } from "../types";

interface TerminalEndpointsBarProps {
  activeTab: TerminalTab;
  serviceEndpoints: ServiceEndpoint[];
}

export function TerminalEndpointsBar({
  activeTab,
  serviceEndpoints,
}: TerminalEndpointsBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/70 border-b border-zinc-800/80 text-[11px] shrink-0">
      <div className="flex items-center gap-2 overflow-x-auto py-0.5">
        <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider shrink-0">
          {activeTab === "dev"
            ? "Dev Stack:"
            : activeTab === "docker"
              ? "Docker Stack:"
              : "Shell Session:"}
        </span>

        {serviceEndpoints.map((svc) => (
          <a
            key={svc.name}
            href={svc.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openExternalUrl(svc.url, e)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors shrink-0 text-[11px] cursor-pointer"
            title={`Open ${svc.name} (${svc.url}) in browser`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                svc.type === "web"
                  ? "bg-blue-400"
                  : svc.type === "service"
                    ? "bg-emerald-400"
                    : "bg-amber-400"
              }`}
            />
            <span className="font-medium">{svc.name}</span>
            <span className="text-zinc-500 font-mono">:{svc.port}</span>
            <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
          </a>
        ))}
      </div>

      <div className="flex items-center gap-1.5 pl-2 shrink-0">
        <span className="text-[10px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded font-mono border border-zinc-700/50">
          wterm engine (WASM)
        </span>
      </div>
    </div>
  );
}
