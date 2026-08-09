import React from "react";
import { Textarea } from "@workspace/ui/components/textarea";
import { Switch } from "@workspace/ui/components/switch";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Sparkles, Code2 } from "lucide-react";
import { AuthHookConfig, LIFECYCLE_HOOK_SLOTS, AuthLifecycleHookDefinition, AUTH_HOOK_EVENTS } from "@workspace/canvas";
import { AuthConfigSectionProps } from "./types";

export const AuthHooksSection: React.FC<AuthConfigSectionProps> = ({
  data,
  updateData,
}) => {
  const hooks: AuthHookConfig[] = data.hooks || [
    { event: AUTH_HOOK_EVENTS.ON_SIGN_UP, enabled: true, mode: "naturalLanguage", prompt: LIFECYCLE_HOOK_SLOTS[0]?.defaultPrompt || "" },
  ];

  const getHookForEvent = (event: AuthLifecycleHookDefinition["event"]): AuthHookConfig | undefined => {
    return hooks.find((h) => h.event === event);
  };

  const updateHookForEvent = (event: AuthLifecycleHookDefinition["event"], changes: Partial<AuthHookConfig>) => {
    const existing = getHookForEvent(event);
    let updated: AuthHookConfig[];
    if (existing) {
      updated = hooks.map((h) => (h.event === event ? { ...h, ...changes } : h));
    } else {
      updated = [...hooks, { event, enabled: true, mode: "naturalLanguage", ...changes }];
    }
    updateData({ hooks: updated });
  };

  const activeHooksCount = hooks.filter((h) => h.enabled !== false).length;

  return (
    <AccordionItem
      value="hooks"
      className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 text-left flex-1">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Structured Auth Lifecycle Hooks
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium">
            {activeHooksCount} Active Hooks
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1">
        <div className="flex flex-col gap-4 pt-2">
          {/* List of Named Hook Slots */}
          <div className="flex flex-col gap-3">
            {LIFECYCLE_HOOK_SLOTS.map((slot) => {
              const hook = getHookForEvent(slot.event);
              const isEnabled = hook?.enabled ?? false;
              const mode = hook?.mode || "naturalLanguage";

              return (
                <div
                  key={slot.event}
                  className={`flex flex-col gap-2.5 p-3 rounded-lg border text-xs transition-colors ${
                    isEnabled
                      ? "bg-background border-primary/40 shadow-sm"
                      : "bg-background/40 border-border/40 opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground text-xs">{slot.label}</span>
                      <span className="text-[10px] text-muted-foreground">{slot.description}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {isEnabled && (
                        <div className="flex items-center rounded border border-border/50 bg-muted/40 p-0.5">
                          <button
                            onClick={() => updateHookForEvent(slot.event, { mode: "naturalLanguage" })}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 ${
                              mode === "naturalLanguage"
                                ? "bg-background text-primary shadow-xs font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Sparkles className="w-3 h-3" /> AI Prompt
                          </button>
                          <button
                            onClick={() => updateHookForEvent(slot.event, { mode: "code" })}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 ${
                              mode === "code"
                                ? "bg-background text-primary shadow-xs font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Code2 className="w-3 h-3" /> Code
                          </button>
                        </div>
                      )}

                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          updateHookForEvent(slot.event, {
                            enabled: Boolean(checked),
                            prompt: hook?.prompt || slot.defaultPrompt,
                            code: hook?.code || slot.defaultCode,
                          })
                        }
                      />
                    </div>
                  </div>

                  {isEnabled && (
                    <div className="pt-1">
                      {mode === "naturalLanguage" ? (
                        <Textarea
                          className="min-h-[70px] text-xs font-mono bg-background/80"
                          placeholder={slot.defaultPrompt}
                          value={hook?.prompt || ""}
                          onChange={(e) => updateHookForEvent(slot.event, { prompt: e.target.value })}
                        />
                      ) : (
                        <Textarea
                          className="min-h-[90px] text-xs font-mono bg-muted/80 text-foreground"
                          placeholder={slot.defaultCode}
                          value={hook?.code || ""}
                          onChange={(e) => updateHookForEvent(slot.event, { code: e.target.value })}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
