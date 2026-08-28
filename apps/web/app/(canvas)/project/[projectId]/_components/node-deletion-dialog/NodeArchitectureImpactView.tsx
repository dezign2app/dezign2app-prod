"use client";

import React from "react";
import {
  Server,
  Database,
  Globe,
  Radio,
  Workflow,
  Cpu,
  Layers,
  Unplug,
  Trash2,
  Link2Off,
  CheckCircle2,
  Info,
} from "lucide-react";
import { NodeArchitectureImpact } from "./types";

interface NodeArchitectureImpactViewProps {
  impact: NodeArchitectureImpact;
}

function getNodeTypeIcon(type: string) {
  const iconClass = "w-3.5 h-3.5 text-zinc-400 shrink-0";
  switch (type) {
    case "database":
    case "entity":
    case "db_ref":
    case "redis_instance":
    case "redis_schema":
    case "redis-cache":
    case "vector_db_ref":
      return <Database className={iconClass} />;
    case "service":
    case "worker":
    case "serverless":
    case "api_gateway":
      return <Server className={iconClass} />;
    case "webApp":
    case "webAppGroup":
    case "webPage":
    case "page_ref":
    case "hook":
    case "hook_ref":
      return <Globe className={iconClass} />;
    case "kafka":
    case "queue":
    case "pubsub":
    case "eventstream":
    case "redis-streams":
    case "sqs":
      return <Radio className={iconClass} />;
    case "langgraph":
    case "langgraph_step":
    case "llm":
      return <Workflow className={iconClass} />;
    case "transformer":
    case "transformer_ref":
      return <Cpu className={iconClass} />;
    default:
      return <Layers className={iconClass} />;
  }
}

export function NodeArchitectureImpactView({
  impact,
}: NodeArchitectureImpactViewProps): React.JSX.Element {
  const { targetNodes, severedConnections, cascadeElements, brokenReferences, totalCanvasImpactCount } =
    impact;

  return (
    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4 text-zinc-200 min-h-0">
      {/* LEFT COLUMN: Target Node(s) & Overview Sidebar */}
      <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar">
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Target {targetNodes.length === 1 ? "Node" : "Nodes"}
          </span>

          <div className="space-y-2">
            {targetNodes.map((target) => (
              <div
                key={target.id}
                className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center shrink-0">
                      {getNodeTypeIcon(target.type)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-zinc-100 truncate block">
                        {target.label}
                      </span>
                      <span className="text-[9px] uppercase font-mono text-zinc-400 bg-zinc-800 border border-zinc-700/60 px-1 py-0.2 rounded inline-block mt-0.5">
                        {target.type}
                      </span>
                    </div>
                  </div>

                  <span className="text-[8px] font-mono text-zinc-400 bg-zinc-800/90 border border-zinc-700/50 px-1.5 py-0.5 rounded tracking-wider shrink-0 uppercase">
                    TARGET
                  </span>
                </div>

                {/* Metadata List */}
                <div className="pt-2 border-t border-zinc-800/60 space-y-1 text-[11px] font-mono text-zinc-400">
                  {target.parentGroupLabel && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Group:</span>
                      <span className="text-zinc-300 font-medium">{target.parentGroupLabel}</span>
                    </div>
                  )}
                  {target.techStack && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Stack:</span>
                      <span className="text-zinc-300">{target.techStack}</span>
                    </div>
                  )}
                  {target.dbEngine && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Engine:</span>
                      <span className="text-zinc-300">{target.dbEngine}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Blast Radius Stat Box */}
        <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-1.5 text-xs">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block flex items-center gap-1.5">
            <Info className="w-3 h-3 text-zinc-500" /> Blast Radius Summary
          </span>
          <div className="space-y-1 text-[11px] font-mono text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Connections Severed:</span>
              <span className="text-zinc-200 font-medium">{severedConnections.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Child Schemas / Items:</span>
              <span className="text-zinc-200 font-medium">{cascadeElements.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Foreign References:</span>
              <span className="text-zinc-200 font-medium">{brokenReferences.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Blast Radius Detail Cards */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar min-h-0">
        {/* Standalone state if no connected nodes affected */}
        {totalCanvasImpactCount === 0 && (
          <div className="flex items-center gap-2.5 p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 text-zinc-400 text-xs">
            <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>Standalone node: No other canvas services, databases, or connections will be broken.</span>
          </div>
        )}

        {/* Severed Connections Section */}
        {severedConnections.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Unplug className="w-3 h-3 text-zinc-500" /> Severed Connections ({severedConnections.length})
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {severedConnections.map((conn) => (
                <div
                  key={conn.edgeId}
                  className="flex items-start justify-between p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/70 hover:bg-zinc-900/70 transition-colors gap-2"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded bg-zinc-800/70 border border-zinc-700/40 flex items-center justify-center shrink-0 mt-0.5">
                      {getNodeTypeIcon(conn.otherNodeType)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs text-zinc-200 truncate">
                          {conn.otherNodeLabel}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">
                          ({conn.otherNodeType})
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                        {conn.description}
                      </span>
                    </div>
                  </div>

                  <span className="text-[8px] font-mono text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 px-1.5 py-0.5 rounded tracking-wider shrink-0 uppercase">
                    DISCONNECTED
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cascade Elements Section */}
        {cascadeElements.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Trash2 className="w-3 h-3 text-zinc-500" /> Child Elements ({cascadeElements.length})
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {cascadeElements.map((elem) => (
                <div
                  key={elem.id}
                  className="flex items-start justify-between p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/70 hover:bg-zinc-900/70 transition-colors gap-2"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded bg-zinc-800/70 border border-zinc-700/40 flex items-center justify-center shrink-0 mt-0.5">
                      {getNodeTypeIcon(elem.type)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-xs text-zinc-200 truncate block">
                        {elem.label}
                      </span>
                      <span className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                        {elem.description}
                      </span>
                    </div>
                  </div>

                  <span className="text-[8px] font-mono text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 px-1.5 py-0.5 rounded tracking-wider shrink-0 uppercase">
                    REMOVED
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Broken References Section */}
        {brokenReferences.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Link2Off className="w-3 h-3 text-zinc-500" /> Foreign References ({brokenReferences.length})
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {brokenReferences.map((ref, idx) => (
                <div
                  key={`${ref.referencingNodeId}-${idx}`}
                  className="flex items-start justify-between p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/70 hover:bg-zinc-900/70 transition-colors gap-2"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded bg-zinc-800/70 border border-zinc-700/40 flex items-center justify-center shrink-0 mt-0.5">
                      {getNodeTypeIcon(ref.referencingNodeType)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-xs text-zinc-200 truncate block">
                        {ref.referencingNodeLabel}
                      </span>
                      <span className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                        {ref.description}
                      </span>
                    </div>
                  </div>

                  <span className="text-[8px] font-mono text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 px-1.5 py-0.5 rounded tracking-wider shrink-0 uppercase">
                    UNLINKED
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
