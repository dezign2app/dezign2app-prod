"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network } from "lucide-react";
import { LOAD_BALANCER_CIRCLES } from "../canvasData";
import type { InfraCircle } from "../types";

interface HeroCanvasLoadBalancersProps {
  activeInfraId: string | null;
  setHoveredInfraId: (id: string | null) => void;
  setSelectedInfraId: React.Dispatch<React.SetStateAction<string | null>>;
  getCircleRate: (circle: InfraCircle) => string;
  getCircleSplitRate: (circle: InfraCircle) => string | null;
}

export const HeroCanvasLoadBalancers: React.FC<HeroCanvasLoadBalancersProps> = ({
  activeInfraId,
  setHoveredInfraId,
  setSelectedInfraId,
  getCircleRate,
  getCircleSplitRate,
}) => {
  const stackCount = 5;

  return (
    <AnimatePresence>
      {LOAD_BALANCER_CIRCLES.map((lb) => {
        const isHovered = activeInfraId === lb.id;

        return (
          <motion.div
            key={lb.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            style={{
              left: `${lb.x - 37}px`,
              top: `${lb.y - 37}px`,
            }}
            onMouseEnter={() => setHoveredInfraId(lb.id)}
            onMouseLeave={() => setHoveredInfraId(null)}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedInfraId((prev) => (prev === lb.id ? null : lb.id));
            }}
            className="absolute z-30 flex flex-col items-center pointer-events-auto select-none cursor-pointer"
          >
            {/* 5 Stacked Load Balancers with 10px left and top padding */}
            <div className="relative w-[74px] h-[74px] group">
              {Array.from({ length: stackCount }).map((_, idx) => {
                const isFront = idx === stackCount - 1;
                return (
                  <div
                    key={idx}
                    className={`absolute w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
                      isFront
                        ? isHovered
                          ? "bg-[#181a24] border-2 border-zinc-200 shadow-zinc-900/80 scale-105"
                          : "bg-[#12141c] border-2 border-zinc-500 hover:border-zinc-300"
                        : isHovered
                        ? "bg-[#10121a] border border-zinc-600"
                        : "bg-[#0b0c10] border border-zinc-700/80"
                    }`}
                    style={{
                      left: `${idx * 10}px`,
                      top: `${idx * 10}px`,
                      zIndex: idx + 1,
                    }}
                    title={
                      isFront
                        ? `${lb.label} (${lb.sublabel}) — Hover for live telemetry & specs`
                        : `Instance #${idx + 1} of ${lb.label}`
                    }
                  >
                    <Network
                      className={`transition-colors ${
                        isFront
                          ? `w-4 h-4 ${isHovered ? "text-white" : "text-zinc-200"}`
                          : "w-3 h-3 text-zinc-600"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Micro Tag Attached Below Circle Stack */}
            <div className="mt-1 flex flex-col items-center pointer-events-none">
              <span
                className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 border whitespace-nowrap shadow-xs transition-colors ${
                  isHovered
                    ? "text-zinc-100 border-zinc-500"
                    : "text-zinc-300 border-zinc-800"
                }`}
              >
                {lb.label}
              </span>
              <span className="text-[8.5px] font-mono text-zinc-400 mt-0.5">
                {getCircleSplitRate(lb) || getCircleRate(lb)} · 5× LBs
              </span>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};
