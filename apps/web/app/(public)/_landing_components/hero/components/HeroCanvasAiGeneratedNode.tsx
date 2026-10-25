"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { TicketDef } from "../aiWorkerData";

interface HeroCanvasAiGeneratedNodeProps {
  generatedNode: TicketDef["generatedNode"];
  isVisible: boolean;
}

export const HeroCanvasAiGeneratedNode: React.FC<HeroCanvasAiGeneratedNodeProps> = ({
  generatedNode,
  isVisible,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={`generated-node-${generatedNode.id}`}
          initial={{ opacity: 0, scale: 0.6, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: -20 }}
          transition={{ type: "spring", stiffness: 350, damping: 24 }}
          style={{
            left: `${generatedNode.x}px`,
            top: `${generatedNode.y}px`,
            width: `${generatedNode.width}px`,
          }}
          className="absolute z-25 cursor-pointer canvas-node-card select-none"
        >
          <div
            className={`rounded-lg border shadow-2xl relative group ring-1 ring-cyan-500/40 shadow-black/80 ${generatedNode.themeColor}`}
          >
            {/* Floating AI Generation Badge */}
            <div className="absolute -top-3.5 right-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0d0e14] border border-cyan-500/50 shadow-md text-[9px] font-mono font-bold text-cyan-300 select-none whitespace-nowrap">
              <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
              <span>AI Synthesized</span>
            </div>

            {/* Input & Output Ports */}
            <span
              style={{
                left: "-5px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
              className="absolute w-2.5 h-2.5 rounded-full border border-zinc-950 bg-cyan-400 shadow-sm z-30 ring-2 ring-cyan-400/50 animate-pulse"
            />
            <span
              style={{
                right: "-5px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
              className="absolute w-2.5 h-2.5 rounded-full border border-zinc-950 bg-emerald-400 shadow-sm z-30 ring-2 ring-emerald-400"
            />

            {/* Node Header */}
            <div className="flex items-center justify-between p-2.5 border-b border-zinc-800/80 bg-[#121318] rounded-t-lg">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <generatedNode.icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[11px] font-semibold text-white truncate">
                  {generatedNode.title}
                </span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 bg-cyan-950/60 text-cyan-300 border-cyan-800/50">
                {generatedNode.badge}
              </span>
            </div>

            {/* Sub-Badges */}
            <div className="px-2.5 pt-2 flex flex-wrap gap-1">
              {generatedNode.subBadges.map((tag, tIdx) => (
                <span
                  key={tIdx}
                  className="text-[8px] font-mono px-1 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Details */}
            <div className="p-2.5 flex flex-col gap-1 text-[10px] font-mono text-zinc-300">
              <span className="text-[8px] uppercase tracking-wider text-cyan-400 font-semibold mb-0.5">
                {generatedNode.category}
              </span>
              {generatedNode.details.map((detail, dIdx) => (
                <div key={dIdx} className="flex items-center gap-1.5 truncate">
                  <span className="text-cyan-500 text-[8px]">•</span>
                  <span className="truncate">{detail}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-2.5 py-1.5 bg-[#090a0d] border-t border-zinc-800/80 rounded-b-lg flex items-center justify-between text-[9px] font-mono text-zinc-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                <span>Active</span>
              </span>
              <span className="truncate max-w-[110px] text-cyan-300 font-medium">
                {generatedNode.footerArtifact}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
