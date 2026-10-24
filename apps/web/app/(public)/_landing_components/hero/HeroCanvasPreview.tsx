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
  icon: React.ElementType;
  x: number;
  y: number;
  details: string[];
}

const NODES: CanvasNode[] = [
  {
    id: "gateway",
    title: "API Gateway",
    category: "INGRESS",
    badge: ":46500",
    icon: Globe,
    x: 60,
    y: 130,
    details: ["/api/v1/users", "/api/v1/auth", "WebSocket Proxy"],
  },
  {
    id: "auth",
    title: "Better Auth Node",
    category: "AUTH & RBAC",
    badge: "OAuth / RBAC",
    icon: Lock,
    x: 350,
    y: 45,
    details: ["Email & Password", "GitHub & Google", "Session Guard"],
  },
  {
    id: "service",
    title: "User Service",
    category: "EXPRESS / API",
    badge: ":3001",
    icon: Server,
    x: 350,
    y: 235,
    details: ["Zod Validation", "Controllers", "JWT Verification"],
  },
  {
    id: "database",
    title: "PostgreSQL DB",
    category: "RELATIONAL",
    badge: ":5432",
    icon: Database,
    x: 670,
    y: 65,
    details: ["users table", "sessions table", "Auto-Migrations"],
  },
  {
    id: "langgraph",
    title: "LangGraph Agent",
    category: "MULTI-AGENT",
    badge: "MCP Tool",
    icon: Workflow,
    x: 670,
    y: 255,
    details: ["Conditional Router", "SSE Streaming", "MCP Bindings"],
  },
];

const CONNECTIONS = [
  { from: { x: 230, y: 165 }, to: { x: 350, y: 95 }, delay: 0 },
  { from: { x: 230, y: 185 }, to: { x: 350, y: 280 }, delay: 0.8 },
  { from: { x: 520, y: 95 }, to: { x: 670, y: 110 }, delay: 1.6 },
  { from: { x: 520, y: 280 }, to: { x: 670, y: 130 }, delay: 2.2 },
  { from: { x: 520, y: 295 }, to: { x: 670, y: 300 }, delay: 1.2 },
];

export const HeroCanvasPreview: React.FC = () => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="w-full max-w-5xl rounded-xl border border-zinc-800 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col text-left">
      {/* Studio Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 bg-[#101014] px-4 py-2.5 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
          </div>
          <span className="text-xs font-mono text-zinc-400">
            dezign2app-studio
          </span>
          <span className="text-zinc-600 text-xs">/</span>
          <span className="text-xs font-mono text-zinc-200">
            distributed-topology.d2a
          </span>
        </div>

        {/* Compiler Status Badge - Minimalist */}
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          <span>Turborepo Synced</span>
          <span className="text-[10px] text-zinc-500">18 files</span>
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div className="relative w-full h-[410px] sm:h-[430px] bg-[#070709] overflow-hidden select-none">
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage: "radial-gradient(#3f3f46 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Canvas Single-Tone SVG Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 950 400" preserveAspectRatio="none">
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
                  stroke="#27272a"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                {!reduceMotion && (
                  <motion.circle
                    r="2.5"
                    fill="#a1a1aa"
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

        {/* Nodes Layer - Monochrome Minimalist Cards */}
        {NODES.map((node) => {
          const Icon = node.icon;
          const isHovered = hoveredNode === node.id;

          return (
            <div
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="absolute z-20 cursor-pointer transition-transform duration-150"
              style={{
                left: `${(node.x / 950) * 100}%`,
                top: `${(node.y / 400) * 100}%`,
                transform: `translate(-5%, -5%) scale(${isHovered ? 1.02 : 1})`,
              }}
            >
              <div
                className={`w-[170px] sm:w-[185px] rounded-lg border bg-[#111114] transition-colors ${
                  isHovered ? "border-zinc-500 shadow-md" : "border-zinc-800"
                }`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between p-2.5 border-b border-zinc-800/80 bg-[#16161a] rounded-t-lg">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-[11px] font-medium text-white truncate">
                      {node.title}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 shrink-0">
                    {node.badge}
                  </span>
                </div>

                {/* Node Body */}
                <div className="p-2.5 flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
                  <span className="text-[8px] uppercase tracking-wider text-zinc-600 font-semibold mb-0.5">
                    {node.category}
                  </span>
                  {node.details.map((detail, dIdx) => (
                    <div key={dIdx} className="flex items-center gap-1.5 text-zinc-300 truncate">
                      <span className="text-zinc-600">•</span>
                      <span className="truncate">{detail}</span>
                    </div>
                  ))}
                </div>

                {/* Status Footer */}
                <div className="px-2.5 py-1 bg-[#0c0c0e] border-t border-zinc-800/80 rounded-b-lg flex items-center justify-between text-[9px] font-mono text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
                    <span>Compiled</span>
                  </span>
                  <span>zod.ok</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Minimalist Floating Terminal Tag */}
        <div className="hidden sm:flex absolute bottom-3 right-4 z-30 items-center gap-2.5 px-3 py-1.5 rounded-md bg-[#101013] text-zinc-300 border border-zinc-800 text-[11px] font-mono shadow-md">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-500">$</span>
          <span>dezign2app compile</span>
          <span className="text-emerald-400 font-medium ml-2">✓ Ready</span>
        </div>
      </div>
    </div>
  );
};
