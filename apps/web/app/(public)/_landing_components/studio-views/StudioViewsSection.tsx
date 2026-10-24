"use client";

import React, { useState } from "react";
import {
  Layers,
  Database,
  Workflow,
  Code2,
  Check,
  ArrowRight,
  ShieldCheck,
  Radio,
  Cpu,
  Bot,
} from "lucide-react";

interface ViewTab {
  id: "graph" | "schema" | "langgraph" | "page";
  title: string;
  badge: string;
  headline: string;
  description: string;
  bullets: string[];
}

const VIEW_TABS: ViewTab[] = [
  {
    id: "graph",
    title: "1. Architecture Graph",
    badge: "25+ Nodes",
    headline: "Visual Distributed Topology & Real-Time Protocol Mesh",
    description:
      "Design your system topology with microservices, API gateways, message queues, and client state stores. Dezign2App auto-routes edges and validates connection contracts in real-time.",
    bullets: [
      "25+ Node Types: Gateways, Microservices, Databases, Kafka, RabbitMQ, S3 Buckets, Creem Payments",
      "Real-Time Protocol Bindings: Full-stack WebSockets, WebRTC peer-to-peer data/media, and SSE listeners",
      "Authentication & Security: Better Auth with toggleable verification, OAuth (Google/GitHub), and RBAC guards",
      "Zustand State Stores & Browser Storage: Client state models with single-reducer per variable architecture",
    ],
  },
  {
    id: "schema",
    title: "2. Schema & ERD",
    badge: "Postgres • Redis",
    headline: "Visual Entity Relational & Key-Value Cache Modeling",
    description:
      "Design database schemas visually. Create tables, relations, and indexes with automatic foreign key resolution, plus dedicated Redis key-value, TTL, and Pub/Sub channel modeling.",
    bullets: [
      "Relational Databases: PostgreSQL, MySQL, and SQLite entity modeling with automated migrations and seed scripts",
      "Dedicated Redis Modeling: Model keys, TTLs, hashes, sorted sets, streams, and Pub/Sub topic subscriptions",
      "Foreign Key Visual Relationships: Drag and drop links between columns to establish relational integrity",
      "Type-Safe Code Generation: Automatically compiles into Zod schemas, TypeScript types, and database clients",
    ],
  },
  {
    id: "langgraph",
    title: "3. LangGraph Studio",
    badge: "Multi-Agent AI",
    headline: "Stateful Multi-Agent Graphs & Model Context Protocol (MCP)",
    description:
      "Craft complex multi-agent state machines, conditional router branches, and LLM tool chains directly inside your architecture diagram.",
    bullets: [
      "Visual State Machine Canvas: Connect start nodes, agent nodes, router conditional edges, tools, and subgraphs",
      "Model Context Protocol (MCP): Native MCP tool execution to inspect architectures and query context",
      "Multi-Mode Streaming: Real-time token-by-token streaming over SSE and WebSockets with reasoning token support",
      "Thread Isolation: Per-session thread IDs, checkpoint persistence (PostgreSQL/Redis), and testing sandboxes",
    ],
  },
  {
    id: "page",
    title: "4. Visual Page Editor",
    badge: "Live Preview",
    headline: "Frontend Code Studio, Monaco Editor & Live Viewport",
    description:
      "Navigate to any generated frontend page (/pages/[nodeId]) to inspect generated React 19 code, tweak components in Monaco, and preview live rendering in real time.",
    bullets: [
      "Virtual File Explorer & Monaco Editor: Edit generated Next.js 16 App Router code with full TypeScript syntax highlighting",
      "Live Preview Viewport: Real-time rendering of generated pages, pre-wired forms, and interactive components",
      "In-Context AI Page Assistant: Chat with an AI assistant to iteratively update page designs and generate UI logic",
      "Non-Destructive Code Sync: Safely reconcile architecture updates with your local codebase without overwriting custom business logic",
    ],
  },
];

export const StudioViewsSection: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<"graph" | "schema" | "langgraph" | "page">("graph");
  const activeTab = VIEW_TABS.find((t) => t.id === activeTabId)!;

  return (
    <section id="studio-views" className="w-full py-24 bg-[#08080a] border-t border-zinc-900 scroll-mt-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-12 max-w-2xl">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Studio Perspectives
          </span>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white"
          >
            One Model. Four Perspectives.
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Switch seamlessly between distributed topology graphs, database ERD schemas, LangGraph multi-agent state machines, and live frontend page studios.
          </p>
        </div>

        {/* Tab Selection Bar - Clean Segmented Control */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 w-full max-w-3xl p-1 bg-[#101014] border border-zinc-800 rounded-lg mb-12">
          {VIEW_TABS.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`py-2 px-3 rounded-md text-xs font-mono text-center transition-all ${
                  isActive
                    ? "bg-zinc-800 text-white font-medium shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Feature Description & Bullets */}
          <div className="lg:col-span-5 flex flex-col text-left gap-4">
            <div>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                {activeTab.title}
              </span>
              <h3
                style={{ fontFamily: "var(--font-display)" }}
                className="text-2xl sm:text-3xl font-bold text-white mt-1.5 leading-tight"
              >
                {activeTab.headline}
              </h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {activeTab.description}
            </p>

            <div className="flex flex-col gap-2.5 mt-2">
              {activeTab.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-xs text-zinc-300 leading-normal">
                    {bullet}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <a
                href="/sign-up"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white hover:text-zinc-300 transition-colors group"
              >
                <span>Open in Studio</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          {/* Right Column: Minimalist Technical Blueprint Showcase */}
          <div className="lg:col-span-7 w-full">
            <div className="w-full rounded-xl border border-zinc-800 bg-[#0b0b0e] shadow-xl overflow-hidden text-left font-mono">
              {/* Window Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#121215] border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-700" />
                  <span className="w-2 h-2 rounded-full bg-zinc-700" />
                  <span className="w-2 h-2 rounded-full bg-zinc-700" />
                  <span className="ml-2 font-mono text-zinc-400 text-[11px]">
                    {activeTabId === "graph" && "view=graph · distributed-topology"}
                    {activeTabId === "schema" && "view=schema · database-erd"}
                    {activeTabId === "langgraph" && "view=langgraph · agent-state-machine"}
                    {activeTabId === "page" && "view=pages/[nodeId] · live-page-studio"}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">dezign2app</span>
              </div>

              {/* Visual Body */}
              <div className="p-5 min-h-[340px] flex items-center justify-center bg-[#070709] relative">
                {activeTabId === "graph" && (
                  <div className="w-full flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-800 pb-2">
                      <span>Node Topology (25 Available Types)</span>
                      <span className="text-emerald-400">● Connected</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="p-3 rounded-lg border border-zinc-800 bg-[#111114] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-zinc-200 text-xs font-semibold">
                          <Radio className="w-3.5 h-3.5 text-zinc-400" />
                          <span>WebSocket Hub</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">Broadcast &amp; Heartbeat</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 w-fit">ws://broadcast</span>
                      </div>
                      <div className="p-3 rounded-lg border border-zinc-800 bg-[#111114] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-zinc-200 text-xs font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Better Auth Node</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">OAuth &amp; RBAC Guards</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 w-fit">verifyEmail: false</span>
                      </div>
                      <div className="p-3 rounded-lg border border-zinc-800 bg-[#111114] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-zinc-200 text-xs font-semibold">
                          <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Zustand Store</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">Single-Reducer State</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 w-fit">persistent: true</span>
                      </div>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 text-[10px] flex items-center justify-between mt-2">
                      <span>Auto-layout router: elkjs + dagre layout resolved</span>
                      <span className="text-emerald-400">0 errors</span>
                    </div>
                  </div>
                )}

                {activeTabId === "schema" && (
                  <div className="w-full flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3 text-[11px]">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2 font-bold text-white">
                          <span>table: users</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">PostgreSQL</span>
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] text-zinc-400">
                          <div className="flex justify-between font-mono">
                            <span className="text-zinc-200">id (PK)</span>
                            <span>uuid NOT NULL</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-zinc-200">email</span>
                            <span>varchar(255) UNIQUE</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-zinc-200">role</span>
                            <span>enum(&apos;admin&apos;, &apos;user&apos;)</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3 text-[11px]">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2 font-bold text-white">
                          <span>redis: session_cache</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Redis Key-Value</span>
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] text-zinc-400">
                          <div className="flex justify-between font-mono">
                            <span className="text-zinc-200">pattern</span>
                            <span>sess:{'{userId}'}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-zinc-200">type</span>
                            <span>HASH / JSON</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-zinc-200">TTL</span>
                            <span>86400s (24h)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800/80 text-[10px] text-zinc-400 flex items-center justify-between">
                      <span>Foreign key relation: users.id → orders.user_id</span>
                      <span className="text-zinc-300">1:N CASCADE</span>
                    </div>
                  </div>
                )}

                {activeTabId === "langgraph" && (
                  <div className="w-full flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-800 pb-2">
                      <span>LangGraph Multi-Agent Architecture</span>
                      <span className="text-emerald-400">● LangGraph 1.4</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3 bg-[#111114] rounded-lg border border-zinc-800">
                      <div className="px-2.5 py-1.5 rounded bg-zinc-800 text-center text-[10px] font-mono text-zinc-300">
                        <span>__start__</span>
                      </div>
                      <span className="text-zinc-600 text-xs">→</span>
                      <div className="px-2.5 py-1.5 rounded bg-zinc-800 text-center text-[10px] font-mono text-white font-medium border border-zinc-700">
                        <span>Router Agent</span>
                      </div>
                      <span className="text-zinc-600 text-xs">→</span>
                      <div className="px-2.5 py-1.5 rounded bg-zinc-800 text-center text-[10px] font-mono text-zinc-300">
                        <span>MCP Tools</span>
                      </div>
                      <span className="text-zinc-600 text-xs">→</span>
                      <div className="px-2.5 py-1.5 rounded bg-zinc-800 text-center text-[10px] font-mono text-zinc-300">
                        <span>SSE Stream</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800 text-[10px] flex flex-col gap-1 text-zinc-400">
                      <span className="text-zinc-500">// Model Context Protocol (MCP) Binding</span>
                      <span className="text-zinc-300">tool_call: inspect_architecture_model(node_id=&quot;auth&quot;)</span>
                      <span className="text-zinc-500">result: &quot;BetterAuth session verified with RBAC guards.&quot;</span>
                    </div>
                  </div>
                )}

                {activeTabId === "page" && (
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-800 pb-1.5">
                      <span>pages/[nodeId] · Monaco Studio &amp; Live Preview</span>
                      <span className="text-zinc-400">Next.js 16</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2.5 rounded bg-[#111114] text-zinc-300 border border-zinc-800 flex flex-col gap-1 overflow-hidden">
                        <span className="text-zinc-500 text-[9px]">// page.tsx</span>
                        <span className="text-zinc-100">export default function UserPage() {'{'}</span>
                        <span className="ml-2 text-zinc-400">const auth = useAuth();</span>
                        <span className="ml-2 text-zinc-300">return &lt;UserDashboard /&gt;;</span>
                        <span className="text-zinc-100">{'}'}</span>
                      </div>
                      <div className="p-2.5 rounded bg-[#111114] text-zinc-200 border border-zinc-800 flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                          <span className="font-medium text-[10px] text-white">Dashboard Viewport</span>
                          <span className="text-[8px] px-1 rounded bg-zinc-800 text-emerald-400">Live</span>
                        </div>
                        <div className="flex flex-col gap-1 my-1.5">
                          <div className="h-1.5 w-3/4 bg-zinc-800 rounded" />
                          <div className="h-1.5 w-1/2 bg-zinc-800 rounded" />
                        </div>
                        <button className="w-full py-1 bg-white text-black text-[9px] rounded font-medium">
                          Update Profile
                        </button>
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-zinc-900/60 border border-zinc-800/80 text-[9px] text-zinc-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Bot className="w-3 h-3 text-zinc-400" />
                        <span>AI Assistant ready</span>
                      </span>
                      <span>Dev server synced</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
