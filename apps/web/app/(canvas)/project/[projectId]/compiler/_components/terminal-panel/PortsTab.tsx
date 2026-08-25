"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { ServicePortInfo } from "./types";

interface PortsTabProps {
  ports: ServicePortInfo[];
}

export function PortsTab({ ports }: PortsTabProps) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="border border-border/40 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#161b22] text-slate-400 border-b border-border/40">
            <tr>
              <th className="px-3 py-2">Port</th>
              <th className="px-3 py-2">Process / Service</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20 text-slate-200">
            {ports.length > 0 ? (
              ports.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-bold text-emerald-400">
                    {p.port}
                  </td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {p.type || "HTTP"}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={p.url || `http://localhost:${p.port}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <>
                <tr className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-bold text-emerald-400">3000</td>
                  <td className="px-3 py-2">Web Client Application</td>
                  <td className="px-3 py-2 text-slate-400">Next.js App</td>
                  <td className="px-3 py-2">
                    <a
                      href="http://localhost:3000"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-bold text-emerald-400">3002</td>
                  <td className="px-3 py-2">System Design Engine</td>
                  <td className="px-3 py-2 text-slate-400">Express API</td>
                  <td className="px-3 py-2">
                    <a
                      href="http://localhost:3002"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
