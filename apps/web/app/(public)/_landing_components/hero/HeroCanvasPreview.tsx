"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Globe,
  Server,
  Database,
  Layers,
  Terminal,
  Radio,
  Bell,
  ExternalLink,
  Laptop,
  Lock,
  Move,
  Plus,
  Minus,
  Maximize2,
  Network,
  Zap,
  Workflow,
  ArrowUpRight,
  Bot,
  Sparkles,
  CheckCircle2,
  GitPullRequest,
  Play,
  Pause,
  RotateCcw,
  Check,
  Code2,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TICKETS } from "./aiWorkerData";


interface NodeHandle {
  id: string;
  side: "left" | "right" | "bottom" | "top";
  offsetX?: number;
  offsetY?: number;
  color?: string;
  label?: string;
}

interface CanvasNode {
  id: string;
  title: string;
  category: string;
  badge: string;
  badgeVariant?: "purple" | "blue" | "amber" | "teal" | "zinc";
  icon: React.ElementType;
  // Compact coordinates (when infra is disabled)
  archX: number;
  archY: number;
  // Spacious coordinates (when infra is enabled)
  infraX: number;
  infraY: number;
  width: number;
  height: number;
  themeColor: string;
  details: string[];
  footerArtifact: string;
  subBadges?: string[];
  handles: NodeHandle[];
  // Incoming requests telemetry shown when Infrastructure Manager is enabled
  infraIncoming?: {
    baseCount: number;
    variance: number;
    unit?: string;
  };
}

interface Connection {
  id: string;
  d: string;
  delay: number;
  label: string;
  labelPos: { x: number; y: number };
  color?: string;
  isReturn?: boolean;
}

interface InfraDetails {
  category: string;
  engine: string;
  algorithm?: string;
  latencyP99?: string;
  replicationLag?: string;
  activeConns: string;
  health: string;
  upstream: string;
  description: string;
  metrics: { label: string; value: string; color?: string }[];
}

interface InfraCircle {
  id: string;
  x: number;
  y: number;
  label: string;
  sublabel: string;
  // For LBs: total incoming rate at the LB entry point
  baseRate: number;
  variance: number;
  unit?: string;
  // Number of downstream backend instances traffic is split across (LBs only)
  downstreamInstances?: number;
  type: "load-balancer" | "db-replica";
  details: InfraDetails;
}

// Canvas coordinate dimensions for both modes
const CANVAS_WIDTH_ARCH = 2280;
const CANVAS_HEIGHT_ARCH = 720;

const CANVAS_WIDTH_INFRA = 3200;
const CANVAS_HEIGHT_INFRA = 800;

/* =========================================================================
   TOPOLOGY NODES
   archX / archY: compact layout when infra is disabled (closer together)
   infraX / infraY: expanded layout when infra is enabled (room for LBs & replicas)
   ========================================================================= */
const NODES: CanvasNode[] = [
  {
    id: "auth",
    title: "better auth",
    category: "AUTH & RBAC",
    badge: "Auth / Connected",
    badgeVariant: "purple",
    icon: Lock,
    archX: 60,
    archY: 270,
    infraX: 80,
    infraY: 280,
    width: 210,
    height: 220,
    themeColor: "border-purple-800/70 bg-[#120f1d]",
    details: [
      "OAuth & Session Guard",
      "Sessions, Admin, Org, JWT",
      "Primary: PostgreSQL DB",
    ],
    footerArtifact: "better-auth.config",
    subBadges: ["OAuth", "RBAC", "JWT"],
    handles: [
      { id: "auth-out", side: "right", offsetY: 110, color: "bg-purple-500", label: "Auth Guard" },
    ],
    infraIncoming: {
      baseCount: 5840,
      variance: 60,
      unit: "req/s",
    },
  },
  {
    id: "webapp",
    title: "web",
    category: "WEB APP ROOT",
    badge: ":3000",
    badgeVariant: "zinc",
    icon: Laptop,
    archX: 340,
    archY: 250,
    infraX: 480,
    infraY: 260,
    width: 230,
    height: 260,
    themeColor: "border-zinc-700/80 bg-[#111116]",
    details: [
      "Next.js 15 App Router",
      "Public: /, /login, /register",
      "Private: /dashboard, /chat",
    ],
    footerArtifact: "next.config.ts",
    subBadges: ["SSR", "Zustand", "better-auth"],
    handles: [
      { id: "web-in-auth", side: "left", offsetY: 130, color: "bg-purple-500", label: "Auth In" },
      { id: "web-out-chat", side: "right", offsetY: 70, color: "bg-blue-400", label: "Private: /chat" },
      { id: "web-out-landing", side: "right", offsetY: 190, color: "bg-zinc-400", label: "Public Pages" },
    ],
    infraIncoming: {
      baseCount: 24850,
      variance: 220,
      unit: "req/s",
    },
  },
  {
    id: "chat-page",
    title: "/chat",
    category: "WEB PAGE ROUTE",
    badge: "/chat/[id]",
    badgeVariant: "blue",
    icon: Layers,
    archX: 640,
    archY: 85,
    infraX: 930,
    infraY: 85,
    width: 220,
    height: 210,
    themeColor: "border-blue-800/70 bg-[#0d1322]",
    details: [
      "Authenticated Chat UI",
      "POST /send-message trigger",
      "Real-Time Stream Listener",
    ],
    footerArtifact: "page.tsx",
    subBadges: ["Streaming", "Client Action"],
    handles: [
      { id: "chat-in-web", side: "left", offsetY: 105, color: "bg-blue-400", label: "Route Mount" },
      { id: "chat-out-service", side: "right", offsetY: 105, color: "bg-blue-400", label: "POST /send-message" },
      { id: "chat-in-sse", side: "bottom", offsetX: 110, color: "bg-emerald-400", label: "SSE Live Delivery" },
    ],
    infraIncoming: {
      baseCount: 14200,
      variance: 140,
      unit: "req/s",
    },
  },
  {
    id: "landing-pages",
    title: "Public & Auth Pages",
    category: "PAGE GROUP",
    badge: "4 Routes",
    badgeVariant: "zinc",
    icon: Globe,
    archX: 640,
    archY: 440,
    infraX: 930,
    infraY: 460,
    width: 220,
    height: 235,
    themeColor: "border-zinc-800 bg-[#101014]",
    details: [
      "/ (Landing Page)",
      "/login (Auth Login)",
      "/register (Sign Up)",
      "/404 (Not Found)",
    ],
    footerArtifact: "routes.manifest",
    subBadges: ["Static", "SEO Ready"],
    handles: [
      { id: "landing-in-web", side: "left", offsetY: 115, color: "bg-zinc-400", label: "Public Routes" },
    ],
    infraIncoming: {
      baseCount: 10650,
      variance: 110,
      unit: "req/s",
    },
  },
  {
    id: "table-ref",
    title: "conversations",
    category: "TABLE REF / POSTGRES",
    badge: ":5432",
    badgeVariant: "amber",
    icon: Database,
    archX: 930,
    archY: 280,
    infraX: 1380,
    infraY: 295,
    width: 200,
    height: 175,
    themeColor: "border-amber-700/70 bg-[#181107]",
    details: [
      "conversations schema",
      "Primary: PostgreSQL DB",
      "FK: user_id -> users.id",
    ],
    footerArtifact: "schema.prisma",
    subBadges: ["Drizzle", "Indexed"],
    handles: [
      { id: "table-out-query", side: "right", offsetY: 85, color: "bg-amber-400", label: "SQL Schema" },
      { id: "table-down-wal1", side: "bottom", offsetX: 60, color: "bg-amber-500", label: "WAL Stream" },
      { id: "table-down-wal2", side: "bottom", offsetX: 140, color: "bg-amber-500", label: "WAL Stream" },
    ],
    infraIncoming: {
      baseCount: 1850,
      variance: 25,
      unit: "w/s",
    },
  },
  {
    id: "chat-service",
    title: "chat",
    category: "SERVICE / API",
    badge: ":3002",
    badgeVariant: "blue",
    icon: Server,
    archX: 1190,
    archY: 85,
    infraX: 1770,
    infraY: 85,
    width: 220,
    height: 235,
    themeColor: "border-blue-700/80 bg-[#0b1220]",
    details: [
      "TypeScript / Express API",
      "GET /health",
      "POST /send-message (pub)",
      "Zod Contract Verified",
    ],
    footerArtifact: "zod.ok",
    subBadges: ["Express", "Kafka Producer"],
    handles: [
      { id: "service-in-api", side: "left", offsetY: 105, color: "bg-blue-400", label: "Endpoint Handler" },
      { id: "service-in-db", side: "left", offsetY: 160, color: "bg-amber-400", label: "DB Connection" },
      { id: "service-out-kafka", side: "right", offsetY: 115, color: "bg-teal-400", label: "Publish Event" },
    ],
    infraIncoming: {
      baseCount: 12850,
      variance: 130,
      unit: "req/s",
    },
  },
  {
    id: "kafka",
    title: "messaging",
    category: "KAFKA BROKER",
    badge: ":9092",
    badgeVariant: "teal",
    icon: Radio,
    archX: 1475,
    archY: 190,
    infraX: 2190,
    infraY: 190,
    width: 205,
    height: 210,
    themeColor: "border-teal-700/70 bg-[#071714]",
    details: [
      "topic: message.sent",
      "Partitions: 3 · Rep: 1",
      "At-Least-Once Delivery",
    ],
    footerArtifact: "cluster:9092",
    subBadges: ["chat.events", "Ordered"],
    handles: [
      { id: "kafka-in", side: "left", offsetY: 102, color: "bg-teal-400", label: "Topic: message.sent" },
      { id: "kafka-out", side: "right", offsetY: 102, color: "bg-teal-400", label: "Consumer Stream" },
    ],
    infraIncoming: {
      baseCount: 8420,
      variance: 85,
      unit: "msg/s",
    },
  },
  {
    id: "notification-service",
    title: "notification",
    category: "SERVICE / WORKER",
    badge: ":3005",
    badgeVariant: "blue",
    icon: Bell,
    archX: 1745,
    archY: 260,
    infraX: 2600,
    infraY: 260,
    width: 220,
    height: 225,
    themeColor: "border-blue-800/80 bg-[#0c1322]",
    details: [
      "Express.js Consumer",
      "GET /health",
      "Consumes: message.sent",
      "push_to_client Dispatcher",
    ],
    footerArtifact: "worker.ts",
    subBadges: ["Consumer Group", "Broadcaster"],
    handles: [
      { id: "notif-in-kafka", side: "left", offsetY: 110, color: "bg-teal-400", label: "Consume: message.sent" },
      { id: "notif-out-page", side: "right", offsetY: 110, color: "bg-purple-400", label: "push_to_client" },
    ],
    infraIncoming: {
      baseCount: 8420,
      variance: 85,
      unit: "req/s",
    },
  },
  {
    id: "page-ref",
    title: "conversations",
    category: "PAGE REF",
    badge: "Target: /chat",
    badgeVariant: "purple",
    icon: ExternalLink,
    archX: 2030,
    archY: 310,
    infraX: 2980,
    infraY: 310,
    width: 185,
    height: 130,
    themeColor: "border-purple-600/80 bg-[#160c26]",
    details: [
      "push_to_client target",
      "SSE Channel: /chat",
      "Live Page State Sync",
    ],
    footerArtifact: "target:/chat",
    subBadges: ["Live Stream"],
    handles: [
      { id: "pageref-in", side: "left", offsetY: 60, color: "bg-purple-400", label: "Client Delivery Target" },
      { id: "pageref-out-sse", side: "bottom", offsetX: 25, color: "bg-emerald-400", label: "SSE Return Loop" },
    ],
    infraIncoming: {
      baseCount: 8420,
      variance: 85,
      unit: "push/s",
    },
  },
];

/* =========================================================================
   1. COMPACT ARCHITECTURE CONNECTIONS (INFRA DISABLED)
   Nodes are closer together; no load balancers or replica nodes.
   ========================================================================= */
const ARCH_CONNECTIONS: Connection[] = [
  {
    id: "auth-web",
    d: "M 270 380 L 340 380",
    delay: 0,
    label: "auth guard",
    labelPos: { x: 305, y: 368 },
    color: "#a855f7",
  },
  {
    id: "web-chat",
    d: "M 570 320 C 605 320, 605 190, 640 190",
    delay: 0.3,
    label: "mounts route",
    labelPos: { x: 605, y: 245 },
    color: "#60a5fa",
  },
  {
    id: "web-landing",
    d: "M 570 440 C 605 440, 605 555, 640 555",
    delay: 0.4,
    label: "routes",
    labelPos: { x: 605, y: 505 },
    color: "#71717a",
  },
  {
    id: "chat-service",
    d: "M 860 190 L 1190 190",
    delay: 0.8,
    label: "POST /send-message",
    labelPos: { x: 1025, y: 175 },
    color: "#60a5fa",
  },
  {
    id: "table-service",
    d: "M 1130 365 C 1160 365, 1160 245, 1190 245",
    delay: 1.2,
    label: "SQL query",
    labelPos: { x: 1160, y: 300 },
    color: "#f59e0b",
  },
  {
    id: "service-kafka",
    d: "M 1410 200 C 1442 200, 1442 292, 1475 292",
    delay: 1.5,
    label: "pub: message.sent",
    labelPos: { x: 1442, y: 240 },
    color: "#14b8a6",
  },
  {
    id: "kafka-notification",
    d: "M 1680 292 C 1712 292, 1712 370, 1745 370",
    delay: 1.9,
    label: "sub: message.sent",
    labelPos: { x: 1712, y: 325 },
    color: "#14b8a6",
  },
  {
    id: "notification-pageref",
    d: "M 1965 370 L 2030 370",
    delay: 2.3,
    label: "push_to_client",
    labelPos: { x: 1997, y: 358 },
    color: "#a855f7",
  },
];

const ARCH_SSE_RETURN_CONNECTION: Connection = {
  id: "pageref-chat",
  d: "M 2055 440 C 1650 720, 1050 690, 750 295",
  delay: 0.2,
  label: "SSE Real-Time Push Stream",
  labelPos: { x: 1400, y: 660 },
  color: "#10b981",
  isReturn: true,
};

/* =========================================================================
   2. INFRASTRUCTURE MANAGER CIRCLES
   Load balancers and DB replicas placed in expanded gaps
   ========================================================================= */
const LOAD_BALANCER_CIRCLES: InfraCircle[] = [
  {
    id: "lb-webpage",
    x: 820,
    y: 260,
    label: "Ingress LB",
    sublabel: "Least-Conn",
    // Total ingress arriving at the LB
    baseRate: 24850,
    variance: 220,
    unit: "req/s",
    // 5 frontend worker instances → each receives ~4.97k req/s
    downstreamInstances: 5,
    type: "load-balancer",
    details: {
      category: "EDGE INGRESS / L7 PROXY",
      engine: "HAProxy 3.0 / Envoy Gateway",
      algorithm: "Least-Connections with Dynamic Weights",
      latencyP99: "3.2ms",
      activeConns: "4,180 active",
      health: "100% (5/5 targets healthy)",
      upstream: "web (:3000) ⇄ /chat route",
      description: "Terminates public HTTPS/HTTP2 traffic, applies IP rate limits, and distributes sessions across 5 frontend worker replicas.",
      metrics: [
        { label: "SSL Termination", value: "TLS 1.3 / Auto Let's Encrypt", color: "text-cyan-400" },
        { label: "Session Persistence", value: "IP Hash / Cookie Affinity", color: "text-zinc-300" },
        { label: "Health Check", value: "Interval 2s · Threshold 2", color: "text-emerald-400" },
        { label: "DDoS Mitigation", value: "Sync Gateway Shield Active", color: "text-teal-400" },
      ],
    },
  },
  {
    id: "lb-auth",
    x: 385,
    y: 390,
    label: "Auth LB",
    sublabel: "Session Proxy",
    // Total auth-related traffic arriving at the LB
    baseRate: 5840,
    variance: 60,
    unit: "req/s",
    // 2 auth instances → each gets ~2.9k req/s
    downstreamInstances: 2,
    type: "load-balancer",
    details: {
      category: "AUTHENTICATION GATEWAY",
      engine: "Envoy Proxy (mTLS Guard)",
      algorithm: "Round Robin + IP Sticky Session",
      latencyP99: "1.4ms",
      activeConns: "890 active",
      health: "100% (2/2 Auth instances online)",
      upstream: "better-auth (:3000/api/auth) ⇄ PostgreSQL",
      description: "Guards and distributes authentication handshakes, token verifications, and OAuth callbacks across 2 auth instances with zero-trust CSRF filtering.",
      metrics: [
        { label: "Rate Limit Guard", value: "120 req/s per IP", color: "text-amber-400" },
        { label: "JWT Cache", value: "Redis Cluster (hit 99.2%)", color: "text-cyan-400" },
        { label: "Handshake Mode", value: "mTLS SPIFFE Encrypted", color: "text-purple-400" },
        { label: "Session Timeout", value: "14 days sliding TTL", color: "text-zinc-300" },
      ],
    },
  },
  {
    id: "lb-service",
    x: 1260,
    y: 190,
    label: "Service Mesh LB",
    sublabel: "Envoy Proxy",
    // Total traffic arriving at the service mesh LB
    baseRate: 12850,
    variance: 130,
    unit: "req/s",
    // 3 Express pods → each handles ~4.3k req/s
    downstreamInstances: 3,
    type: "load-balancer",
    details: {
      category: "INTERNAL SERVICE MESH",
      engine: "Traefik / Envoy Sidecar",
      algorithm: "Consistent Hashing (x-user-id)",
      latencyP99: "0.9ms",
      activeConns: "2,340 active",
      health: "100% (3 Express pods online)",
      upstream: "/chat UI ➔ chat service (:3002)",
      description: "Routes internal JSON & protobuf requests between chat clients and distributes load across 3 backend worker pods with automatic circuit breaking.",
      metrics: [
        { label: "Circuit Breaker", value: "Closed (Err rate < 0.01%)", color: "text-emerald-400" },
        { label: "Retry Policy", value: "Max 3 (Exponential Backoff)", color: "text-cyan-400" },
        { label: "Tracing", value: "OpenTelemetry Distributed", color: "text-teal-400" },
        { label: "Timeout SLA", value: "250ms hard threshold", color: "text-zinc-300" },
      ],
    },
  },
  {
    id: "lb-db",
    x: 1675,
    y: 312,
    label: "PgBouncer LB",
    sublabel: "Query Router",
    // Total query throughput arriving at the pooler
    baseRate: 10250,
    variance: 110,
    unit: "req/s",
    // 3 targets: 1 primary (writes) + 2 read replicas
    downstreamInstances: 3,
    type: "load-balancer",
    details: {
      category: "DATABASE CONNECTION POOLER",
      engine: "PgBouncer 1.22 + HAProxy SQL",
      algorithm: "Transaction-Level Pooling",
      latencyP99: "1.8ms",
      activeConns: "185 / 250 pool",
      health: "100% (Primary + 2 Replicas)",
      upstream: "conversations schema (:5432)",
      description: "Routes write queries to Primary and read queries across 2 replicas, eliminating connection thrashing via transaction-level pooling.",
      metrics: [
        { label: "Read / Write Split", value: "Writes → Primary · Reads → 2× Replica", color: "text-amber-400" },
        { label: "Pool Mode", value: "Transaction Pooling", color: "text-cyan-400" },
        { label: "Reserve Pool", value: "15 emergency connections", color: "text-zinc-300" },
        { label: "Query Cache", value: "Prepared Statements OK", color: "text-emerald-400" },
      ],
    },
  },
];

const DB_REPLICA_CIRCLES: InfraCircle[] = [
  {
    id: "db-rep-01",
    x: 1420,
    y: 555,
    label: "DB Replica 01",
    sublabel: "Hot Standby (Reads)",
    baseRate: 4200,
    variance: 40,
    unit: "r/s",
    type: "db-replica",
    details: {
      category: "DATABASE READ REPLICA",
      engine: "PostgreSQL 16.2 Read-Only",
      algorithm: "Physical Streaming Replication",
      replicationLag: "0.2ms (32 B behind)",
      latencyP99: "0.6ms read query",
      activeConns: "92 / 100 conns",
      health: "Synchronous In-Sync",
      upstream: "Primary DB (:5432) via WAL",
      description: "Hot standby instance absorbing read-heavy SQL workloads like conversational history searches and member profile resolution.",
      metrics: [
        { label: "Replication Lag", value: "0.2ms (Streaming)", color: "text-amber-400 font-bold" },
        { label: "Buffer Cache Hit", value: "99.4% in-memory", color: "text-emerald-400" },
        { label: "Storage", value: "Multi-AZ NVMe SSD (io2)", color: "text-zinc-300" },
        { label: "Failover Priority", value: "Tier 1 (Auto-promote)", color: "text-cyan-400" },
      ],
    },
  },
  {
    id: "db-rep-02",
    x: 1540,
    y: 555,
    label: "DB Replica 02",
    sublabel: "Hot Standby (Reads)",
    baseRate: 4200,
    variance: 40,
    unit: "r/s",
    type: "db-replica",
    details: {
      category: "DATABASE READ REPLICA",
      engine: "PostgreSQL 16.2 Read-Only",
      algorithm: "Physical Streaming Replication",
      replicationLag: "0.3ms (48 B behind)",
      latencyP99: "0.7ms read query",
      activeConns: "88 / 100 conns",
      health: "Synchronous In-Sync",
      upstream: "Primary DB (:5432) via WAL",
      description: "Second hot standby instance dedicated to heavy analytics, background worker polling, and query bursts.",
      metrics: [
        { label: "Replication Lag", value: "0.3ms (Streaming)", color: "text-amber-400 font-bold" },
        { label: "Buffer Cache Hit", value: "99.1% in-memory", color: "text-emerald-400" },
        { label: "Storage", value: "Multi-AZ NVMe SSD (io2)", color: "text-zinc-300" },
        { label: "Failover Priority", value: "Tier 2 (Secondary Standby)", color: "text-cyan-400" },
      ],
    },
  },
];

// WAL replication lines from DB node to the 2 replica circles
const DB_REPLICATION_CONNECTIONS: Connection[] = [
  {
    id: "db-to-replica-01",
    d: "M 1440 470 C 1440 510, 1420 510, 1420 538",
    delay: 1.4,
    label: "WAL (0.2ms)",
    labelPos: { x: 1400, y: 505 },
    color: "#fbbf24",
    isReturn: true,
  },
  {
    id: "db-to-replica-02",
    d: "M 1520 470 C 1520 510, 1540 510, 1540 538",
    delay: 1.6,
    label: "WAL (0.3ms)",
    labelPos: { x: 1565, y: 505 },
    color: "#fbbf24",
    isReturn: true,
  },
];

/* =========================================================================
   3. SPACIOUS INFRASTRUCTURE MANAGER CONNECTIONS (INFRA ENABLED)
   Edges SPLIT and route THROUGH each LB/replica circle in expanded topology
   ========================================================================= */
const INFRA_CONNECTIONS: Connection[] = [
  // ── auth (290,390) ──► Auth LB left (368,390) ──► web (480,390) ──
  {
    id: "auth-to-lb-auth",
    d: "M 290 390 L 368 390",
    delay: 0,
    label: "",
    labelPos: { x: 329, y: 382 },
    color: "#a855f7",
  },
  {
    id: "lb-auth-to-web",
    d: "M 402 390 L 480 390",
    delay: 0.1,
    label: "auth guard",
    labelPos: { x: 441, y: 378 },
    color: "#a855f7",
  },
  // ── web/chat (710,330) ──► Ingress LB left (803,260) ──► chat-page (930,190) ──
  {
    id: "web-to-lb-webpage",
    d: "M 710 330 C 760 330, 770 260, 803 260",
    delay: 0.3,
    label: "",
    labelPos: { x: 755, y: 295 },
    color: "#60a5fa",
  },
  {
    id: "lb-webpage-to-chatpage",
    d: "M 837 260 C 875 260, 885 190, 930 190",
    delay: 0.4,
    label: "mounts route",
    labelPos: { x: 890, y: 215 },
    color: "#60a5fa",
  },
  // ── web/landing (710,450) ──► landing-pages (930,575) — no LB ──
  {
    id: "web-landing",
    d: "M 710 450 C 820 450, 820 575, 930 575",
    delay: 0.5,
    label: "routes",
    labelPos: { x: 820, y: 525 },
    color: "#71717a",
  },
  // ── chat-page (1150,190) ──► Service Mesh LB left (1243,190) ──► chat-service (1770,190) ──
  {
    id: "chatpage-to-lb-service",
    d: "M 1150 190 L 1243 190",
    delay: 0.8,
    label: "",
    labelPos: { x: 1196, y: 182 },
    color: "#60a5fa",
  },
  {
    id: "lb-service-to-chatservice",
    d: "M 1277 190 L 1770 190",
    delay: 0.9,
    label: "POST /send-message",
    labelPos: { x: 1520, y: 175 },
    color: "#60a5fa",
  },
  // ── table-ref (1580,380) ──► PgBouncer LB bottom (1675,329) ─ through ─ top (1675,295) ──► chat-service (1770,245) ──
  {
    id: "table-to-lb-db",
    d: "M 1580 380 C 1630 380, 1675 355, 1675 329",
    delay: 1.2,
    label: "",
    labelPos: { x: 1640, y: 365 },
    color: "#f59e0b",
  },
  {
    id: "lb-db-to-chatservice",
    d: "M 1675 295 C 1675 265, 1715 245, 1770 245",
    delay: 1.3,
    label: "SQL query",
    labelPos: { x: 1720, y: 255 },
    color: "#f59e0b",
  },
  // ── Downstream connections (spacious) ──
  {
    id: "service-kafka",
    d: "M 1990 200 C 2090 200, 2090 292, 2190 292",
    delay: 1.5,
    label: "pub: message.sent",
    labelPos: { x: 2090, y: 235 },
    color: "#14b8a6",
  },
  {
    id: "kafka-notification",
    d: "M 2395 292 C 2498 292, 2498 370, 2600 370",
    delay: 1.9,
    label: "sub: message.sent",
    labelPos: { x: 2498, y: 320 },
    color: "#14b8a6",
  },
  {
    id: "notification-pageref",
    d: "M 2820 370 L 2980 370",
    delay: 2.3,
    label: "push_to_client",
    labelPos: { x: 2900, y: 358 },
    color: "#a855f7",
  },
];

const INFRA_SSE_RETURN_CONNECTION: Connection = {
  id: "pageref-chat",
  d: "M 3005 440 C 2500 740, 1400 720, 1040 295",
  delay: 0.2,
  label: "SSE Real-Time Push Stream",
  labelPos: { x: 2000, y: 700 },
  color: "#10b981",
  isReturn: true,
};

export const HeroCanvasPreview: React.FC = () => {
  // Feature mode switcher: "architecture" vs "infrastructure" vs "ai-worker"
  const [activeMode, setActiveMode] = useState<"architecture" | "infrastructure" | "ai-worker">("ai-worker");
  const [trafficIntensity, setTrafficIntensity] = useState<"normal" | "burst">("normal");
  const [ticker, setTicker] = useState<number>(0);

  // AI Worker state
  const [selectedTicketIndex, setSelectedTicketIndex] = useState<number>(0);
  const [workerStep, setWorkerStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);
  const [isTicketCardMinimized, setIsTicketCardMinimized] = useState<boolean>(false);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState<boolean>(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState<"terminal" | "diff" | "bench">("terminal");

  const activeTicket = TICKETS[selectedTicketIndex];
  const currentStep = activeTicket?.steps?.[workerStep] || activeTicket.steps[0];

  // Auto-advance AI worker steps when active and playing
  useEffect(() => {
    if (activeMode !== "ai-worker" || !isPlaying) return;

    // Longer pause on step 5 (PR merged / solved) before looping to next step or next ticket
    const delay = workerStep === 5 ? 5000 / playbackSpeed : 3400 / playbackSpeed;

    const timer = setTimeout(() => {
      setWorkerStep((prev) => {
        if (prev >= 5) {
          return 0;
        }
        return prev + 1;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [activeMode, isPlaying, workerStep, playbackSpeed]);

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Hover and selection states for infrastructure nodes (LBs and replicas)
  const [hoveredInfraId, setHoveredInfraId] = useState<string | null>(null);
  const [selectedInfraId, setSelectedInfraId] = useState<string | null>(null);

  const activeInfraId = hoveredInfraId || selectedInfraId;
  const activeInfraNode = useMemo(() => {
    if (!activeInfraId) return null;
    return (
      LOAD_BALANCER_CIRCLES.find((lb) => lb.id === activeInfraId) ||
      DB_REPLICA_CIRCLES.find((rep) => rep.id === activeInfraId) ||
      null
    );
  }, [activeInfraId]);

  const [zoom, setZoom] = useState<number>(0.55);
  const reduceMotion = useReducedMotion();

  // Scroll and Drag-to-Pan state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);
  const [scrollStartY, setScrollStartY] = useState(0);

  // Live real-time ticker for dynamic incoming requests fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker((prev) => (prev + 1) % 100000);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Compute formatted live incoming requests text for a node
  const getIncomingBadgeText = useCallback(
    (node: CanvasNode): string | null => {
      if (!node.infraIncoming) return null;
      const multiplier = trafficIntensity === "burst" ? 2.75 : 1;
      const seed = Math.sin(ticker * 1.7 + node.infraIncoming.baseCount * 0.05);
      const jitter = Math.round(seed * node.infraIncoming.variance);
      const count = Math.max(0, Math.round((node.infraIncoming.baseCount + jitter) * multiplier));
      const unit = node.infraIncoming.unit || "req/s";

      if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k ${unit}`;
      }
      return `${count.toLocaleString()} ${unit}`;
    },
    [ticker, trafficIntensity]
  );

  // Compute live TOTAL ingress rate arriving at a circle (displayed as entry rate)
  const getCircleRate = useCallback(
    (circle: InfraCircle): string => {
      const multiplier = trafficIntensity === "burst" ? 2.75 : 1;
      const seed = Math.sin(ticker * 1.6 + circle.baseRate * 0.04);
      const jitter = Math.round(seed * circle.variance);
      const total = Math.max(0, Math.round((circle.baseRate + jitter) * multiplier));
      const unit = circle.unit || "req/s";

      if (total >= 1000) {
        return `${(total / 1000).toFixed(1)}k ${unit}`;
      }
      return `${total.toLocaleString()} ${unit}`;
    },
    [ticker, trafficIntensity]
  );

  // Compute live PER-INSTANCE rate after the LB distributes traffic
  const getCircleSplitRate = useCallback(
    (circle: InfraCircle): string | null => {
      if (!circle.downstreamInstances || circle.downstreamInstances <= 1) return null;
      const multiplier = trafficIntensity === "burst" ? 2.75 : 1;
      const seed = Math.sin(ticker * 1.6 + circle.baseRate * 0.04);
      const jitter = Math.round(seed * circle.variance);
      const total = Math.max(0, Math.round((circle.baseRate + jitter) * multiplier));
      const perInstance = Math.round(total / circle.downstreamInstances);
      const unit = circle.unit || "req/s";

      if (perInstance >= 1000) {
        return `${(perInstance / 1000).toFixed(1)}k ${unit}`;
      }
      return `${perInstance.toLocaleString()} ${unit}`;
    },
    [ticker, trafficIntensity]
  );

  // Aggregate live ingress for the header
  const totalIngress =
    trafficIntensity === "burst"
      ? Math.round(68420 + Math.sin(ticker * 2) * 580)
      : Math.round(24850 + Math.sin(ticker * 2) * 220);

  const isInfra = activeMode === "infrastructure";
  const canvasWidth = isInfra ? CANVAS_WIDTH_INFRA : CANVAS_WIDTH_ARCH;
  const canvasHeight = isInfra ? CANVAS_HEIGHT_INFRA : CANVAS_HEIGHT_ARCH;

  // Real-time SSE push loop from page-ref to /chat is revealed when either node is selected or hovered
  const isRealtimeEdgeVisible =
    selectedNode === "page-ref" ||
    selectedNode === "chat-page" ||
    hoveredNode === "page-ref" ||
    hoveredNode === "chat-page";

  // Visible connections — compact layout when infra disabled, spacious routed connections when infra enabled
  const activeConnections = useMemo(() => {
    if (isInfra) {
      const base = [...INFRA_CONNECTIONS, ...DB_REPLICATION_CONNECTIONS];
      return isRealtimeEdgeVisible ? [...base, INFRA_SSE_RETURN_CONNECTION] : base;
    } else if (activeMode === "ai-worker") {
      // In ai-worker mode:
      // When the new node is generated (step >= 2), replace direct edge with the AI-synthesized connections
      if (workerStep >= 2 && activeTicket.aiConnections.length > 0) {
        const filtered = ARCH_CONNECTIONS.filter(
          (c) => c.id !== activeTicket.replacedConnectionId
        );
        const base = [...filtered, ...activeTicket.aiConnections];
        return isRealtimeEdgeVisible ? [...base, ARCH_SSE_RETURN_CONNECTION] : base;
      }
      const base = ARCH_CONNECTIONS;
      return isRealtimeEdgeVisible ? [...base, ARCH_SSE_RETURN_CONNECTION] : base;
    } else {
      const base = ARCH_CONNECTIONS;
      return isRealtimeEdgeVisible ? [...base, ARCH_SSE_RETURN_CONNECTION] : base;
    }
  }, [isInfra, isRealtimeEdgeVisible, activeMode, workerStep, activeTicket]);


  // Dynamically compute the exact zoom scale that fits all nodes in view
  const computeFitZoom = useCallback(() => {
    if (!scrollContainerRef.current) return 0.55;
    const containerWidth = scrollContainerRef.current.clientWidth;
    const containerHeight = scrollContainerRef.current.clientHeight;

    const paddingX = 48;
    const paddingY = 32;

    const scaleX = (containerWidth - paddingX) / canvasWidth;
    const scaleY = (containerHeight - paddingY) / canvasHeight;

    const fitScale = Math.min(scaleX, scaleY);
    return Math.min(Math.max(Number(fitScale.toFixed(2)), 0.35), 1.0);
  }, [canvasWidth, canvasHeight]);

  // Adjust zoom automatically on mount, resize, and when toggling modes
  useEffect(() => {
    const applyFit = () => {
      const fitScale = computeFitZoom();
      setZoom(fitScale);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0;
        scrollContainerRef.current.scrollTop = 0;
      }
    };

    const timer = setTimeout(applyFit, 60);

    const handleResize = () => {
      applyFit();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeMode, computeFitZoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    if (scrollContainerRef.current) {
      setDragStartX(e.pageX - scrollContainerRef.current.offsetLeft);
      setDragStartY(e.pageY - scrollContainerRef.current.offsetTop);
      setScrollStartX(scrollContainerRef.current.scrollLeft);
      setScrollStartY(scrollContainerRef.current.scrollTop);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const currentX = e.pageX - scrollContainerRef.current.offsetLeft;
    const currentY = e.pageY - scrollContainerRef.current.offsetTop;
    const deltaX = (currentX - dragStartX) * 1.25;
    const deltaY = (currentY - dragStartY) * 1.25;
    scrollContainerRef.current.scrollLeft = scrollStartX - deltaX;
    scrollContainerRef.current.scrollTop = scrollStartY - deltaY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom helpers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(Number((prev + 0.05).toFixed(2)), 1.5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(Number((prev - 0.05).toFixed(2)), 0.3));
  };

  const handleFitView = () => {
    const fitScale = computeFitZoom();
    setZoom(fitScale);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: 0,
        top: 0,
        behavior: "smooth",
      });
    }
  };

  // Ctrl / Cmd + Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.04 : 0.04;
      setZoom((prev) =>
        Math.min(Math.max(Number((prev + delta).toFixed(2)), 0.3), 1.5)
      );
    }
  };

  return (
    <div className="w-full max-w-[1360px] rounded-xl border border-zinc-800 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col text-left mx-auto">
      {/* Studio Header Toolbar with Smooth Upcoming Features Switcher */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 bg-[#101014] px-4 py-2.5 gap-2">
        <div className="flex items-center gap-3">
          {/* Mac-style Window Controls */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
          </div>
          <span className="text-xs font-mono text-zinc-400 font-semibold hidden sm:inline-block">
            dezign2app-studio
          </span>

          <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />

          {/* Clean Feature Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#09090d] p-1 rounded-lg border border-zinc-800">
            {/* Tab 1: App Architecture */}
            <button
              onClick={() => {
                setActiveMode("architecture");
                setHoveredInfraId(null);
                setSelectedInfraId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                activeMode === "architecture"
                  ? "bg-zinc-800 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>App Architecture</span>
            </button>

            {/* Tab 2: Infrastructure Manager (Upcoming) */}
            <button
              onClick={() => {
                setActiveMode("infrastructure");
                setHoveredInfraId(null);
                setSelectedInfraId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                activeMode === "infrastructure"
                  ? "bg-teal-950/90 text-teal-300 border border-teal-700/80 shadow-xs"
                  : "text-zinc-400 hover:text-teal-300 hover:bg-zinc-800/50"
              }`}
            >
              <Network className="w-3.5 h-3.5 text-teal-400" />
              <span>Infrastructure Manager</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping inline-block" />
                Upcoming
              </span>
            </button>

            {/* Tab 3: Autonomous AI Worker (Upcoming) */}
            <button
              onClick={() => {
                setActiveMode("ai-worker");
                setHoveredInfraId(null);
                setSelectedInfraId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                activeMode === "ai-worker"
                  ? "bg-violet-950/90 text-violet-300 border border-violet-600/80 shadow-xs ring-1 ring-violet-500/30"
                  : "text-zinc-400 hover:text-violet-300 hover:bg-zinc-800/50"
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-violet-400" />
              <span>AI Worker</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 font-semibold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping inline-block" />
                Upcoming
              </span>
            </button>
          </div>
        </div>

        {/* Right Toolbar Status & Interactive Controls */}
        <div className="flex items-center gap-2.5">
          {activeMode === "ai-worker" ? (
            <div className="flex items-center gap-2">
              {/* Active Ticket Pill */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0d0718] border border-violet-800/70 text-[11px] font-mono text-violet-300">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-zinc-400 hidden sm:inline">Ticket:</span>
                <span className="font-bold text-violet-300">{activeTicket.displayNumber}</span>
                <span className="text-zinc-600 hidden sm:inline">·</span>
                <span className={workerStep === 5 ? "text-emerald-400 font-bold" : "text-violet-300 font-semibold"}>
                  {workerStep === 5 ? "PR Merged ✓" : `Step ${workerStep + 1}/6`}
                </span>
              </div>

              {/* Play / Pause Toggle Button */}
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                title={isPlaying ? "Pause AI Worker" : "Resume AI Worker"}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
              </button>

              {/* Reset / Replay Ticket Button */}
              <button
                onClick={() => setWorkerStep(0)}
                className="p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                title="Restart Ticket Resolution"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : activeMode === "infrastructure" ? (
            <>
              {/* Realtime Ingress Counter */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#09090d] border border-zinc-800 text-[11px] font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-zinc-400 hidden sm:inline">Live Ingress:</span>
                <span className="text-emerald-400 font-bold">
                  {totalIngress.toLocaleString()} req/s
                </span>
              </div>

              {/* Traffic Surge Simulation Toggle */}
              <button
                onClick={() =>
                  setTrafficIntensity((prev) => (prev === "normal" ? "burst" : "normal"))
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                  trafficIntensity === "burst"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs animate-pulse"
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                }`}
                title="Simulate traffic surge across load balancers and replicas"
              >
                <Zap
                  className={`w-3.5 h-3.5 ${
                    trafficIntensity === "burst"
                      ? "text-amber-400 fill-amber-400"
                      : "text-zinc-400"
                  }`}
                />
                <span className="hidden sm:inline">
                  {trafficIntensity === "burst" ? "Spike Active (2.8x)" : "Simulate Spike"}
                </span>
                <span className="sm:hidden">
                  {trafficIntensity === "burst" ? "2.8x" : "Spike"}
                </span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Full-Stack Graph · 8 Services</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={(e) => {
          if (
            !(e.target as HTMLElement).closest(".canvas-node-card") &&
            !(e.target as HTMLElement).closest("button")
          ) {
            setSelectedNode(null);
            setSelectedInfraId(null);
          }
        }}
        className={`relative w-full h-[460px] sm:h-[500px] md:h-[540px] lg:h-[580px] bg-[#070709] overflow-auto select-none hide-scrollbar ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-[#0a0a0d]`}
      >
        {/* Dynamic Canvas Sizer responding to Zoom & Canvas Mode Width */}
        <div
          style={{
            width: `${canvasWidth * zoom}px`,
            height: `${canvasHeight * zoom}px`,
          }}
          className="relative transition-[width,height] duration-300 ease-out"
        >
          {/* Transformed Scaled Canvas */}
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
            className="relative transition-[width,height] duration-300 ease-out"
          >
            {/* Subtle dot grid */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(#3f3f46 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />

            {/* Canvas SVG Connection Lines & Animated Data Packets */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            >
              {activeConnections.map((conn) => {
                const activeFocusNode = selectedNode || hoveredNode;
                const isHighlighted =
                  activeFocusNode &&
                  (conn.id.includes(activeFocusNode) ||
                    ((activeFocusNode === "chat-page" || activeFocusNode === "page-ref") &&
                      conn.isReturn));

                const particleDuration =
                  activeMode === "infrastructure" && trafficIntensity === "burst"
                    ? conn.isReturn
                      ? 1.8
                      : 1.9
                    : conn.isReturn
                    ? 3.4
                    : 3.8;

                return (
                  <g key={conn.id}>
                    {/* Connection Line */}
                    <path
                      d={conn.d}
                      fill="none"
                      stroke={
                        isHighlighted
                          ? "#e4e4e7"
                          : conn.isReturn
                          ? "#10b981"
                          : conn.color || "#27272a"
                      }
                      strokeWidth={conn.isReturn || isHighlighted ? "2.2" : "1.6"}
                      strokeDasharray={conn.isReturn ? "5 3" : "4 4"}
                      strokeOpacity={
                        isHighlighted ? "1" : conn.isReturn ? "0.85" : "0.55"
                      }
                    />

                    {/* Micro Edge Label */}
                    <text
                      x={conn.labelPos.x}
                      y={conn.labelPos.y}
                      fill={conn.isReturn ? "#34d399" : "#71717a"}
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="select-none font-medium"
                    >
                      {conn.label}
                    </text>

                    {/* Pulsing Animated Particle */}
                    {!reduceMotion && (
                      <motion.circle
                        key={`${conn.id}-${activeMode}`}
                        r={conn.isReturn ? "3.5" : "3"}
                        fill={
                          conn.isReturn ? "#34d399" : conn.color || "#a1a1aa"
                        }
                        animate={{ offsetDistance: ["0%", "100%"] }}
                        transition={{
                          duration: particleDuration,
                          repeat: Infinity,
                          ease: "linear",
                          delay: conn.delay,
                        }}
                        style={{ offsetPath: `path('${conn.d}')` }}
                      />
                    )}
                  </g>
                );
              })}

              {/* Laser Beam from AI Worker to Targeted Active Node */}
              {activeMode === "ai-worker" && currentStep && !reduceMotion && (
                <g key={`worker-laser-${workerStep}-${activeTicket.id}`}>
                  <defs>
                    <linearGradient id="workerLaserGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#c084fc" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: [0.65, 1, 0.65] }}
                    transition={{
                      pathLength: { duration: 0.3 },
                      opacity: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
                    }}
                    d={`M ${currentStep.agentTarget.x + 24} ${currentStep.agentTarget.y + 44} C ${currentStep.agentTarget.x + 24} ${(currentStep.agentTarget.y + currentStep.targetNodeCenter.y) / 2}, ${currentStep.targetNodeCenter.x} ${(currentStep.agentTarget.y + currentStep.targetNodeCenter.y) / 2}, ${currentStep.targetNodeCenter.x} ${currentStep.targetNodeCenter.y}`}
                    fill="none"
                    stroke="url(#workerLaserGrad)"
                    strokeWidth="2.2"
                    strokeDasharray="5 4"
                  />
                  <circle
                    cx={currentStep.targetNodeCenter.x}
                    cy={currentStep.targetNodeCenter.y}
                    r="6"
                    fill="#c084fc"
                    className="animate-ping"
                    opacity="0.8"
                  />
                  <circle
                    cx={currentStep.targetNodeCenter.x}
                    cy={currentStep.targetNodeCenter.y}
                    r="3.5"
                    fill="#f3e8ff"
                  />
                </g>
              )}
            </svg>

            {/* Small Circles Representing Load Balancers along the Connections */}
            <AnimatePresence>
              {activeMode === "infrastructure" &&
                LOAD_BALANCER_CIRCLES.map((lb) => {
                  const isHovered = activeInfraId === lb.id;

                  return (
                    <motion.div
                      key={lb.id}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ type: "spring", stiffness: 450, damping: 25 }}
                      style={{
                        left: `${lb.x - 17}px`,
                        top: `${lb.y - 17}px`,
                      }}
                      onMouseEnter={() => setHoveredInfraId(lb.id)}
                      onMouseLeave={() => setHoveredInfraId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInfraId((prev) => (prev === lb.id ? null : lb.id));
                      }}
                      className="absolute z-30 flex flex-col items-center pointer-events-auto select-none cursor-pointer"
                    >
                      {/* The Circular Load Balancer Node */}
                      <div
                        className={`w-[34px] h-[34px] rounded-full bg-[#0a121c] border-2 shadow-lg flex items-center justify-center relative transition-all duration-200 group ${
                          isHovered
                            ? "border-cyan-300 ring-4 ring-cyan-400/50 scale-125 shadow-cyan-500/50"
                            : "border-cyan-400 hover:border-cyan-300 hover:scale-110 shadow-cyan-950/80"
                        }`}
                        title={`${lb.label} (${lb.sublabel}) — Hover for live telemetry & specs`}
                      >
                        <Network
                          className={`w-4 h-4 transition-colors ${
                            isHovered ? "text-white" : "text-cyan-300"
                          }`}
                        />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400" />
                      </div>

                      {/* Micro Tag Attached to Circle */}
                      <div className="mt-1 flex flex-col items-center pointer-events-none">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/90 border whitespace-nowrap shadow-sm transition-colors ${
                            isHovered
                              ? "text-cyan-200 border-cyan-400 ring-1 ring-cyan-400/40"
                              : "text-cyan-300 border-cyan-500/50"
                          }`}
                        >
                          {lb.label}
                        </span>
                        {/* Show split-per-instance rate if this LB fans out to multiple backends */}
                        {lb.downstreamInstances && lb.downstreamInstances > 1 ? (
                          <span className="text-[8px] font-mono text-emerald-400 font-semibold mt-0.5 flex items-center gap-0.5">
                            <span>{getCircleSplitRate(lb)}</span>
                            <span className="text-zinc-500 font-normal">×{lb.downstreamInstances}</span>
                          </span>
                        ) : (
                          <span className="text-[8px] font-mono text-emerald-400 font-semibold mt-0.5">
                            {getCircleRate(lb)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* 2 Small Circles Representing DB Replicas Connected to the DB Node */}
            <AnimatePresence>
              {activeMode === "infrastructure" &&
                DB_REPLICA_CIRCLES.map((rep) => {
                  const isHovered = activeInfraId === rep.id;

                  return (
                    <motion.div
                      key={rep.id}
                      initial={{ opacity: 0, scale: 0, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0, y: -10 }}
                      transition={{ type: "spring", stiffness: 450, damping: 25 }}
                      style={{
                        left: `${rep.x - 17}px`,
                        top: `${rep.y - 17}px`,
                      }}
                      onMouseEnter={() => setHoveredInfraId(rep.id)}
                      onMouseLeave={() => setHoveredInfraId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInfraId((prev) => (prev === rep.id ? null : rep.id));
                      }}
                      className="absolute z-30 flex flex-col items-center pointer-events-auto select-none cursor-pointer"
                    >
                      {/* Circular Replica Node */}
                      <div
                        className={`w-[34px] h-[34px] rounded-full bg-[#160f06] border-2 shadow-lg flex items-center justify-center relative transition-all duration-200 group ${
                          isHovered
                            ? "border-amber-300 ring-4 ring-amber-400/50 scale-125 shadow-amber-500/50"
                            : "border-amber-400 hover:border-amber-300 hover:scale-110 shadow-amber-950/80"
                        }`}
                        title={`${rep.label} (${rep.sublabel}) — Hover for live telemetry & specs`}
                      >
                        <Database
                          className={`w-4 h-4 transition-colors ${
                            isHovered ? "text-white" : "text-amber-300"
                          }`}
                        />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      </div>

                      {/* Micro Tag Below Replica Circle */}
                      <div className="mt-1 flex flex-col items-center pointer-events-none">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/90 border whitespace-nowrap shadow-sm transition-colors ${
                            isHovered
                              ? "text-amber-200 border-amber-400 ring-1 ring-amber-400/40"
                              : "text-amber-300 border-amber-500/50"
                          }`}
                        >
                          {rep.label}
                        </span>
                        <span className="text-[8px] font-mono text-emerald-400 font-semibold mt-0.5">
                          {getCircleRate(rep)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* Interactive Flying Card Showing Rich Telemetry & Specs on Infra Node Hover */}
            <AnimatePresence>
              {activeMode === "infrastructure" && activeInfraNode && (
                <motion.div
                  key={`flying-card-${activeInfraNode.id}`}
                  initial={{
                    opacity: 0,
                    scale: 0.88,
                    y: activeInfraNode.y < 210 || activeInfraNode.y > 500 ? -10 : 10,
                  }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    y: activeInfraNode.y < 210 || activeInfraNode.y > 500 ? -8 : 8,
                  }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  style={{
                    left: `${activeInfraNode.x}px`,
                    top:
                      activeInfraNode.y < 210 || activeInfraNode.y > 500
                        ? `${activeInfraNode.y + 40}px`
                        : `${activeInfraNode.y - 24}px`,
                    transform:
                      activeInfraNode.y < 210 || activeInfraNode.y > 500
                        ? "translateX(-50%)"
                        : "translate(-50%, -100%)",
                  }}
                  onMouseEnter={() => setHoveredInfraId(activeInfraNode.id)}
                  onMouseLeave={() => setHoveredInfraId(null)}
                  className="absolute z-50 w-[310px] pointer-events-auto select-none"
                >
                  {(() => {
                    const isLb = activeInfraNode.type === "load-balancer";
                    const isPlaceBelow = activeInfraNode.y < 210 || activeInfraNode.y > 500;
                    const currentRate = getCircleRate(activeInfraNode);

                    return (
                      <div
                        className={`relative rounded-xl border backdrop-blur-xl shadow-2xl p-3.5 flex flex-col gap-2.5 ${
                          isLb
                            ? "bg-[#070e17]/95 border-cyan-500/50 shadow-cyan-950/90 ring-1 ring-cyan-500/30"
                            : "bg-[#140d05]/95 border-amber-500/50 shadow-amber-950/90 ring-1 ring-amber-500/30"
                        }`}
                      >
                        {/* Pointer beak pointing to the circle */}
                        {isPlaceBelow ? (
                          <div
                            className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-l border-t ${
                              isLb
                                ? "bg-[#070e17] border-cyan-500/50"
                                : "bg-[#140d05] border-amber-500/50"
                            }`}
                          />
                        ) : (
                          <div
                            className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b ${
                              isLb
                                ? "bg-[#070e17] border-cyan-500/50"
                                : "bg-[#140d05] border-amber-500/50"
                            }`}
                          />
                        )}

                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                                isLb
                                  ? "bg-cyan-950/80 border-cyan-500/50 text-cyan-300"
                                  : "bg-amber-950/80 border-amber-500/50 text-amber-300"
                              }`}
                            >
                              {isLb ? (
                                <Network className="w-4 h-4" />
                              ) : (
                                <Database className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white font-mono tracking-tight">
                                {activeInfraNode.label}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {activeInfraNode.details.engine}
                              </span>
                            </div>
                          </div>

                          {/* Live Status Pill */}
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 font-semibold shrink-0 ${
                              isLb
                                ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/50"
                                : "bg-amber-950/60 text-amber-300 border-amber-500/50"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {isLb ? "HEALTHY" : "IN-SYNC"}
                          </span>
                        </div>

                        {/* Category / Subtitle */}
                        <div className="flex items-center justify-between text-[9px] font-mono -mt-1">
                          <span className="text-zinc-500 uppercase tracking-wider font-semibold">
                            {activeInfraNode.details.category}
                          </span>
                          <span className="text-zinc-400">
                            {activeInfraNode.details.algorithm || "Replication"}
                          </span>
                        </div>

                        {/* Live Telemetry Metric Boxes */}
                        <div className="grid grid-cols-2 gap-1.5 bg-black/60 rounded-lg p-2 border border-zinc-800/80">
                          <div className="flex flex-col">
                            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono">
                              {isLb && activeInfraNode.downstreamInstances && activeInfraNode.downstreamInstances > 1
                                ? "Traffic Split"
                                : "Live Throughput"}
                            </span>
                            {isLb && activeInfraNode.downstreamInstances && activeInfraNode.downstreamInstances > 1 ? (
                              /* Traffic split breakdown: total → ÷N → per-instance */
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-mono text-zinc-500 shrink-0">In</span>
                                  <span className="text-[10px] font-bold font-mono text-emerald-400">
                                    {currentRate}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-mono text-zinc-500 shrink-0">÷{activeInfraNode.downstreamInstances}</span>
                                  <span className="text-[8px] font-mono text-zinc-500">backends</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-mono text-zinc-500 shrink-0">→</span>
                                  <span className="text-[10px] font-bold font-mono text-cyan-300">
                                    {getCircleSplitRate(activeInfraNode)}
                                  </span>
                                  <span className="text-[8px] font-mono text-zinc-500">each</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
                                  {currentRate}
                                </span>
                                <span className="text-[8px] font-mono text-zinc-500">
                                  {trafficIntensity === "burst" ? "2.8x spike load" : "steady ingress"}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono">
                              {isLb ? "Latency (p99)" : "WAL Lag"}
                            </span>
                            <span
                              className={`text-xs font-bold font-mono mt-0.5 ${
                                isLb ? "text-cyan-300" : "text-amber-300"
                              }`}
                            >
                              {isLb
                                ? activeInfraNode.details.latencyP99
                                : activeInfraNode.details.replicationLag}
                            </span>
                            <span className="text-[8px] font-mono text-zinc-500">
                              {activeInfraNode.details.activeConns}
                            </span>
                          </div>
                        </div>

                        {/* Concise Architectural Description */}
                        <p className="text-[10px] text-zinc-300 leading-relaxed font-sans">
                          {activeInfraNode.details.description}
                        </p>

                        {/* Technical Spec List */}
                        <div className="flex flex-col gap-1 border-t border-zinc-800/80 pt-2 text-[9px] font-mono">
                          {activeInfraNode.details.metrics.map((m, mIdx) => (
                            <div key={mIdx} className="flex items-center justify-between gap-1">
                              <span className="text-zinc-500">{m.label}:</span>
                              <span className={`font-medium ${m.color || "text-zinc-300"}`}>
                                {m.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Footer Upstream Route */}
                        <div className="flex items-center gap-1.5 border-t border-zinc-800/80 pt-1.5 text-[9px] font-mono text-zinc-400">
                          <ArrowUpRight className="w-3 h-3 text-zinc-500 shrink-0" />
                          <span className="text-zinc-500 shrink-0">Upstream:</span>
                          <span
                            className="text-zinc-300 truncate"
                            title={activeInfraNode.details.upstream}
                          >
                            {activeInfraNode.details.upstream}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Core Topology Nodes Layer - Animated Slide Transitions Between Compact & Expanded */}
            {NODES.map((node) => {
              const Icon = node.icon;
              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode === node.id;
              const isAgentActiveNode = activeMode === "ai-worker" && currentStep?.activeNodeId === node.id;
              const incomingBadge = isInfra ? getIncomingBadgeText(node) : null;
              const currentX = isInfra ? node.infraX : node.archX;
              const currentY = isInfra ? node.infraY : node.archY;

              return (
                <motion.div
                  key={node.id}
                  initial={false}
                  animate={{
                    x: currentX,
                    y: currentY,
                    scale: isSelected ? 1.03 : isAgentActiveNode ? 1.03 : isHovered ? 1.02 : 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 250,
                    damping: 27,
                    mass: 0.85,
                  }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode((prev) => (prev === node.id ? null : node.id));
                  }}
                  className="absolute top-0 left-0 z-20 cursor-pointer canvas-node-card select-none"
                >
                  <div
                    style={{ width: `${node.width}px` }}
                    className={`rounded-lg border transition-all shadow-md relative group ${
                      node.themeColor
                    } ${
                      isSelected
                        ? "ring-2 ring-emerald-400 border-emerald-400 shadow-2xl shadow-emerald-950/70"
                        : isAgentActiveNode
                        ? "ring-2 ring-violet-400 border-violet-400 shadow-2xl shadow-violet-900/80"
                        : isHovered
                        ? "ring-1 ring-zinc-400 shadow-xl shadow-black/60"
                        : "hover:border-zinc-600"
                    }`}
                  >
                    {/* Small Rectangle Badge Showing AI Worker Activity */}
                    <AnimatePresence>
                      {isAgentActiveNode && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.7, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.7, y: 4 }}
                          transition={{ type: "spring", stiffness: 450, damping: 25 }}
                          className="absolute -top-3.5 left-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#160a2c] border border-violet-400 shadow-lg text-[9px] font-mono font-bold text-violet-300 select-none whitespace-nowrap"
                        >
                          <Bot className="w-2.5 h-2.5 text-violet-400 animate-pulse" />
                          <span>AI Worker Modifying...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {/* Small Rectangle Badge with Numbers Showing Incoming Requests */}
                    <AnimatePresence>
                      {incomingBadge && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.7, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.7, y: 4 }}
                          transition={{ type: "spring", stiffness: 450, damping: 25 }}
                          className="absolute -top-3.5 right-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#080d16] border border-emerald-500/70 shadow-lg shadow-black/80 text-[10px] font-mono font-bold text-emerald-400 select-none whitespace-nowrap"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{incomingBadge}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Connection Handle Ports */}
                    {node.handles.map((h) => {
                      let handleStyle: React.CSSProperties = {};
                      if (h.side === "left") {
                        handleStyle = {
                          left: "-5px",
                          top: `${h.offsetY ?? node.height / 2}px`,
                          transform: "translateY(-50%)",
                        };
                      } else if (h.side === "right") {
                        handleStyle = {
                          right: "-5px",
                          top: `${h.offsetY ?? node.height / 2}px`,
                          transform: "translateY(-50%)",
                        };
                      } else if (h.side === "bottom") {
                        handleStyle = {
                          left: `${h.offsetX ?? node.width / 2}px`,
                          bottom: "-5px",
                          transform: "translateX(-50%)",
                        };
                      } else if (h.side === "top") {
                        handleStyle = {
                          left: `${h.offsetX ?? node.width / 2}px`,
                          top: "-5px",
                          transform: "translateX(-50%)",
                        };
                      }

                      const isSseHandle = h.id.includes("sse");
                      const handleActive = isSseHandle ? isRealtimeEdgeVisible : true;

                      return (
                        <span
                          key={h.id}
                          style={handleStyle}
                          className={`absolute w-2.5 h-2.5 rounded-full border border-zinc-950 shadow-sm transition-all group-hover:scale-125 z-30 ${
                            h.color || "bg-zinc-400"
                          } ${
                            isSseHandle && !handleActive
                              ? "opacity-35 scale-75"
                              : "opacity-100"
                          } ${
                            isSseHandle && handleActive
                              ? "ring-2 ring-emerald-400 animate-pulse scale-125"
                              : ""
                          }`}
                          title={
                            isSseHandle && !handleActive
                              ? `${h.label} (Click node to reveal realtime loop)`
                              : h.label
                          }
                        />
                      );
                    })}

                    {/* Node Header */}
                    <div className="flex items-center justify-between p-2.5 border-b border-zinc-800/80 bg-[#141419]/90 rounded-t-lg">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="text-[11px] font-semibold text-white truncate">
                          {node.title}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                          node.badgeVariant === "purple"
                            ? "bg-purple-950/70 text-purple-300 border-purple-800/70"
                            : node.badgeVariant === "blue"
                            ? "bg-blue-950/70 text-blue-300 border-blue-800/70"
                            : node.badgeVariant === "amber"
                            ? "bg-amber-950/70 text-amber-300 border-amber-800/70"
                            : node.badgeVariant === "teal"
                            ? "bg-teal-950/70 text-teal-300 border-teal-800/70"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700/60"
                        }`}
                      >
                        {activeMode === "infrastructure" && node.id === "table-ref"
                          ? "Primary Leader"
                          : node.badge}
                      </span>
                    </div>

                    {/* Sub-Badges / Tags */}
                    {node.subBadges && (
                      <div className="px-2.5 pt-2 flex flex-wrap gap-1">
                        {node.subBadges.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[8px] font-mono px-1 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Node Body Details */}
                    <div className="p-2.5 flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
                      <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                        {activeMode === "infrastructure" && node.id === "table-ref"
                          ? "PRIMARY DB (WRITES)"
                          : node.category}
                      </span>
                      {node.details.map((detail, dIdx) => (
                        <div
                          key={dIdx}
                          className="flex items-center gap-1.5 text-zinc-300 truncate"
                        >
                          <span className="text-zinc-600 text-[8px]">•</span>
                          <span className="truncate">{detail}</span>
                        </div>
                      ))}
                    </div>

                    {/* Status Footer */}
                    <div className="px-2.5 py-1.5 bg-[#0b0b0e] border-t border-zinc-800/80 rounded-b-lg flex items-center justify-between text-[9px] font-mono text-zinc-500">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        <span>
                          {activeMode === "infrastructure" ? "Ready" : "Compiled"}
                        </span>
                      </span>
                      <span className="truncate max-w-[100px] text-zinc-400 font-medium">
                        {node.footerArtifact}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Floating XYFlow-style Canvas Control Widget */}
        <div className="absolute bottom-3.5 left-4 z-40 flex items-center bg-[#121217]/95 backdrop-blur-md border border-zinc-800 rounded-lg shadow-xl p-1 gap-1 text-zinc-300 select-none">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
            title="Zoom Out (Ctrl + Scroll Down)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFitView}
            className="px-2 py-0.5 rounded hover:bg-zinc-800 hover:text-white text-[11px] font-mono min-w-[44px] text-center font-medium"
            title="Reset to Fit View"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
            title="Zoom In (Ctrl + Scroll Up)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />
          <button
            onClick={handleFitView}
            className="px-2 py-1 rounded hover:bg-zinc-800 hover:text-emerald-400 transition-colors text-[10px] font-mono flex items-center gap-1.5"
            title="Fit Entire Topology into Window"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fit Canvas</span>
          </button>
        </div>
      </div>

      {/* Floating Canvas Footer Status Bar */}
      <div className="border-t border-zinc-800/80 bg-[#101014] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Move className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-300">Drag to Pan</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">Ctrl + Wheel to Zoom</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-300">
              {activeInfraNode
                ? `Inspecting: ${activeInfraNode.label} (${activeInfraNode.details.engine})`
                : selectedNode
                ? `Selected: ${selectedNode} (Click to toggle)`
                : activeMode === "infrastructure"
                ? "Hover any Load Balancer or Replica circle for flying card telemetry"
                : "Click page-ref or /chat to show SSE stream"}
            </span>
          </div>
        </div>

        {isRealtimeEdgeVisible ? (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold bg-emerald-950/70 border border-emerald-500/50 px-2.5 py-0.5 rounded shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>SSE Return Loop: Active (conversations page ref ➔ /chat)</span>
          </div>
        ) : activeMode === "infrastructure" ? (
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-zinc-300">DB: 1 Primary + 2 Read Replicas</span>
            </span>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <span className="hidden sm:inline">
              WAL Lag: <strong className="text-amber-400">0.2ms</strong>
            </span>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <span className="hidden sm:inline">
              Query Balancing: <strong className="text-teal-400">PgBouncer (Read/Write Split)</strong>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
