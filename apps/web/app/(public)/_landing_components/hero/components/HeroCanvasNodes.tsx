"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot } from "lucide-react";
import type { CanvasNode, CanvasMode } from "../types";
import type { AgentStep } from "../aiWorkerData";

interface HeroCanvasNodesProps {
  nodes: CanvasNode[];
  isInfra: boolean;
  activeMode: CanvasMode;
  hoveredNode: string | null;
  selectedNode: string | null;
  currentStep: AgentStep | null;
  isRealtimeEdgeVisible: boolean;
  getIncomingBadgeText: (node: CanvasNode) => string | null;
  setHoveredNode: (id: string | null) => void;
  setSelectedNode: React.Dispatch<React.SetStateAction<string | null>>;
}

export const HeroCanvasNodes: React.FC<HeroCanvasNodesProps> = ({
  nodes,
  isInfra,
  activeMode,
  hoveredNode,
  selectedNode,
  currentStep,
  isRealtimeEdgeVisible,
  getIncomingBadgeText,
  setHoveredNode,
  setSelectedNode,
}) => {
  return (
    <>
      {nodes.map((node) => {
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
                  ? "ring-2 ring-cyan-400/80 border-cyan-400 shadow-2xl shadow-cyan-950/70"
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
                    className="absolute -top-3.5 left-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0d0e14] border border-cyan-400/80 shadow-lg text-[9px] font-mono font-bold text-cyan-300 select-none whitespace-nowrap"
                  >
                    <Bot className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
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
                    className="absolute -top-3.5 right-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-750 shadow-md text-[9.5px] font-mono font-medium text-zinc-300 select-none whitespace-nowrap"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
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
                      h.color || "bg-zinc-600"
                    } ${
                      isSseHandle && !handleActive
                        ? "opacity-35 scale-75"
                        : "opacity-100"
                    } ${
                      isSseHandle && handleActive
                        ? "ring-2 ring-zinc-400 scale-125"
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
              <div className="flex items-center justify-between p-2.5 border-b border-zinc-800/80 bg-[#121318]/90 rounded-t-lg">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-zinc-100 truncate">
                    {node.title}
                  </span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 bg-zinc-900 text-zinc-300 border-zinc-800">
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
              <div className="px-2.5 py-1.5 bg-[#090a0e] border-t border-zinc-800/80 rounded-b-lg flex items-center justify-between text-[9px] font-mono text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block" />
                  <span>
                    {activeMode === "infrastructure" ? "Ready" : "Compiled"}
                  </span>
                </span>
                <span className="text-zinc-600">
                  {activeMode === "infrastructure" ? "200 OK" : "zod.ok"}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </>
  );
};
