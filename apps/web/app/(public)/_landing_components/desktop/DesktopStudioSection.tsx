"use client";

import React from "react";
import {
  Monitor,
  Terminal,
  Database,
  Cpu,
  Download,
  FolderSync,
  Layers,
  Sparkles,
  CheckCircle2,
  HardDrive,
  Radio,
  ExternalLink,
} from "lucide-react";

export const DesktopStudioSection: React.FC = () => {
  return (
    <section id="desktop" className="w-full py-24 bg-card/40 border-y border-border/60 scroll-mt-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-xs font-mono font-semibold uppercase tracking-wider">
            <Monitor className="w-3.5 h-3.5" />
            <span>Native Desktop Studio</span>
          </div>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground"
          >
            Electron 34 Studio with Native PTY Terminal
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Take full advantage of your local hardware. Dezign2App Desktop pairs the visual architecture canvas with an embedded native terminal, local database engines, and 1-click Docker orchestration.
          </p>
        </div>

        {/* 50/50 Split Canvas + Native Terminal Mockup */}
        <div className="w-full rounded-2xl border border-border bg-[#0B0E14] text-white shadow-2xl overflow-hidden flex flex-col">
          {/* Desktop Titlebar with Window Controls */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56] inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F] inline-block" />
              <span className="ml-2 text-zinc-300 font-semibold text-[11px]">
                D2A Native Studio — Split-Screen Workspace (50% Canvas / 50% Terminal)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span className="px-2 py-0.5 rounded bg-white/10 text-emerald-400 font-medium">
                dezign2app:// active
              </span>
              <span>Electron 34.5</span>
            </div>
          </div>

          {/* Split Body */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10 min-h-[420px]">
            {/* Left 50%: Visual Canvas Stage */}
            <div className="p-6 bg-[#0E131F] flex flex-col justify-between relative overflow-hidden">
              {/* Dot Grid */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: "radial-gradient(#3B82F6 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              <div className="relative z-10 flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-white/10 pb-3">
                <span className="flex items-center gap-1.5 text-zinc-200 font-medium">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Interactive Architecture Canvas</span>
                </span>
                <span className="text-[10px] text-emerald-400">● 4 Nodes Active</span>
              </div>

              {/* Miniature Node Layout in Canvas */}
              <div className="relative z-10 flex flex-col gap-3 my-auto py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-44 shadow-lg">
                    <div className="text-[10px] font-mono text-blue-400 font-bold">API Gateway</div>
                    <div className="text-[9px] text-zinc-400">REST &amp; WebSockets (:46500)</div>
                  </div>
                  <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-60" />
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-44 shadow-lg">
                    <div className="text-[10px] font-mono text-emerald-400 font-bold">Microservice Node</div>
                    <div className="text-[9px] text-zinc-400">Express / Zod Routes</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-44 shadow-lg">
                    <div className="text-[10px] font-mono text-purple-400 font-bold">Better Auth</div>
                    <div className="text-[9px] text-zinc-400">OAuth &amp; RBAC Guards</div>
                  </div>
                  <div className="h-0.5 flex-1 bg-gradient-to-r from-purple-500 to-amber-500 opacity-60" />
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-44 shadow-lg">
                    <div className="text-[10px] font-mono text-amber-400 font-bold">PostgreSQL Engine</div>
                    <div className="text-[9px] text-zinc-400">Local Embedded :5432</div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-3 border-t border-white/10">
                <span>View: Architecture Graph (elkjs auto-layout)</span>
                <span className="text-zinc-200">Zoom: 100%</span>
              </div>
            </div>

            {/* Right 50%: Native PTY Terminal Stage */}
            <div className="p-5 bg-[#080B10] flex flex-col justify-between font-mono text-xs">
              {/* Terminal Tabs */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-semibold flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    <span>PowerShell / zsh</span>
                  </span>
                  <span className="px-2 py-0.5 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                    Docker Logs
                  </span>
                  <span className="px-2 py-0.5 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                    PostgreSQL Runner
                  </span>
                </div>
                <span className="text-emerald-400 text-[10px] font-bold">SESSION ACTIVE</span>
              </div>

              {/* Terminal Output Log */}
              <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-zinc-300 flex-1 py-1">
                <div className="text-zinc-500">$ pnpm dev:monorepo</div>
                <div className="text-blue-400">[turbo] Building 4 packages and 2 applications...</div>
                <div className="text-zinc-300">
                  <span className="text-emerald-400">✔ @workspace/backend</span>: Compiled Zod models in 420ms
                </div>
                <div className="text-zinc-300">
                  <span className="text-emerald-400">✔ apps/web</span>: Next.js 16 (Turbopack) ready on http://localhost:46500
                </div>
                <div className="text-zinc-300">
                  <span className="text-emerald-400">✔ apps/api</span>: Express server listening on http://localhost:3001
                </div>
                <div className="text-emerald-400 mt-2 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Embedded Local Databases:</span>
                </div>
                <div className="text-zinc-400 ml-4">
                  • PostgreSQL 16: running at localhost:5432 (d2a_local)
                </div>
                <div className="text-zinc-400 ml-4">
                  • Redis 7: running at localhost:6379 (cache &amp; pubsub)
                </div>
                <div className="text-cyan-400 mt-1">
                  Docker Compose bridge: All 3 containers healthy [up 00:04:12]
                </div>
              </div>

              {/* Terminal Input Prompt */}
              <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-zinc-400 text-[11px]">
                <span className="text-emerald-400">subhash@d2a-workstation:~/project$</span>
                <span className="w-2 h-4 bg-emerald-400 inline-block animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* 4 Feature Pillars of Desktop App */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12 text-left">
          <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Integrated Native PTY</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real pseudo-terminal emulation (PowerShell on Windows, zsh on Mac) with persistent sessions across canvas routes.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Embedded Database Runners</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Local PostgreSQL, SQLite, and Redis engines run directly on your workstation without external cloud fees or credentials.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">1-Click Local Docker Runner</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Export generated monorepos directly to your disk and orchestrate multi-container stacks via the Docker CLI bridge.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Deep-Link &amp; 3-Tier Envs</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Seamless <code className="text-primary font-mono text-[10px]">dezign2app://</code> OAuth authentication and 3 isolated local/dev/prod environments.
            </p>
          </div>
        </div>

        {/* Download Release Callout */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://github.com/dezign2app/dezign2app/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-all shadow-md active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Download Desktop for Windows &amp; macOS</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>
          <span className="text-xs text-muted-foreground font-mono">
            Requires Windows 10+ or macOS 12+ (Apple Silicon &amp; Intel)
          </span>
        </div>
      </div>
    </section>
  );
};
