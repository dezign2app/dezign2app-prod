"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, Database, ArrowUpRight } from "lucide-react";
import type { InfraCircle, TrafficIntensity } from "../types";

interface HeroCanvasInfraFlyingCardProps {
  activeInfraNode: InfraCircle | null;
  setHoveredInfraId: (id: string | null) => void;
  getCircleRate: (circle: InfraCircle) => string;
  getCircleSplitRate: (circle: InfraCircle) => string | null;
  trafficIntensity: TrafficIntensity;
}

export const HeroCanvasInfraFlyingCard: React.FC<HeroCanvasInfraFlyingCardProps> = ({
  activeInfraNode,
  setHoveredInfraId,
  getCircleRate,
  getCircleSplitRate,
  trafficIntensity,
}) => {
  return (
    <AnimatePresence>
      {activeInfraNode && (
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
              <div className="relative rounded-xl border border-zinc-800/90 bg-[#0d0e14]/98 backdrop-blur-xl shadow-2xl p-3.5 flex flex-col gap-2.5">
                {/* Pointer beak pointing to the circle */}
                {isPlaceBelow ? (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-l border-t bg-[#0d0e14] border-zinc-750" />
                ) : (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b bg-[#0d0e14] border-zinc-750" />
                )}

                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg border border-zinc-700 bg-zinc-850 flex items-center justify-center shrink-0 text-zinc-300">
                      {isLb ? (
                        <Network className="w-4 h-4" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-zinc-100 font-mono tracking-tight">
                        {activeInfraNode.label}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {activeInfraNode.details.engine}
                      </span>
                    </div>
                  </div>

                  {/* Live Status Pill */}
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-zinc-750 bg-zinc-850 text-zinc-300 flex items-center gap-1 font-semibold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
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
                <div className="grid grid-cols-2 gap-1.5 bg-[#08090d] rounded-lg p-2 border border-zinc-800/80">
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
                          <span className="text-[10px] font-bold font-mono text-zinc-100">
                            {currentRate}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-mono text-zinc-500 shrink-0">÷{activeInfraNode.downstreamInstances}</span>
                          <span className="text-[8px] font-mono text-zinc-500">backends</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-mono text-zinc-500 shrink-0">→</span>
                          <span className="text-[10px] font-bold font-mono text-zinc-100">
                            {getCircleSplitRate(activeInfraNode)}
                          </span>
                          <span className="text-[8px] font-mono text-zinc-500">each</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold font-mono text-zinc-100 mt-0.5">
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
                    <span className="text-xs font-bold font-mono text-zinc-100 mt-0.5">
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
                      <span className="font-medium text-zinc-300">
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
  );
};
