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
      <div className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-indigo-500/5 dark:bg-indigo-950/20 border border-indigo-500/25">
        <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
          <Globe className="w-3 h-3 text-indigo-500" />
          Web App
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0 w-full border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300"
          onClick={() => onAddNode("webApp", "Web App")}
        >
          <Globe className="w-3.5 h-3.5 mr-2 text-indigo-500 shrink-0" />
          Web App
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0 w-full border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300"
          onClick={() => onAddNode("webClient", "Web Page")}
        >
          <Globe className="w-3.5 h-3.5 mr-2 text-indigo-500/80 shrink-0" />
          Web Page
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0 w-full border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300"
          onClick={() => onAddNode("page_ref" as GraphNodeType, "Page Ref")}
        >
          <Compass className="w-3.5 h-3.5 mr-2 text-indigo-500/80 shrink-0" />
          Page Ref
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0 w-full border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300"
          onClick={() => onAddNode("auth", "Auth Node")}
        >
          <ShieldCheck className="w-3.5 h-3.5 mr-2 text-indigo-500 shrink-0" />
          Auth Node
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("service", "Service")}
      >
        <Server className="w-3.5 h-3.5 mr-2" />
        Service
      </Button>
      {/* TRANSFORMERS GROUP */}
      <div className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/25">
        <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
          <Shuffle className="w-3 h-3 text-purple-500" />
          Transformer
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0 w-full border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 hover:text-purple-300"
          onClick={() => onAddNode("transformer" as GraphNodeType, "Data Transformer")}
        >
          <Shuffle className="w-3.5 h-3.5 mr-2 text-purple-500 shrink-0" />
          Transformer
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0 w-full border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 hover:text-purple-300"
          onClick={() => onAddNode("transformer_ref" as GraphNodeType, "Global Ref")}
        >
          <Shuffle className="w-3.5 h-3.5 mr-2 text-purple-500/80 shrink-0" />
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
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("kafka", "Kafka")}
      >
        <Waves className="w-3.5 h-3.5 mr-2 text-emerald-500" />
        Kafka
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("redis-streams", "Redis Streams")}
      >
        <Waves className="w-3.5 h-3.5 mr-2 text-rose-500" />
        Redis Streams
      </Button>

      {/* STORAGE */}
      <div className="text-[9px] uppercase font-extrabold text-muted-foreground/60 px-1 pt-2 pb-1 border-t mt-1">
        Storage
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("db_ref", "Database")}
      >
        <Database className="w-3.5 h-3.5 mr-2" />
        Database
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("redis-cache", "Redis Cache")}
      >
        <Database className="w-3.5 h-3.5 mr-2 text-red-500" />
        Redis Cache
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("storage", "Storage Bucket")}
      >
        <HardDrive className="w-3.5 h-3.5 mr-2 text-amber-500" />
        Storage Bucket
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("vector_db_ref", "Vector DB")}
      >
        <Database className="w-3.5 h-3.5 mr-2 text-violet-500" />
        Vector DB
      </Button>

      {/* EXTERNAL */}
      <div className="text-[9px] uppercase font-extrabold text-muted-foreground/60 px-1 pt-2 pb-1 border-t mt-1">
        External
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("external", "External API")}
      >
        <Globe className="w-3.5 h-3.5 mr-2" />
        External API
      </Button>

      {/* AI */}
      <div className="text-[9px] uppercase font-extrabold text-muted-foreground/60 px-1 pt-2 pb-1 border-t mt-1">
        AI
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start h-8 shrink-0"
        onClick={() => onAddNode("langgraph", "LangGraph Agent")}
      >
        <Network className="w-3.5 h-3.5 mr-2 text-emerald-500" />
        LangGraph Agent
      </Button>
    </Panel>
  );
};
