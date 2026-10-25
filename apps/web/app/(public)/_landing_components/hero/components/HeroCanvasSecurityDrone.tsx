"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Bug, Target } from "lucide-react";
import type { SecurityVectorDef, SecurityStep } from "../ethicalHackerData";

interface HeroCanvasSecurityDroneProps {
  currentStep: SecurityStep;
  securityStep: number;
  activeVector: SecurityVectorDef;
}

export const HeroCanvasSecurityDrone: React.FC<HeroCanvasSecurityDroneProps> = ({
  currentStep,
  securityStep,
  activeVector,
}) => {
  const isMitigated = securityStep === 4;

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
      <div className="relative -top-2 left-1/2 -translate-x-1/2 -translate-y-full mb-2 w-[300px] pointer-events-none">
        <motion.div
          key={`security-bubble-${securityStep}-${activeVector.id}`}
          initial={{ opacity: 0, scale: 0.9, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`rounded-xl border bg-[#0d0a10]/98 backdrop-blur-xl p-2.5 shadow-2xl shadow-black/90 flex flex-col gap-1.5 text-left ring-1 ${
            isMitigated
              ? "border-emerald-500/60 ring-emerald-500/30"
              : "border-rose-500/60 ring-rose-500/30"
          }`}
        >
          <div className="flex items-center justify-between text-[9px] font-mono border-b border-zinc-800/80 pb-1.5">
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                isMitigated ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isMitigated ? (
                <Target className="w-3 h-3 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-3 h-3 text-rose-400" />
              )}
              <span>ETHICAL HACKER · RED TEAM</span>
            </span>
            <div className="flex items-center gap-1">
              <span
                className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold border ${
                  isMitigated
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                    : "bg-rose-950/80 text-rose-300 border-rose-800/60"
                }`}
              >
                {currentStep.phase}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 text-[8px] font-mono">
                {securityStep + 1}/5
              </span>
            </div>
          </div>

          <p className="text-[10px] text-zinc-100 font-sans leading-snug font-medium">
            {currentStep.droneMsg}
          </p>

          <div className="flex items-center gap-1 text-[8px] font-mono text-zinc-400 truncate pt-0.5">
            <span className={isMitigated ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              Target:
            </span>
            <span className="truncate text-zinc-300">{currentStep.subAction}</span>
          </div>

          {/* Pointer beak arrow */}
          <div
            className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#0d0a10] border-r border-b ${
              isMitigated ? "border-emerald-500/60" : "border-rose-500/60"
            }`}
          />
        </motion.div>
      </div>

      {/* Drone Body */}
      <div className="relative flex flex-col items-center">
        {/* Pulsing Sonar Aura */}
        <div
          className={`absolute -inset-2 rounded-2xl pointer-events-none ${
            isMitigated ? "bg-emerald-500/15 animate-ping" : "bg-rose-500/20 animate-ping"
          }`}
        />

        {/* Precision Cyber Red Team Scanner Container */}
        <div
          className={`w-11 h-11 rounded-xl shadow-xl flex items-center justify-center relative cursor-grab active:cursor-grabbing group ring-1 transition-all ${
            isMitigated
              ? "bg-gradient-to-b from-[#0e221a] via-[#091510] to-[#040806] border border-emerald-400/80 shadow-emerald-950/60 ring-emerald-500/30"
              : "bg-gradient-to-b from-[#2a111a] via-[#1a0b12] to-[#0e060a] border border-rose-500/80 shadow-rose-950/70 ring-rose-500/40"
          }`}
        >
          {isMitigated ? (
            <Target className="w-5 h-5 text-emerald-300 group-hover:scale-110 transition-transform" />
          ) : (
            <Bug className="w-5 h-5 text-rose-300 group-hover:scale-110 transition-transform animate-pulse" />
          )}

          {/* Glowing Status Dot */}
          <span
            className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 flex items-center justify-center shadow-xs ${
              isMitigated ? "bg-emerald-400" : "bg-rose-500"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </span>
        </div>

        {/* Small Agent Tag Badge */}
        <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0a060a]/95 border border-zinc-800 shadow-md">
          <span
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              isMitigated ? "bg-emerald-400" : "bg-rose-400"
            }`}
          />
          <span className="text-[9px] font-mono font-bold text-zinc-200 whitespace-nowrap">
            ethical-fuzzer-01
          </span>
        </div>
      </div>
    </motion.div>
  );
};
