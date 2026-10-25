"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Bug } from "lucide-react";
import { SECURITY_VECTORS, type SecurityVectorDef } from "../ethicalHackerData";

interface HeroCanvasSecurityCardProps {
  activeVector: SecurityVectorDef;
  securityStep: number;
  setSecurityStep: (step: number) => void;
  selectedVectorIndex: number;
  setSelectedVectorIndex: (idx: number) => void;
  isSecurityCardMinimized: boolean;
  setIsSecurityCardMinimized: (minimized: boolean) => void;
}

export const HeroCanvasSecurityCard: React.FC<HeroCanvasSecurityCardProps> = ({
  activeVector,
  securityStep,
  setSecurityStep,
  selectedVectorIndex,
  setSelectedVectorIndex,
  isSecurityCardMinimized,
  setIsSecurityCardMinimized,
}) => {
  const isMitigated = securityStep === 4;

  return (
    <div className="absolute top-3.5 left-4 z-40 select-none">
      {isSecurityCardMinimized ? (
        <button
          onClick={() => setIsSecurityCardMinimized(false)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d070b]/98 border shadow-xl backdrop-blur-md text-xs font-mono transition-all hover:scale-102 ${
            isMitigated
              ? "border-emerald-500/60 text-emerald-300"
              : "border-rose-500/60 text-rose-300"
          }`}
        >
          {isMitigated ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
          )}
          <span className="font-bold text-white">Pentest {activeVector.displayNumber}</span>
          <span className="text-zinc-600">·</span>
          <span className={isMitigated ? "text-emerald-400 font-bold" : "text-rose-400"}>
            {isMitigated ? "Mitigated (100%)" : `Step ${securityStep + 1}/5`}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-1" />
        </button>
      ) : (
        <div
          className={`w-[320px] sm:w-[350px] rounded-xl border bg-[#0d070b]/98 backdrop-blur-xl shadow-2xl shadow-black/80 p-3 flex flex-col gap-2.5 text-left ring-1 ${
            isMitigated
              ? "border-emerald-500/50 ring-emerald-500/20"
              : "border-rose-500/50 ring-rose-500/20"
          }`}
        >
          {/* Card Header & Vector Info */}
          <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300">
                  {activeVector.displayNumber}
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 uppercase">
                  {activeVector.severity} {activeVector.cvssScore}
                </span>
                <span className="text-[9px] font-mono text-zinc-400 truncate">
                  {activeVector.cwe}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white font-sans leading-snug truncate">
                {activeVector.title}
              </h4>
            </div>

            <button
              onClick={() => setIsSecurityCardMinimized(true)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors shrink-0"
              title="Minimize Security Card"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Description Summary */}
          <p className="text-[10px] text-zinc-400 font-sans leading-relaxed line-clamp-2">
            {activeVector.summary}
          </p>

          {/* Target Endpoint & Attack Type */}
          <div className="flex items-center justify-between text-[9px] font-mono bg-zinc-900/60 p-1.5 rounded border border-zinc-800">
            <div className="flex items-center gap-1 text-zinc-300 truncate">
              <span className="text-zinc-500">Route:</span>
              <span className="text-rose-300 font-semibold truncate">{activeVector.endpointPath}</span>
            </div>
            <span className="text-zinc-500 text-[8px] uppercase tracking-wider">
              {activeVector.owasp}
            </span>
          </div>

          {/* Pentest Progress Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-zinc-400">Pentest & Remediation Lifecycle</span>
              <span className={isMitigated ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {Math.round(((securityStep + 1) / 5) * 100)}% {isMitigated ? "(100% Mitigated)" : ""}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
              <motion.div
                className={`h-full rounded-full ${
                  isMitigated
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : "bg-gradient-to-r from-rose-500 via-amber-500 to-red-500"
                }`}
                animate={{ width: `${((securityStep + 1) / 5) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
            </div>
          </div>

          {/* 5-Step Checklist */}
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {activeVector.steps.map((st, idx) => {
              const isPast = idx < securityStep;
              const isCurrent = idx === securityStep;
              const isMitigatedStep = idx === 4;

              return (
                <button
                  key={st.id}
                  onClick={() => setSecurityStep(idx)}
                  className={`w-full flex items-center justify-between p-1.5 rounded text-left transition-all ${
                    isCurrent
                      ? isMitigatedStep
                        ? "bg-emerald-950/70 border border-emerald-500/50"
                        : "bg-rose-950/70 border border-rose-500/50"
                      : "bg-zinc-900/30 hover:bg-zinc-900/80 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isPast ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <span
                        className={`w-2 h-2 rounded-full animate-ping shrink-0 ${
                          isMitigatedStep ? "bg-emerald-400" : "bg-rose-400"
                        }`}
                      />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-zinc-700 shrink-0" />
                    )}
                    <span
                      className={`text-[10px] font-mono truncate ${
                        isCurrent
                          ? "text-white font-bold"
                          : isPast
                          ? "text-zinc-400 line-through"
                          : "text-zinc-500"
                      }`}
                    >
                      {st.title}
                    </span>
                  </div>

                  <span
                    className={`text-[8px] font-mono px-1 py-0.2 rounded shrink-0 ${
                      isCurrent
                        ? isMitigatedStep
                          ? "bg-emerald-900 text-emerald-300"
                          : "bg-rose-900 text-rose-300"
                        : "text-zinc-600"
                    }`}
                  >
                    {st.phase}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Vector Switcher Bar at Card Bottom */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[9px] font-mono text-zinc-500">
            <span>Select Vector:</span>
            <div className="flex items-center gap-1">
              {SECURITY_VECTORS.map((vec, vIdx) => (
                <button
                  key={vec.id}
                  onClick={() => {
                    setSelectedVectorIndex(vIdx);
                    setSecurityStep(0);
                  }}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    selectedVectorIndex === vIdx
                      ? "bg-rose-950 text-rose-200 border border-rose-800/80 font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {vec.displayNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
