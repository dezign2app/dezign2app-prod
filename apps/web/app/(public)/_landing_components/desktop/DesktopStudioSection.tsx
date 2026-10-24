"use client";

import React from "react";
import {
  Monitor,
  Terminal,
  Database,
  Download,
  HardDrive,
  Radio,
  ExternalLink,
  Check,
} from "lucide-react";

export const DesktopStudioSection: React.FC = () => {
  return (
    <section id="desktop" className="w-full py-24 bg-[#08080a] border-t border-zinc-900 scroll-mt-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-14 max-w-2xl">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Native Desktop Studio
          </span>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white"
          >
            Electron 34 with Native PTY Terminal
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Take full advantage of your workstation. Dezign2App Desktop pairs the visual architecture canvas with an embedded native terminal, local database engines, and 1-click Docker orchestration.
          </p>
        </div>

        {/* 50/50 Split Canvas + Native Terminal Mockup */}
        <div className="w-full rounded-xl border border-zinc-800 bg-[#070709] text-white shadow-2xl overflow-hidden flex flex-col">
          {/* Desktop Titlebar */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#121215] border-b border-zinc-800 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
              <span className="ml-2 text-zinc-400 text-[11px]">
                D2A Desktop — 50% Canvas / 50% Terminal
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                dezign2app:// active
              </span>
              <span>Electron 34</span>
            </div>
          </div>

          {/* Split Body */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800 min-h-[380px]">
            {/* Left 50%: Visual Canvas Stage */}
            <div className="p-6 bg-[#0a0a0d] flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500 border-b border-zinc-800 pb-2.5">
                <span className="text-zinc-300">Architecture Canvas</span>
                <span className="text-emerald-400">● 4 Nodes Active</span>
              </div>

              {/* Minimalist Node Wireframe in Canvas */}
              <div className="flex flex-col gap-3 my-auto py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="p-2.5 rounded border border-zinc-800 bg-[#121215] w-40">
                    <div className="text-[10px] font-mono text-white font-medium">API Gateway</div>
                    <div className="text-[9px] text-zinc-500">REST &amp; WebSockets (:46500)</div>
                  </div>
                  <div className="h-px flex-1 bg-zinc-800" />
                  <div className="p-2.5 rounded border border-zinc-800 bg-[#121215] w-40">
                    <div className="text-[10px] font-mono text-white font-medium">User Service</div>
                    <div className="text-[9px] text-zinc-500">Express / Zod Routes</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="p-2.5 rounded border border-zinc-800 bg-[#121215] w-40">
                    <div className="text-[10px] font-mono text-white font-medium">Better Auth</div>
                    <div className="text-[9px] text-zinc-500">OAuth &amp; RBAC Guards</div>
                  </div>
                  <div className="h-px flex-1 bg-zinc-800" />
                  <div className="p-2.5 rounded border border-zinc-800 bg-[#121215] w-40">
                    <div className="text-[10px] font-mono text-white font-medium">PostgreSQL</div>
                    <div className="text-[9px] text-zinc-500">Local Embedded :5432</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-2 border-t border-zinc-800">
                <span>View: Graph (auto-routed)</span>
                <span>Zoom: 100%</span>
              </div>
            </div>

            {/* Right 50%: Native PTY Terminal Stage */}
            <div className="p-5 bg-[#070709] flex flex-col justify-between font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-white font-medium flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-zinc-400" />
                    <span>PowerShell / zsh</span>
                  </span>
                  <span className="px-2 py-0.5 text-zinc-500">Docker Logs</span>
                </div>
                <span className="text-emerald-400 text-[10px]">SESSION ACTIVE</span>
              </div>

              {/* Terminal Log */}
              <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-zinc-300 flex-1 py-1">
                <div className="text-zinc-500">$ pnpm dev:monorepo</div>
                <div className="text-zinc-400">[turbo] Building workspace packages...</div>
                <div className="text-zinc-300">
                  <span className="text-emerald-400">✔ @workspace/backend</span>: Compiled Zod models in 420ms
                </div>
                <div className="text-zinc-300">
                  <span className="text-emerald-400">✔ apps/web</span>: Next.js 16 ready on http://localhost:46500
                </div>
                <div className="text-zinc-300">
                  <span className="text-emerald-400">✔ apps/api</span>: Express server listening on :3001
                </div>
                <div className="text-zinc-400 mt-2 flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Embedded Local Databases:</span>
                </div>
                <div className="text-zinc-500 ml-4">
                  • PostgreSQL 16: localhost:5432 (d2a_local)
                </div>
                <div className="text-zinc-500 ml-4">
                  • Redis 7: localhost:6379 (cache &amp; pubsub)
                </div>
              </div>

              {/* Prompt */}
              <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 text-zinc-400 text-[11px]">
                <span className="text-zinc-500">workstation:~/project$</span>
                <span className="w-1.5 h-3.5 bg-zinc-400 inline-block animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* 4 Feature Pillars of Desktop App - Minimalist Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10 text-left">
          <div className="p-4 rounded-lg border border-zinc-800 bg-[#0b0b0e] flex flex-col gap-1.5">
            <Terminal className="w-4 h-4 text-zinc-400 mb-1" />
            <h4 className="text-xs font-semibold text-white">Integrated Native PTY</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Real pseudo-terminal emulation (PowerShell / zsh) with persistent sessions across canvas routes.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-zinc-800 bg-[#0b0b0e] flex flex-col gap-1.5">
            <Database className="w-4 h-4 text-zinc-400 mb-1" />
            <h4 className="text-xs font-semibold text-white">Embedded Database Runners</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Local PostgreSQL, SQLite, and Redis engines run directly on your workstation with zero cloud setup.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-zinc-800 bg-[#0b0b0e] flex flex-col gap-1.5">
            <HardDrive className="w-4 h-4 text-zinc-400 mb-1" />
            <h4 className="text-xs font-semibold text-white">Local Docker Runner</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Export generated monorepos directly to your disk and orchestrate multi-container stacks via Docker CLI.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-zinc-800 bg-[#0b0b0e] flex flex-col gap-1.5">
            <Radio className="w-4 h-4 text-zinc-400 mb-1" />
            <h4 className="text-xs font-semibold text-white">Deep-Link &amp; 3-Tier Envs</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Native <code className="text-zinc-300 font-mono text-[10px]">dezign2app://</code> OAuth authentication and 3 isolated local/dev/prod environments.
            </p>
          </div>
        </div>

        {/* Download Release Callout */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/dezign2app/dezign2app/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-medium text-xs hover:bg-zinc-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Desktop for Windows &amp; macOS</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
          <span className="text-xs text-zinc-500 font-mono">
            Windows 10+ / macOS 12+
          </span>
        </div>
      </div>
    </section>
  );
};
