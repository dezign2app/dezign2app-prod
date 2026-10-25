"use client";

import React from "react";
import { motion } from "framer-motion";
import { Bot, Sparkles } from "lucide-react";
import type { TicketDef, AgentStep } from "../aiWorkerData";

interface HeroCanvasAiDroneProps {
  currentStep: AgentStep;
  workerStep: number;
  activeTicket: TicketDef;
}

export const HeroCanvasAiDrone: React.FC<HeroCanvasAiDroneProps> = ({
  currentStep,
  workerStep,
  activeTicket,
}) => {
  return (
    <motion.div
      initial={false}
      animate={{
        x: currentStep.agentTarget.x,
        y: currentStep.agentTarget.y,
      }}
      transition={{
        type: "spring",
        stiffness: 160,
        damping: 22,
        mass: 0.9,
      }}
      className="absolute top-0 left-0 z-40 pointer-events-auto select-none"
    >
      {/* Speech / Thought Bubble Floating Above the Drone */}
      <div className="relative -top-2 left-1/2 -translate-x-1/2 -translate-y-full mb-2 w-[280px] pointer-events-none">
        <motion.div
          key={`agent-bubble-${workerStep}-${activeTicket.id}`}
          initial={{ opacity: 0, scale: 0.9, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-zinc-750 bg-[#0d0e14]/98 backdrop-blur-xl p-2.5 shadow-2xl shadow-black/90 flex flex-col gap-1.5 text-left ring-1 ring-cyan-500/25"
        >
          <div className="flex items-center justify-between text-[9px] font-mono border-b border-zinc-800/80 pb-1.5">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>AI WORKER REASONING</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 text-[8px] font-mono font-bold">
              Step {workerStep + 1}/6
            </span>
          </div>

          <p className="text-[10px] text-zinc-100 font-sans leading-snug font-medium">
            {currentStep.agentMsg}
          </p>

          <div className="flex items-center gap-1 text-[8px] font-mono text-zinc-400 truncate pt-0.5">
            <span className="text-cyan-400 font-semibold">Action:</span>
            <span className="truncate text-zinc-300">{currentStep.subAction}</span>
          </div>

          {/* Pointer beak arrow */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#0d0e14] border-r border-b border-zinc-750" />
        </motion.div>
      </div>

      {/* Drone Body */}
      <div className="relative flex flex-col items-center">
        {/* Pulsing Sonar Aura */}
        <div className="absolute -inset-2 rounded-2xl bg-cyan-500/15 animate-ping pointer-events-none" />

        {/* Precision Cyber Drone Container */}
        <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#1c1f26] via-[#12141a] to-[#0a0b0e] border border-cyan-400/70 shadow-xl shadow-cyan-950/60 flex items-center justify-center relative cursor-grab active:cursor-grabbing group ring-1 ring-cyan-500/30">
          <Bot className="w-5 h-5 text-cyan-300 group-hover:scale-110 transition-transform" />

          {/* Glowing Green Eye / Status Dot */}
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-zinc-950 flex items-center justify-center shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </span>
        </div>

        {/* Small Agent Tag Badge */}
        <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0a0b0e]/95 border border-zinc-750 shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] font-mono font-bold text-zinc-200 whitespace-nowrap">
            {activeTicket.assignee}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
