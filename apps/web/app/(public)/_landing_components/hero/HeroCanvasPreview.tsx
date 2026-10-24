"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Globe,
  Lock,
  Server,
  Database,
  Layers,
  Terminal,
  Workflow,
  CheckCircle2,
} from "lucide-react";

interface CanvasNode {
  id: string;
  title: string;
  category: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  x: number;
  y: number;
  ports: { in?: boolean; out?: boolean };
  details: string[];
}

const NODES: CanvasNode[] = [
  {
    id: "gateway",
    title: "API Gateway",
    category: "INGRESS & ROUTING",
    badge: ":46500",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: Globe,
    x: 60,
    y: 140,
    ports: { out: true },
    details: ["/api/v1/users", "/api/v1/auth", "WebSocket Proxy"],
  },
  {
    id: "auth",
    title: "Better Auth Node",
    category: "SECURITY & SESSIONS",
    badge: "OAuth / RBAC",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    icon: Lock,
    x: 350,
    y: 50,
    ports: { in: true, out: true },
    details: ["Email & Password", "GitHub & Google", "Session Guard"],
  },
  {
    id: "service",
    title: "User Microservice",
    category: "EXPRESS / FASTAPI",
    badge: "Port 3001",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    icon: Server,
    x: 350,
    y: 240,
    ports: { in: true, out: true },
    details: ["Zod Route Validation", "Controller Handlers", "JWT Verification"],
  },
  {
    id: "database",
    title: "PostgreSQL Database",
    category: "RELATIONAL SCHEMA",
    badge: "5432",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: Database,
    x: 670,
    y: 70,
    ports: { in: true },
    details: ["users (id, email, role)", "sessions (token, exp)", "Migrations Auto-Gen"],
  },
  {
    id: "langgraph",
    title: "LangGraph Agent",
    category: "STATEFUL AI GRAPH",
    badge: "MCP Ready",
    badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    icon: Workflow,
    x: 670,
    y: 260,
    ports: { in: true },
    details: ["Router Conditional Edge", "SSE Token Streaming", "Model Context Protocol"],
  },
];

const CONNECTIONS = [
  { from: { x: 230, y: 175 }, to: { x: 350, y: 100 }, color: "#8B5CF6", delay: 0 },
  { from: { x: 230, y: 195 }, to: { x: 350, y: 285 }, color: "#10B981", delay: 0.8 },
  { from: { x: 520, y: 100 }, to: { x: 670, y: 115 }, color: "#F59E0B", delay: 1.6 },
  { from: { x: 520, y: 285 }, to: { x: 670, y: 135 }, color: "#3B82F6", delay: 2.2 },
  { from: { x: 520, y: 300 }, to: { x: 670, y: 305 }, color: "#EC4899", delay: 1.2 },
];

export const HeroCanvasPreview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"graph" | "schema" | "langgraph">("graph");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="w-full max-w-5xl rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col text-left">
      {/* Studio Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-3">
            <span className="w-3 h-3 rounded-full bg-red-400/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-400/80 inline-block" />
          </div>
          <span className="text-xs font-mono font-medium text-muted-foreground mr-2">
            dezign2app-studio
          </span>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <span className="text-xs font-mono text-foreground font-semibold">
            ecommerce-distributed.d2a
          </span>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border/60 text-xs">
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === "graph"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Architecture Graph</span>
          </button>
          <button
            onClick={() => setActiveTab("schema")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === "schema"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Schema ERD</span>
          </button>
          <button
            onClick={() => setActiveTab("langgraph")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === "langgraph"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>LangGraph</span>
          </button>
        </div>

        {/* Compiler Status Badge */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            Turborepo Compiler Synced
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground border border-border">
            18 files generated
          </span>
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div className="relative w-full h-[440px] sm:h-[460px] bg-[#FAFBFD] dark:bg-[#0C0F17] overflow-hidden select-none">
        {/* Subtle dot grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
          style={{
            backgroundImage: "radial-gradient(#64748B 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Dynamic Canvas SVG Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 950 420" preserveAspectRatio="none">
          <defs>
            <linearGradient id="violetGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EC4899" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#EC4899" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {CONNECTIONS.map((conn, idx) => {
            const dx = conn.to.x - conn.from.x;
            const cx1 = conn.from.x + dx * 0.45;
            const cx2 = conn.from.x + dx * 0.55;
            const d = `M ${conn.from.x} ${conn.from.y} C ${cx1} ${conn.from.y}, ${cx2} ${conn.to.y}, ${conn.to.x} ${conn.to.y}`;

            return (
              <g key={`conn-${idx}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={conn.color}
                  strokeWidth="2"
                  strokeOpacity="0.4"
                  strokeDasharray="4 4"
                />
                {!reduceMotion && (
                  <motion.circle
                    r="3.5"
                    fill={conn.color}
                    animate={{ offsetDistance: ["0%", "100%"] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                      delay: conn.delay,
                    }}
                    style={{ offsetPath: `path('${d}')` }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {NODES.map((node) => {
          const Icon = node.icon;
          const isHovered = hoveredNode === node.id;

          return (
            <div
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="absolute z-20 transition-all duration-200 cursor-pointer"
              style={{
                left: `${(node.x / 950) * 100}%`,
                top: `${(node.y / 420) * 100}%`,
                transform: `translate(-5%, -5%) scale(${isHovered ? 1.03 : 1})`,
              }}
            >
              <div
                className={`w-[170px] sm:w-[190px] rounded-xl border bg-card/95 backdrop-blur-md shadow-md hover:shadow-xl transition-all ${
                  isHovered ? "border-primary ring-2 ring-primary/20" : "border-border/80"
                }`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between p-2.5 border-b border-border/50 bg-muted/20 rounded-t-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground truncate">
                      {node.title}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${node.badgeColor}`}
                  >
                    {node.badge}
                  </span>
                </div>

                {/* Node Body */}
                <div className="p-2.5 flex flex-col gap-1 text-[10px] font-mono text-muted-foreground">
                  <span className="text-[8px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-0.5">
                    {node.category}
                  </span>
                  {node.details.map((detail, dIdx) => (
                    <div key={dIdx} className="flex items-center gap-1.5 text-foreground/80 truncate">
                      <div className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                      <span className="truncate">{detail}</span>
                    </div>
                  ))}
                </div>

                {/* Status Footer */}
                <div className="px-2.5 py-1 bg-muted/30 border-t border-border/40 rounded-b-xl flex items-center justify-between text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                    <span>Compiled</span>
                  </span>
                  <span className="font-mono">zod.ok</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Floating Mini Overlay - Live Terminal Simulation */}
        <div className="hidden md:flex absolute bottom-3 right-4 z-30 items-center gap-3 px-3 py-1.5 rounded-lg bg-black/85 text-white border border-white/10 shadow-lg text-[11px] font-mono backdrop-blur-md">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-zinc-400">$</span>
          <span className="text-zinc-200">dezign2app compile --monorepo</span>
          <span className="text-emerald-400 font-semibold ml-2">✓ Ready in 1.4s</span>
        </div>
      </div>
    </div>
  );
};
