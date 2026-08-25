"use client";

import React from "react";
import { Resizable } from "re-resizable";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Globe,
  Compass,
  Server,
  Waves,
  Database,
  HardDrive,
  Network,
  ShieldCheck,
  Shuffle,
  PlusSquare,
  DatabaseZap,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { createGraphNodeData } from "./GraphView/utils";
import type { GraphNodeType, BackendCanvasView } from "@workspace/canvas";

interface NodePaletteSidebarProps {
  view?: BackendCanvasView;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function NodePaletteSidebar({
  view = "graph",
  isOpen: propIsOpen,
  onToggle: propOnToggle,
}: NodePaletteSidebarProps) {
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addTableNode = useBackendCanvasStore((s) => s.addTableNode);
  const nodes = useBackendCanvasStore((s) => s.nodes);

  const storePaletteOpen = useSidebarStore((s) => s.paletteOpen);
  const storeTogglePalette = useSidebarStore((s) => s.togglePalette);
  const paletteWidth = useSidebarStore((s) => s.paletteWidth);
  const setPaletteWidth = useSidebarStore((s) => s.setPaletteWidth);

  const isOpen = propIsOpen !== undefined ? propIsOpen : storePaletteOpen;
  const onToggle = propOnToggle || storeTogglePalette;

  const handleAddGraphNode = (type: GraphNodeType, label: string) => {
    const x = 300 + (nodes.length % 5) * 40;
    const y = 200 + (nodes.length % 5) * 40;
    const data = createGraphNodeData(type, label, nodes);
    const isContainer = type === "webAppGroup";

    addNode({
      id: crypto.randomUUID(),
      type,
      position: { x, y },
      style: isContainer ? { width: 560, height: 380 } : undefined,
      width: isContainer ? 560 : undefined,
      height: isContainer ? 380 : undefined,
      data,
    });
  };

  const [isResizing, setIsResizing] = React.useState(false);

  return (
    <>
      {/* Sleek Floating Trigger (CSS-only smooth fade & slide) */}
      <button
        type="button"
        onClick={onToggle}
        className={`pointer-events-auto absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sidebar/95 backdrop-blur-md border border-sidebar-border shadow-lg text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent select-none group transition-all duration-300 ease-in-out ${
          isOpen
            ? "opacity-0 -translate-x-4 pointer-events-none scale-95"
            : "opacity-100 translate-x-0 pointer-events-auto scale-100"
        }`}
        title="Open Tools Palette"
      >
        <PanelLeft className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-[11px]">Palette</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* Direct Resizable Sidebar Container */}
      <Resizable
        size={{ width: isOpen ? paletteWidth : 0, height: "100%" }}
        minWidth={isOpen ? 170 : 0}
        maxWidth={380}
        enable={{ right: isOpen }}
        onResizeStart={() => setIsResizing(true)}
        onResizeStop={(e, direction, ref, d) => {
          setIsResizing(false);
          setPaletteWidth(paletteWidth + d.width);
        }}
        handleClasses={{
          right:
            "w-1.5 bg-sidebar-border hover:bg-primary cursor-col-resize transition-colors z-30 hover:w-2",
        }}
        className={`h-full pointer-events-auto shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border shadow-xl z-20 select-none font-sans overflow-hidden ${
          isResizing
            ? ""
            : "transition-[width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        } ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none border-r-0"
        }`}
      >
          {/* Header */}
          <div className="h-10 px-3 border-b border-sidebar-border flex items-center justify-between shrink-0 bg-sidebar-accent/20">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold tracking-wide uppercase text-sidebar-foreground">
                {view === "schema" ? "Schema Tools" : "Node Palette"}
              </span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                BETA
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
              onClick={onToggle}
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Body */}
          {view === "schema" ? (
            <div className="flex-1 p-2.5 space-y-1.5 overflow-y-auto hide-scrollbar">
              <div className="text-[9px] uppercase font-bold text-muted-foreground px-1 pt-1">
                Tables & DBs
              </div>

              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => addTableNode()}
              >
                <PlusSquare className="w-3.5 h-3.5 mr-2 text-primary shrink-0" />
                Add Table
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => {
                  const x = 300 + (nodes.length % 5) * 40;
                  const y = 200 + (nodes.length % 5) * 40;
                  addNode({
                    id: crypto.randomUUID(),
                    type: "group",
                    position: { x, y },
                    style: { width: 480, height: 320 },
                    width: 480,
                    height: 320,
                    data: { label: "Database Cluster", dbEngine: "postgres" },
                  });
                }}
              >
                <Database className="w-3.5 h-3.5 mr-2 text-emerald-500 shrink-0" />
                Database Group
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => {
                  const x = 300 + (nodes.length % 5) * 40;
                  const y = 200 + (nodes.length % 5) * 40;
                  addNode({
                    id: crypto.randomUUID(),
                    type: "redis_instance",
                    position: { x, y },
                    style: { width: 440, height: 300 },
                    width: 440,
                    height: 300,
                    data: { label: "Redis Instance" },
                  });
                }}
              >
                <DatabaseZap className="w-3.5 h-3.5 mr-2 text-red-500 shrink-0" />
                Redis Instance
              </Button>
            </div>
          ) : (
            <div className="flex-1 p-2.5 space-y-1.5 overflow-y-auto hide-scrollbar">
              {/* COMPUTING */}
              <div className="text-[9px] uppercase font-bold text-muted-foreground px-1 pt-1">
                Computing
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("webApp", "Web App")}
              >
                <Globe className="w-3.5 h-3.5 mr-2 text-indigo-400 shrink-0" />
                Web App
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("webClient", "page-client")}
              >
                <Globe className="w-3.5 h-3.5 mr-2 shrink-0 text-muted-foreground" />
                Page Client (Route)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("page_ref", "Page Ref")}
              >
                <Compass className="w-3.5 h-3.5 mr-2 text-indigo-400 shrink-0" />
                Page Ref
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("service", "Service")}
              >
                <Server className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                Service
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("auth", "Auth Node")}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-2 text-indigo-400 shrink-0" />
                Auth Node
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() =>
                  handleAddGraphNode("transformer", "Data Transformer")
                }
              >
                <Shuffle className="w-3.5 h-3.5 mr-2 text-purple-400 shrink-0" />
                Transformer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() =>
                  handleAddGraphNode("transformer_ref", "Transformer Ref")
                }
              >
                <Shuffle className="w-3.5 h-3.5 mr-2 text-purple-400/80 shrink-0" />
                Transformer Ref
              </Button>

              {/* MESSAGING */}
              <div className="text-[9px] uppercase font-bold text-muted-foreground px-1 pt-2 pb-0.5 border-t border-sidebar-border mt-1">
                Messaging
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("kafka", "Kafka")}
              >
                <Waves className="w-3.5 h-3.5 mr-2 text-emerald-400 shrink-0" />
                Kafka
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() =>
                  handleAddGraphNode("redis-streams", "Redis Streams")
                }
              >
                <Waves className="w-3.5 h-3.5 mr-2 text-rose-400 shrink-0" />
                Redis Streams
              </Button>

              {/* STORAGE */}
              <div className="text-[9px] uppercase font-bold text-muted-foreground px-1 pt-2 pb-0.5 border-t border-sidebar-border mt-1">
                Storage
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("db_ref", "Database")}
              >
                <Database className="w-3.5 h-3.5 mr-2 text-blue-400 shrink-0" />
                Database
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("redis-cache", "Redis Cache")}
              >
                <Database className="w-3.5 h-3.5 mr-2 text-red-400 shrink-0" />
                Redis Cache
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() =>
                  handleAddGraphNode("storage", "Storage Bucket")
                }
              >
                <HardDrive className="w-3.5 h-3.5 mr-2 text-amber-400 shrink-0" />
                Storage Bucket
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() =>
                  handleAddGraphNode("vector_db_ref", "Vector DB")
                }
              >
                <Database className="w-3.5 h-3.5 mr-2 text-violet-400 shrink-0" />
                Vector DB
              </Button>

              {/* EXTERNAL */}
              <div className="text-[9px] uppercase font-bold text-muted-foreground px-1 pt-2 pb-0.5 border-t border-sidebar-border mt-1">
                External
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() => handleAddGraphNode("external", "External API")}
              >
                <Globe className="w-3.5 h-3.5 mr-2 text-sky-400 shrink-0" />
                External API
              </Button>

              {/* AI */}
              <div className="text-[9px] uppercase font-bold text-muted-foreground px-1 pt-2 pb-0.5 border-t border-sidebar-border mt-1">
                AI
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
                onClick={() =>
                  handleAddGraphNode("langgraph", "LangGraph Agent")
                }
              >
                <Network className="w-3.5 h-3.5 mr-2 text-emerald-400 shrink-0" />
                LangGraph Agent
              </Button>
            </div>
          )}
        </Resizable>
    </>
  );
}
