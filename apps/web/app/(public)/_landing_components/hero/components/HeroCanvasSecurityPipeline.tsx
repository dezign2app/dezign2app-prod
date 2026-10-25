"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, Check, Code2, Terminal, AlertTriangle } from "lucide-react";
import { SECURITY_VECTORS, type SecurityVectorDef, type SecurityStep } from "../ethicalHackerData";

interface HeroCanvasSecurityPipelineProps {
  activeVector: SecurityVectorDef;
  selectedVectorIndex: number;
  setSelectedVectorIndex: (idx: number) => void;
  securityStep: number;
  setSecurityStep: (step: number) => void;
  currentStep: SecurityStep;
  activeConsoleTab: "http" | "diff" | "cvss";
  setActiveConsoleTab: (tab: "http" | "diff" | "cvss") => void;
  isConsoleOpen: boolean;
  setIsConsoleOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const HeroCanvasSecurityPipeline: React.FC<HeroCanvasSecurityPipelineProps> = ({
  activeVector,
  selectedVectorIndex,
  setSelectedVectorIndex,
  securityStep,
  setSecurityStep,
  currentStep,
  activeConsoleTab,
  setActiveConsoleTab,
  isConsoleOpen,
  setIsConsoleOpen,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 bg-[#0c080d] px-4 py-2 gap-2 text-xs font-mono">
      {/* Left: Active Security Vector Pill & Switcher */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#130d16] border border-rose-950/80 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-rose-300 font-bold">{activeVector.displayNumber}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-200 font-medium truncate max-w-[180px] sm:max-w-[260px]">
            {activeVector.title}
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/60 font-bold">
            {activeVector.cwe}
          </span>
        </div>

        {/* Vector Selector Switcher */}
        <div className="flex items-center gap-0.5 bg-[#09060b] p-0.5 rounded border border-zinc-800">
          {SECURITY_VECTORS.map((vec, vIdx) => (
            <button
              key={vec.id}
              onClick={() => {
                setSelectedVectorIndex(vIdx);
                setSecurityStep(0);
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                selectedVectorIndex === vIdx
                  ? "bg-rose-950 text-rose-200 border border-rose-800/80 font-bold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title={`${vec.displayNumber}: ${vec.title} (${vec.cwe})`}
            >
              {vec.displayNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Interactive 5-Step Security Audit Pipeline Strip */}
      <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar py-0.5">
        {activeVector.steps.map((st, idx) => {
          const isPast = idx < securityStep;
          const isCurrent = idx === securityStep;
          const isMitigatedStep = idx === 4;

          return (
            <button
              key={st.id}
              onClick={() => setSecurityStep(idx)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-all shrink-0 ${
                isCurrent
                  ? isMitigatedStep
                    ? "bg-emerald-950/70 text-emerald-200 border border-emerald-500/60 font-semibold shadow-xs"
                    : "bg-rose-950/70 text-rose-200 border border-rose-500/60 font-semibold shadow-xs"
                  : isPast
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {isPast ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : isCurrent ? (
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                    isMitigatedStep ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              )}
              <span>{st.title}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Drawer toggles for HTTP Trace, Code Diff, CVSS Advisory */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            setActiveConsoleTab("http");
            setIsConsoleOpen(true);
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors border ${
            isConsoleOpen && activeConsoleTab === "http"
              ? "bg-rose-950/80 text-rose-300 border-rose-700 font-semibold"
              : "bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:text-white"
          }`}
          title="Inspect HTTP Request and Fuzzing Trace"
        >
          <Terminal className="w-3 h-3 text-rose-400" />
          <span className="hidden sm:inline">Payload Trace</span>
        </button>

        <button
          onClick={() => {
            setActiveConsoleTab("diff");
            setIsConsoleOpen(true);
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors border ${
            isConsoleOpen && activeConsoleTab === "diff"
              ? "bg-emerald-950/80 text-emerald-300 border-emerald-700 font-semibold"
              : "bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:text-white"
          }`}
          title="Inspect TypeScript Remediation Patch Diff"
        >
          <Code2 className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">Patch Diff</span>
        </button>

        <button
          onClick={() => {
            setActiveConsoleTab("cvss");
            setIsConsoleOpen(true);
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors border ${
            isConsoleOpen && activeConsoleTab === "cvss"
              ? "bg-amber-950/80 text-amber-300 border-amber-700 font-semibold"
              : "bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:text-white"
          }`}
          title="Inspect CVSS Advisory & OWASP Analysis"
        >
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="hidden md:inline">CVSS Score</span>
        </button>
      </div>
    </div>
  );
};
