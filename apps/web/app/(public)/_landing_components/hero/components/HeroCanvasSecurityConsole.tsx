"use client";

import React from "react";
import { Terminal, Code2, AlertTriangle, Play, Pause, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert } from "lucide-react";
import type { SecurityStep } from "../ethicalHackerData";

interface HeroCanvasSecurityConsoleProps {
  currentStep: SecurityStep;
  securityStep: number;
  setSecurityStep: React.Dispatch<React.SetStateAction<number>>;
  isConsoleMinimized: boolean;
  setIsConsoleMinimized: (minimized: boolean) => void;
  activeConsoleTab: "http" | "diff" | "cvss";
  setActiveConsoleTab: (tab: "http" | "diff" | "cvss") => void;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  playbackSpeed: 1 | 2;
  setPlaybackSpeed: React.Dispatch<React.SetStateAction<1 | 2>>;
}

export const HeroCanvasSecurityConsole: React.FC<HeroCanvasSecurityConsoleProps> = ({
  currentStep,
  securityStep,
  setSecurityStep,
  isConsoleMinimized,
  setIsConsoleMinimized,
  activeConsoleTab,
  setActiveConsoleTab,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
}) => {
  const isMitigated = securityStep === 4;

  return (
    <div className="absolute bottom-3.5 right-4 z-40 select-none">
      {isConsoleMinimized ? (
        <button
          onClick={() => setIsConsoleMinimized(false)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d070b]/98 border shadow-xl backdrop-blur-md text-xs font-mono transition-all hover:scale-102 ${
            isMitigated
              ? "border-emerald-500/60 text-emerald-300"
              : "border-rose-500/60 text-rose-300"
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-white font-bold">Security Console</span>
          <span className="text-zinc-600">·</span>
          <span className={isMitigated ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
            {isMitigated ? "403 Blocked" : "Fuzzing Active"}
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400 ml-1" />
        </button>
      ) : (
        <div
          className={`w-[330px] sm:w-[440px] rounded-xl border bg-[#0d070b]/98 backdrop-blur-xl shadow-2xl shadow-black/80 p-3 flex flex-col gap-2 text-left ring-1 ${
            isMitigated
              ? "border-emerald-500/50 ring-emerald-500/20"
              : "border-rose-500/50 ring-rose-500/20"
          }`}
        >
          {/* Header & Tabs */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveConsoleTab("http")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  activeConsoleTab === "http"
                    ? "bg-rose-950/80 text-rose-300 border border-rose-700 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Terminal className="w-3 h-3 text-rose-400" />
                <span>Payload & Logs</span>
              </button>

              <button
                onClick={() => setActiveConsoleTab("diff")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  activeConsoleTab === "diff"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Code2 className="w-3 h-3 text-emerald-400" />
                <span>Patch Diff</span>
              </button>

              <button
                onClick={() => setActiveConsoleTab("cvss")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  activeConsoleTab === "cvss"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-700 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>CVSS / OWASP</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title={isPlaying ? "Pause Pentest" : "Resume Pentest"}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </button>

              {/* Speed toggle */}
              <button
                onClick={() => setPlaybackSpeed((s) => (s === 1 ? 2 : 1))}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 transition-colors"
                title="Toggle Speed"
              >
                {playbackSpeed}x
              </button>

              {/* Minimize */}
              <button
                onClick={() => setIsConsoleMinimized(true)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Minimize Console"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TAB 1: HTTP Payload Trace & Terminal Logs */}
          {activeConsoleTab === "http" && (
            <div className="flex flex-col gap-2">
              {/* HTTP Request / Response Pill */}
              <div className="flex flex-col gap-1 p-2 rounded bg-[#070407] border border-zinc-800/80 font-mono text-[9.5px]">
                <div className="flex items-center justify-between text-zinc-300 pb-1 border-b border-zinc-800/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="px-1 py-0.2 rounded bg-rose-950 text-rose-300 font-bold border border-rose-800/60 text-[8.5px]">
                      {currentStep.httpTrace.method}
                    </span>
                    <span className="truncate text-zinc-300">{currentStep.httpTrace.url}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold text-[8.5px] shrink-0 ${
                      currentStep.httpTrace.responseStatus >= 400
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : "bg-rose-950 text-rose-300 border border-rose-800"
                    }`}
                  >
                    {currentStep.httpTrace.responseStatus} {currentStep.httpTrace.responseStatusText}
                  </span>
                </div>

                {currentStep.httpTrace.requestPayload && (
                  <div className="flex flex-col gap-0.5 pt-1 text-[9px] text-zinc-400">
                    <span className="text-zinc-500 font-bold text-[8px] uppercase">Injected Payload:</span>
                    <pre className="text-rose-300/90 whitespace-pre-wrap font-mono text-[8.5px] max-h-[60px] overflow-y-auto bg-black/40 p-1 rounded">
                      {currentStep.httpTrace.requestPayload}
                    </pre>
                  </div>
                )}
              </div>

              {/* Terminal Logs */}
              <div className="bg-[#050305] rounded-lg border border-zinc-800/90 p-2.5 font-mono text-[9.5px] max-h-[140px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 flex flex-col gap-1">
                {currentStep.terminalLogs.map((log, lIdx) => {
                  const isCritical = log.includes("[CRITICAL]") || log.includes("[ALERT]");
                  const isFuzz = log.includes("[FUZZ]") || log.includes("[INJECT]");
                  const isSuccess = log.includes("[SUCCESS]") || log.includes("[CERTIFIED]");
                  const isPatch = log.includes("[PATCH]") || log.includes("[COMPILE]");

                  return (
                    <div
                      key={lIdx}
                      className={`leading-relaxed flex items-start gap-1.5 ${
                        isCritical
                          ? "text-rose-400 font-semibold"
                          : isSuccess
                          ? "text-emerald-400 font-semibold"
                          : isFuzz
                          ? "text-amber-300"
                          : isPatch
                          ? "text-cyan-300"
                          : "text-zinc-400"
                      }`}
                    >
                      <span className="text-zinc-600 select-none text-[8.5px]">❯</span>
                      <span className="break-all">{log}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Code Diff Patch */}
          {activeConsoleTab === "diff" && (
            <div className="flex flex-col gap-1.5">
              {currentStep.diffPreview ? (
                <>
                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 border-b border-zinc-800/80 pb-1">
                    <span className="text-zinc-200 font-bold truncate">
                      {currentStep.diffPreview.filename}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-bold">
                        +{currentStep.diffPreview.additions}
                      </span>
                      <span className="text-rose-400 font-bold">
                        -{currentStep.diffPreview.deletions}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#050305] rounded-lg border border-zinc-800/90 p-2 font-mono text-[9px] max-h-[170px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 flex flex-col gap-0.5">
                    {currentStep.diffPreview.lines.map((line, lineIdx) => {
                      if (line.type === "add") {
                        return (
                          <div
                            key={lineIdx}
                            className="bg-emerald-950/40 text-emerald-300 px-1.5 py-0.2 rounded font-medium whitespace-pre"
                          >
                            {line.text}
                          </div>
                        );
                      }
                      if (line.type === "remove") {
                        return (
                          <div
                            key={lineIdx}
                            className="bg-rose-950/40 text-rose-300 line-through px-1.5 py-0.2 rounded whitespace-pre"
                          >
                            {line.text}
                          </div>
                        );
                      }
                      return (
                        <div key={lineIdx} className="text-zinc-500 px-1.5 whitespace-pre">
                          {line.text}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-xs font-mono text-zinc-500">
                  <span>Code diff available during Auto-Patch & Mitigated phases (Steps 4 & 5).</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CVSS Advisory & OWASP Breakdown */}
          {activeConsoleTab === "cvss" && (
            <div className="flex flex-col gap-2 p-1 font-mono text-[9.5px]">
              {currentStep.advisory ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-wider text-zinc-500">
                        CVSS v3.1 Severity Score
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          currentStep.advisory.score >= 9.0
                            ? "text-rose-400"
                            : currentStep.advisory.score >= 7.0
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {currentStep.advisory.score} {currentStep.advisory.severity}
                      </span>
                    </div>

                    <div className="text-right flex flex-col">
                      <span className="text-[8px] uppercase tracking-wider text-zinc-500">
                        Classification
                      </span>
                      <span className="text-zinc-200 font-bold">{currentStep.advisory.owasp}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 p-2 rounded bg-[#070407] border border-zinc-800 text-[9px]">
                    <span className="text-zinc-500 uppercase text-[8px] font-bold">Vector String:</span>
                    <span className="text-zinc-300 font-mono text-[8px]">{currentStep.advisory.vectorString}</span>

                    <span className="text-zinc-500 uppercase text-[8px] font-bold mt-1">Impact:</span>
                    <p className="text-zinc-400 text-[9px] leading-relaxed">
                      {currentStep.advisory.impactDescription}
                    </p>

                    <span className="text-zinc-500 uppercase text-[8px] font-bold mt-1">
                      Remediation Strategy:
                    </span>
                    <p className="text-emerald-400/90 text-[9px] leading-relaxed font-semibold">
                      {currentStep.advisory.remediationRecommendation}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs font-mono text-zinc-500">
                  <span>Advisory data loaded for this vector.</span>
                </div>
              )}
            </div>
          )}

          {/* Footer Status */}
          <div className="pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[9px] font-mono text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isMitigated ? "bg-emerald-400" : "bg-rose-500 animate-ping"
                }`}
              />
              <span className={isMitigated ? "text-emerald-300" : "text-rose-300"}>
                {isMitigated ? "Exploit Blocked" : "Active Pentest Assessment"}
              </span>
            </span>
            <span className="text-zinc-400">Step {securityStep + 1} of 5</span>
          </div>
        </div>
      )}
    </div>
  );
};
