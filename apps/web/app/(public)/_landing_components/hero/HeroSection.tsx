"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Download, Monitor, Sparkles, ChevronRight, Layers, Terminal } from "lucide-react";
import { HeroCanvasPreview } from "./HeroCanvasPreview";

const STACK_BADGES = [
  { name: "Next.js 16", color: "bg-black text-white dark:bg-white dark:text-black" },
  { name: "React 19", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { name: "Turborepo & pnpm", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  { name: "Better Auth 1.6", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  { name: "PostgreSQL & SQLite", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  { name: "Redis & Pub/Sub", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  { name: "Zustand Client Stores", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { name: "LangGraph & MCP", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  { name: "Docker Compose", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  { name: "Electron 34 Desktop", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" },
];

export const HeroSection: React.FC = () => {
  return (
    <section className="w-full flex flex-col items-center text-center px-4 pt-12 pb-20 relative overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Subtle Ambient Radial Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] pointer-events-none opacity-40 dark:opacity-20 blur-3xl -z-10"
        style={{
          background: "radial-gradient(circle, rgba(91, 79, 224, 0.25) 0%, rgba(37, 99, 235, 0.15) 40%, transparent 70%)",
        }}
      />

      {/* Product Tag / Pill */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-muted/80 border border-border/80 shadow-xs mb-8 backdrop-blur-md">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        <span className="text-xs font-mono font-medium text-foreground">
          dezign2app
        </span>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-xs font-mono text-muted-foreground">
          visual architecture → full-stack code
        </span>
        <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
          Beta 0.0.1
        </span>
      </div>

      {/* Main Headline */}
      <h1
        style={{ fontFamily: "var(--font-display)" }}
        className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-bold tracking-tight text-foreground max-w-4xl leading-[1.08]"
      >
        Design Distributed Systems.{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-blue-600 to-indigo-600 dark:from-violet-400 dark:via-blue-400 dark:to-indigo-400">
          Compile Production Monorepos.
        </span>
      </h1>

      {/* Subhead */}
      <p className="mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl font-normal leading-relaxed">
        Model distributed topologies, relational schemas, real-time protocols, and LangGraph multi-agent workflows on a visual canvas. Compile directly into a production-ready Turborepo monorepo with Next.js 16, microservices, and Docker Compose.
      </p>

      {/* Dual Primary Call-to-Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3.5 mt-9 mb-12">
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
        >
          <span>Launch Web Studio</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <a
          href="#desktop"
          className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-card border border-border font-medium text-sm text-foreground hover:bg-muted/80 transition-all shadow-xs hover:shadow-sm"
        >
          <Monitor className="w-4 h-4 text-primary" />
          <span>Download Desktop App</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            Win / Mac
          </span>
        </a>

        <a
          href="#studio-views"
          className="inline-flex items-center gap-1.5 px-4 py-3.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Explore 4 Studio Views</span>
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>

      {/* Technology Stack Pill Ribbon */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mb-14">
        {STACK_BADGES.map((badge, idx) => (
          <span
            key={idx}
            className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-md border shadow-2xs ${badge.color}`}
          >
            {badge.name}
          </span>
        ))}
      </div>

      {/* The Interactive Hero Canvas Preview Component */}
      <HeroCanvasPreview />
    </section>
  );
};
