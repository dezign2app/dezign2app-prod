"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database } from "lucide-react";
import { DB_REPLICA_CIRCLES } from "../canvasData";
import type { InfraCircle } from "../types";

interface HeroCanvasDbReplicasProps {
  activeInfraId: string | null;
  setHoveredInfraId: (id: string | null) => void;
  setSelectedInfraId: React.Dispatch<React.SetStateAction<string | null>>;
  getCircleRate: (circle: InfraCircle) => string;
}

export const HeroCanvasDbReplicas: React.FC<HeroCanvasDbReplicasProps> = ({
  activeInfraId,
  setHoveredInfraId,
  setSelectedInfraId,
  getCircleRate,
}) => {
  return (
    <AnimatePresence>
      {DB_REPLICA_CIRCLES.map((rep) => {
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
              className={`w-[34px] h-[34px] rounded-full bg-[#12141c] border-2 shadow-md flex items-center justify-center relative transition-all duration-200 group ${
                isHovered
                  ? "border-zinc-200 ring-2 ring-zinc-500/20 scale-110"
                  : "border-zinc-600 hover:border-zinc-400 shadow-black/80"
              }`}
              title={`${rep.label} (${rep.sublabel}) — Hover for live telemetry & specs`}
            >
              <Database
                className={`w-3.5 h-3.5 transition-colors ${
                  isHovered ? "text-white" : "text-zinc-400"
                }`}
              />
            </div>

            {/* Micro Tag Below Replica Circle */}
            <div className="mt-1 flex flex-col items-center pointer-events-none">
              <span
                className={`text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-900 border whitespace-nowrap shadow-xs transition-colors ${
                  isHovered
                    ? "text-zinc-100 border-zinc-500"
                    : "text-zinc-300 border-zinc-800"
                }`}
              >
                {rep.label}
              </span>
              <span className="text-[8.5px] font-mono text-zinc-400 mt-0.5">
                {getCircleRate(rep)}
              </span>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};
