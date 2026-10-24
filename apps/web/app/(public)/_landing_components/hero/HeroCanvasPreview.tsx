"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
} from "lucide-react";

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
  x: number;
  y: number;
  width: number;
  height: number;
  themeColor: string;
  details: string[];
  footerArtifact: string;
  subBadges?: string[];
  handles: NodeHandle[];
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

const CANVAS_WIDTH = 2240;
const CANVAS_HEIGHT = 720;

const NODES: CanvasNode[] = [
  {
    id: "auth",
    title: "better auth",
    category: "AUTH & RBAC",
    badge: "Auth / Connected",
    badgeVariant: "purple",
    icon: Lock,
    x: 60,
    y: 280,
    width: 205,
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
  },
  {
    id: "webapp",
    title: "web",
    category: "WEB APP ROOT",
    badge: ":3000",
    badgeVariant: "zinc",
    icon: Laptop,
    x: 340,
    y: 260,
    width: 225,
    height: 255,
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
      { id: "web-out-landing", side: "right", offsetY: 180, color: "bg-zinc-400", label: "Public Pages" },
    ],
  },
  {
    id: "chat-page",
    title: "/chat",
    category: "WEB PAGE ROUTE",
    badge: "/chat/[id]",
    badgeVariant: "blue",
    icon: Layers,
    x: 640,
    y: 110,
    width: 215,
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
      { id: "chat-in-sse", side: "bottom", offsetX: 108, color: "bg-emerald-400", label: "SSE Live Delivery" },
    ],
  },
  {
    id: "landing-pages",
    title: "Public & Auth Pages",
    category: "PAGE GROUP",
    badge: "4 Routes",
    badgeVariant: "zinc",
    icon: Globe,
    x: 640,
    y: 440,
    width: 215,
    height: 230,
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
  },
  {
    id: "table-ref",
    title: "conversations",
    category: "TABLE REF / POSTGRES",
    badge: ":5432",
    badgeVariant: "amber",
    icon: Database,
    x: 930,
    y: 230,
    width: 190,
    height: 170,
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
    ],
  },
  {
    id: "chat-service",
    title: "chat",
    category: "SERVICE / API",
    badge: ":3002",
    badgeVariant: "blue",
    icon: Server,
    x: 1170,
    y: 110,
    width: 215,
    height: 230,
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
  },
  {
    id: "kafka",
    title: "messaging",
    category: "KAFKA BROKER",
    badge: ":9092",
    badgeVariant: "teal",
    icon: Radio,
    x: 1450,
    y: 220,
    width: 195,
    height: 205,
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
  },
  {
    id: "notification-service",
    title: "notification",
    category: "SERVICE / WORKER",
    badge: ":3005",
    badgeVariant: "blue",
    icon: Bell,
    x: 1720,
    y: 290,
    width: 215,
    height: 220,
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
  },
  {
    id: "page-ref",
    title: "conversations",
    category: "PAGE REF",
    badge: "Target: /chat",
    badgeVariant: "purple",
    icon: ExternalLink,
    x: 2010,
    y: 340,
    width: 175,
    height: 125,
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
      { id: "pageref-out-sse", side: "bottom", offsetX: 20, color: "bg-emerald-400", label: "SSE Return Loop" },
    ],
  },
];

const CONNECTIONS: Connection[] = [
  {
    id: "auth-web",
    d: "M 265 390 C 302 390, 302 390, 340 390",
    delay: 0,
    label: "auth guard",
    labelPos: { x: 302, y: 380 },
    color: "#a855f7",
  },
  {
    id: "web-chat",
    d: "M 565 330 C 602 330, 602 215, 640 215",
    delay: 0.3,
    label: "mounts route",
    labelPos: { x: 602, y: 260 },
    color: "#60a5fa",
  },
  {
    id: "web-landing",
    d: "M 565 440 C 602 440, 602 555, 640 555",
    delay: 0.4,
    label: "routes",
    labelPos: { x: 602, y: 505 },
    color: "#71717a",
  },
  {
    id: "chat-service",
    d: "M 855 215 C 1012 215, 1012 215, 1170 215",
    delay: 0.8,
    label: "POST /send-message",
    labelPos: { x: 1012, y: 200 },
    color: "#60a5fa",
  },
  {
    id: "table-service",
    d: "M 1120 315 C 1145 315, 1145 270, 1170 270",
    delay: 1.2,
    label: "SQL query",
    labelPos: { x: 1145, y: 295 },
    color: "#f59e0b",
  },
  {
    id: "service-kafka",
    d: "M 1385 225 C 1418 225, 1418 322, 1450 322",
    delay: 1.5,
    label: "pub: message.sent",
    labelPos: { x: 1418, y: 265 },
    color: "#14b8a6",
  },
  {
    id: "kafka-notification",
    d: "M 1645 322 C 1682 322, 1682 400, 1720 400",
    delay: 1.9,
    label: "sub: message.sent",
    labelPos: { x: 1682, y: 355 },
    color: "#14b8a6",
  },
  {
    id: "notification-pageref",
    d: "M 1935 400 C 1972 400, 1972 400, 2010 400",
    delay: 2.3,
    label: "push_to_client",
    labelPos: { x: 1972, y: 390 },
    color: "#a855f7",
  },
  {
    id: "pageref-chat",
    d: "M 2030 465 C 1600 705, 950 675, 748 320",
    delay: 2.8,
    label: "SSE Real-Time Push Stream",
    labelPos: { x: 1350, y: 650 },
    color: "#10b981",
    isReturn: true,
  },
];

export const HeroCanvasPreview: React.FC = () => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(0.55);
  const reduceMotion = useReducedMotion();

  // Scroll and Drag-to-Pan state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);
  const [scrollStartY, setScrollStartY] = useState(0);

  // Dynamically compute the exact zoom scale that fits all nodes in view
  const computeFitZoom = useCallback(() => {
    if (!scrollContainerRef.current) return 0.55;
    const containerWidth = scrollContainerRef.current.clientWidth;
    const containerHeight = scrollContainerRef.current.clientHeight;

    const paddingX = 48;
    const paddingY = 32;

    const scaleX = (containerWidth - paddingX) / CANVAS_WIDTH;
    const scaleY = (containerHeight - paddingY) / CANVAS_HEIGHT;

    // Scale so that both horizontal and vertical dimensions are fully visible
    const fitScale = Math.min(scaleX, scaleY);
    return Math.min(Math.max(Number(fitScale.toFixed(2)), 0.35), 1.0);
  }, []);

  // Set default zoom to fit canvas on mount & adjust on window resize
  useEffect(() => {
    const applyFit = () => {
      const fitScale = computeFitZoom();
      setZoom(fitScale);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0;
        scrollContainerRef.current.scrollTop = 0;
      }
    };

    // Apply fit after initial layout render
    const timer = setTimeout(applyFit, 60);

    const handleResize = () => {
      applyFit();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [computeFitZoom]);

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
      {/* Studio Header Toolbar (Preserved user's simplified header) */}
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
        </div>
      </div>

      {/* Main Canvas Stage - Reduced Sleek Height, Truly Scrollable & Pannable */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`relative w-full h-[410px] sm:h-[440px] md:h-[465px] bg-[#070709] overflow-auto select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-[#0a0a0d]`}
      >
        {/* Dynamic Canvas Sizer responding to Zoom */}
        <div
          style={{
            width: `${CANVAS_WIDTH * zoom}px`,
            height: `${CANVAS_HEIGHT * zoom}px`,
          }}
          className="relative transition-[width,height] duration-75"
        >
          {/* Transformed Scaled Canvas */}
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: `${CANVAS_WIDTH}px`,
              height: `${CANVAS_HEIGHT}px`,
            }}
            className="relative"
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
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            >
              {CONNECTIONS.map((conn) => {
                const isHighlighted =
                  hoveredNode &&
                  (conn.id.includes(hoveredNode) ||
                    (hoveredNode === "chat-page" && conn.isReturn));

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
                        r={conn.isReturn ? "3.5" : "3"}
                        fill={
                          conn.isReturn ? "#34d399" : conn.color || "#a1a1aa"
                        }
                        animate={{ offsetDistance: ["0%", "100%"] }}
                        transition={{
                          duration: conn.isReturn ? 3.4 : 3.8,
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
            </svg>

            {/* Nodes Layer - Realistic XYFlow Studio Cards with Exact Handle Ports */}
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
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    transform: `scale(${isHovered ? 1.02 : 1})`,
                  }}
                >
                  <div
                    style={{ width: `${node.width}px` }}
                    className={`rounded-lg border transition-all shadow-md relative group ${
                      node.themeColor
                    } ${
                      isHovered
                        ? "ring-1 ring-zinc-400 shadow-xl shadow-black/60"
                        : "hover:border-zinc-600"
                    }`}
                  >
                    {/* Exact Connection Handle Ports matching Edge Coordinates */}
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

                      return (
                        <span
                          key={h.id}
                          style={handleStyle}
                          className={`absolute w-2.5 h-2.5 rounded-full border border-zinc-950 shadow-sm transition-transform group-hover:scale-125 z-30 ${
                            h.color || "bg-zinc-400"
                          }`}
                          title={h.label}
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
                        {node.badge}
                      </span>
                    </div>

                    {/* Sub-Badges / Quick Tags */}
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

                    {/* Node Body */}
                    <div className="p-2.5 flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
                      <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                        {node.category}
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
                        <span>Compiled</span>
                      </span>
                      <span className="truncate max-w-[95px] text-zinc-400 font-medium">
                        {node.footerArtifact}
                      </span>
                    </div>
                  </div>
                </div>
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
          </div>
        </div>
      </div>
    </div>
  );
};
