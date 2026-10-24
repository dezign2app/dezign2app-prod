"use client";

import React, { useState } from "react";
import {
  Layers,
  Database,
  Workflow,
  Code2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Radio,
  Cpu,
  FileCode,
  Sparkles,
  Bot,
  ExternalLink,
} from "lucide-react";

interface ViewTab {
  id: "graph" | "schema" | "langgraph" | "page";
  title: string;
  badge: string;
  icon: React.ElementType;
  headline: string;
  description: string;
  bullets: string[];
}

const VIEW_TABS: ViewTab[] = [
  {
    id: "graph",
    title: "1. Architecture Graph",
    badge: "25+ Node Types",
    icon: Layers,
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
    icon: Database,
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
    icon: Workflow,
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
    badge: "Live Next.js Preview",
    icon: Code2,
    headline: "Frontend Code Studio, Monaco Editor & Live Viewport",
    description:
      "Navigate to any generated frontend page (/pages/[nodeId]) to inspect generated React 19 code, tweak components in Monaco, and preview live rendering in real time.",
    bullets: [
      "Virtual File Explorer & Monaco Editor: Edit generated Next.js 16 App Router code with full TypeScript syntax highlighting",
      "Live Preview Viewport: Real-time rendering of generated pages, pre-wired forms, and interactive components",
      "In-Context AI Page Assistant: Chat with an AI assistant to iteratively update page designs and generate UI logic",
      "Bidirectional Code Sync: Automatically detect and reconcile code differences with your local dev server",
    ],
  },
];

export const StudioViewsSection: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<"graph" | "schema" | "langgraph" | "page">("graph");
  const activeTab = VIEW_TABS.find((t) => t.id === activeTabId)!;

  return (
    <section id="studio-views" className="w-full py-24 bg-card/50 border-y border-border/60 scroll-mt-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-14 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-semibold uppercase tracking-wider">
            <span>4 Specialized View Perspectives</span>
          </div>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground"
          >
            One Model. Four Deep Perspectives.
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Dezign2App doesn't flatten your system into a basic diagram. Seamlessly switch between distributed topologies, database ERDs, LangGraph state machines, and live frontend page studios.
          </p>
        </div>

        {/* Tab Selection Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-4xl p-1.5 bg-muted/60 border border-border/80 rounded-2xl mb-10 shadow-xs">
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex flex-col items-start text-left p-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-md border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                    {tab.badge}
                  </span>
                </div>
                <span className="text-xs font-semibold">{tab.title}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Feature Description & Bullets */}
          <div className="lg:col-span-5 flex flex-col text-left gap-5">
            <div>
              <span className="text-xs font-mono text-primary font-semibold uppercase tracking-wider">
                {activeTab.title}
              </span>
              <h3
                style={{ fontFamily: "var(--font-display)" }}
                className="text-2xl sm:text-3xl font-bold text-foreground mt-2 leading-tight"
              >
                {activeTab.headline}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {activeTab.description}
            </p>

            <div className="flex flex-col gap-3 mt-2">
              {activeTab.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs text-foreground/90 leading-normal">
                    {bullet}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <a
                href="/sign-up"
                className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline group"
              >
                <span>Try this perspective in the Studio</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          {/* Right Column: Realistic UI Mockup for the Active Tab */}
          <div className="lg:col-span-7 w-full">
            <div className="w-full rounded-2xl border border-border bg-background shadow-xl overflow-hidden text-left font-mono">
              {/* Window Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-medium text-foreground text-[11px]">
                    {activeTabId === "graph" && "view=graph • Distributed Topology Mesh"}
                    {activeTabId === "schema" && "view=schema • Relational ERD & Redis TTL"}
                    {activeTabId === "langgraph" && "view=langgraph • Multi-Agent State Graph"}
                    {activeTabId === "page" && "view=pages/[nodeId] • Monaco & Live Preview"}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">dezign2app v0.0.1</span>
              </div>

              {/* Visual Body based on Active Tab */}
              <div className="p-5 min-h-[360px] flex items-center justify-center bg-[#FAFBFD] dark:bg-[#0E1117] relative">
                {activeTabId === "graph" && (
                  <div className="w-full flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b pb-2">
                      <span>Node Mesh (25 Available Types)</span>
                      <span className="text-emerald-500 font-semibold">● Graph Connected</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                      <div className="p-3 rounded-lg border bg-card shadow-2xs flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-blue-500 text-xs font-bold">
                          <Radio className="w-3.5 h-3.5" />
                          <span>WebSocket Hub</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Broadcast & Heartbeat</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 w-fit">ws://broadcast</span>
                      </div>
                      <div className="p-3 rounded-lg border bg-card shadow-2xs flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-purple-500 text-xs font-bold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Better Auth Node</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">OAuth, RBAC & Sessions</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 w-fit">verifyEmail: false</span>
                      </div>
                      <div className="p-3 rounded-lg border bg-card shadow-2xs flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold">
                          <Cpu className="w-3.5 h-3.5" />
                          <span>Zustand Store</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Single-Reducer State</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-600 w-fit">persistent: true</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black text-white text-[11px] flex items-center justify-between mt-2">
                      <span>Auto-layout router: elkjs + dagre layout resolved</span>
                      <span className="text-emerald-400">0 errors</span>
                    </div>
                  </div>
                )}

                {activeTabId === "schema" && (
                  <div className="w-full flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* PostgreSQL Table Card */}
                      <div className="rounded-lg border bg-card p-3 shadow-2xs text-[11px]">
                        <div className="flex items-center justify-between border-b pb-1.5 mb-2 font-bold text-foreground">
                          <span>table: users</span>
                          <span className="text-[9px] px-1 rounded bg-indigo-50 text-indigo-600">PostgreSQL</span>
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                          <div className="flex justify-between font-mono">
                            <span className="text-foreground">id (PK)</span>
                            <span>uuid NOT NULL</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-foreground">email</span>
                            <span>varchar(255) UNIQUE</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-foreground">role</span>
                            <span>enum(&apos;admin&apos;, &apos;user&apos;)</span>
                          </div>
                        </div>
                      </div>

                      {/* Redis Schema Card */}
                      <div className="rounded-lg border bg-card p-3 shadow-2xs text-[11px]">
                        <div className="flex items-center justify-between border-b pb-1.5 mb-2 font-bold text-foreground">
                          <span>redis: session_cache</span>
                          <span className="text-[9px] px-1 rounded bg-rose-50 text-rose-600">Redis Key-Value</span>
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                          <div className="flex justify-between font-mono">
                            <span className="text-foreground">pattern</span>
                            <span>sess:{'{userId}'}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-foreground">type</span>
                            <span>HASH / JSON</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-foreground">TTL</span>
                            <span>86400s (24h)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 rounded bg-muted/60 text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Foreign key relationship: users.id → orders.user_id</span>
                      <span className="text-primary font-bold">1:N CASCADE</span>
                    </div>
                  </div>
                )}

                {activeTabId === "langgraph" && (
                  <div className="w-full flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b pb-2">
                      <span>LangGraph Multi-Agent Architecture</span>
                      <span className="text-rose-500 font-semibold">● LangGraph 1.4</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3 bg-muted/40 rounded-xl border">
                      <div className="p-2 rounded bg-background border text-center text-[10px] font-bold">
                        <span>__start__</span>
                      </div>
                      <span className="text-muted-foreground text-xs">→</span>
                      <div className="p-2 rounded bg-primary/10 border border-primary/30 text-center text-[10px] font-bold text-primary">
                        <span>Router Agent</span>
                      </div>
                      <span className="text-muted-foreground text-xs">→</span>
                      <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30 text-center text-[10px] font-bold text-purple-600">
                        <span>MCP Tools</span>
                      </div>
                      <span className="text-muted-foreground text-xs">→</span>
                      <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-center text-[10px] font-bold text-emerald-600">
                        <span>SSE Stream</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black text-white text-[10px] flex flex-col gap-1">
                      <span className="text-zinc-400">// Model Context Protocol (MCP) Binding</span>
                      <span className="text-emerald-400">tool_call: inspect_architecture_model(node_id=&quot;auth&quot;)</span>
                      <span className="text-zinc-300">result: &quot;BetterAuth session verified with RBAC guards.&quot;</span>
                    </div>
                  </div>
                )}

                {activeTabId === "page" && (
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b pb-1.5">
                      <span>pages/[nodeId] • Virtual Monaco Studio & Live Preview</span>
                      <span className="text-blue-500 font-semibold">Next.js 16 Preview</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {/* Left: Code Editor snippet */}
                      <div className="p-2.5 rounded bg-zinc-950 text-zinc-200 border border-zinc-800 flex flex-col gap-1 overflow-hidden">
                        <span className="text-zinc-500 text-[9px]">// page.tsx</span>
                        <span className="text-pink-400">export default function</span> UserPage() {'{'}
                        <span className="ml-2 text-zinc-300">const auth = <span className="text-blue-300">useAuth</span>();</span>
                        <span className="ml-2 text-emerald-400">return &lt;UserDashboard user={'{auth}'} /&gt;;</span>
                        <span>{'}'}</span>
                      </div>
                      {/* Right: Preview Viewport simulation */}
                      <div className="p-2.5 rounded bg-white text-zinc-800 border flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="font-bold text-[10px]">User Profile Dashboard</span>
                          <span className="text-[8px] px-1 rounded bg-emerald-100 text-emerald-700">Live</span>
                        </div>
                        <div className="flex flex-col gap-1 my-1">
                          <div className="h-2 w-3/4 bg-gray-200 rounded animate-pulse" />
                          <div className="h-2 w-1/2 bg-gray-200 rounded animate-pulse" />
                        </div>
                        <button className="w-full py-1 bg-black text-white text-[9px] rounded font-sans font-medium">
                          Update Profile
                        </button>
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-muted/60 text-[9px] text-muted-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Bot className="w-3 h-3 text-primary" />
                        <span>AI Page Assistant ready</span>
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
