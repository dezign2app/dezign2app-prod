import React from "react";
import { Panel } from "@xyflow/react";
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
  Anchor,
  Layout,
} from "lucide-react";
import type { GraphNodeType } from "@workspace/canvas";

interface NodePalettePanelProps {
  onAddNode: (type: GraphNodeType, label: string) => void;
}

export const NodePalettePanel: React.FC<NodePalettePanelProps> = ({
  onAddNode,
}) => {
  return (
    <Panel
      position="top-left"
      className="flex gap-1.5 flex-col bg-background/95 backdrop-blur border rounded-lg p-2.5 shadow-md max-w-[190px] max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden hide-scrollbar"
    >
      <Badge>BETA</Badge>
      {/* COMPUTING */}
      <div className="text-[9px] uppercase font-extrabold text-muted-foreground/60 px-1 pt-1 pb-1">
        Computing
      </div>
      {/* WEB APP / CLIENT GROUP */}
      <div className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-sidebar-accent/20 border border-sidebar-border/60">
        <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-muted-foreground" />
          Web App
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("webApp", "Web App")}
        >
          <Globe className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Web App
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("webPage", "Web Page")}
        >
          <Globe className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Web Page
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("page_ref", "Page Ref")}
        >
          <Compass className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Page Ref
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("auth", "Auth Node")}
        >
          <ShieldCheck className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Auth Node
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("hook", "useCustomHook")}
        >
          <Anchor className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          React Hook
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("hook_ref", "Hook Ref")}
        >
          <Anchor className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Hook Ref
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("component", "Component")}
        >
          <Layout className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          UI Component
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("component_ref", "Component Ref")}
        >
          <Layout className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Component Ref
        </Button>
      </div>

      {/* SERVICE & BACKEND GROUP */}
      <div className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-sidebar-accent/20 border border-sidebar-border/60">
        <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Server className="w-3 h-3 text-muted-foreground" />
          Service & Backend
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("service", "Service")}
        >
          <Server className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Service
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("transformer", "Data Transformer")}
        >
          <Shuffle className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Transformer
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
          onClick={() => onAddNode("transformer_ref", "Global Ref")}
        >
          <Shuffle className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
          Global Ref
        </Button>
      </div>

      {/* MESSAGING */}
      <div className="text-[9px] uppercase font-extrabold text-muted-foreground/60 px-1 pt-2 pb-1 border-t mt-1">
        Messaging
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
        onClick={() => onAddNode("kafka", "Kafka")}
      >
        <Waves className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
        Kafka
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
        onClick={() => onAddNode("redis-streams", "Redis Streams")}
      >
        <Waves className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
        Redis Streams
      </Button>

      {/* STORAGE */}
      <div className="text-[9px] uppercase font-extrabold text-muted-foreground/60 px-1 pt-2 pb-1 border-t mt-1">
        Storage
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
        onClick={() => onAddNode("db_ref", "Database")}
      >
        <Database className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
        Database
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
        onClick={() => onAddNode("redis-cache", "Redis Cache")}
      >
        <Database className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
        Redis Cache
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
        onClick={() => onAddNode("storage", "Storage Bucket")}
      >
        <HardDrive className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
        Storage Bucket
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
        onClick={() => onAddNode("vector_db_ref", "Vector DB")}
      >
        <Database className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
        Vector DB
      </Button>

      {/* EXTERNAL */}
      <div className="text-[9px] uppercase font-extrabold text-muted-foreground/60 px-1 pt-2 pb-1 border-t mt-1">
        External
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
        onClick={() => onAddNode("external", "External API")}
      >
        <Globe className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
        External API
      </Button>

      {/* AI */}
      <div className="text-[9px] uppercase font-extrabold text-muted-foreground/60 px-1 pt-2 pb-1 border-t mt-1">
        AI
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border/60 text-sidebar-foreground text-xs justify-start h-8 shrink-0 w-full"
        onClick={() => onAddNode("langgraph", "LangGraph Agent")}
      >
        <Network className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
        LangGraph Agent
      </Button>
    </Panel>
  );
};
