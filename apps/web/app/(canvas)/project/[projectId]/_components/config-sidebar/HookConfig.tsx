"use client";

import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { Anchor, Sparkles, Code2, Plus, Trash2 } from "lucide-react";
import { Parameter } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";

export interface HookConfigProps {
  id: string;
  nodeId: string;
}

export const HookConfig: React.FC<HookConfigProps> = ({ id, nodeId }) => {
  const rawNode = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === (nodeId || id)),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);

  const node = React.useMemo(() => {
    if (!rawNode) return null;
    if (rawNode.type === "hook_ref" && rawNode.data?.hookRef) {
      const master = allNodes.find(
        (n) =>
          n.type === "hook" &&
          (n.id === rawNode.data.hookRef ||
            n.data?.hookName === rawNode.data.hookRef ||
            n.data?.label === rawNode.data.hookRef),
      );
      return master || rawNode;
    }
    return rawNode;
  }, [rawNode, allNodes]);

  if (!node) return null;

  const data = node.data;
  const webAppNodes = allNodes.filter((n) => n.type === "webApp");
  const scope = data.scope || "global";

  const handleScopeChange = (newScope: "global" | "local") => {
    updateNode(node.id, {
      data: {
        ...data,
        scope: newScope,
        targetWebAppId:
          newScope === "local"
            ? data.targetWebAppId || webAppNodes[0]?.id
            : undefined,
      },
    });
  };

  const handleNameChange = (newName: string) => {
    const clean = newName.replace(/[^a-zA-Z0-9_]/g, "");
    updateNode(node.id, {
      data: {
        ...data,
        hookName: clean,
        label: clean,
      },
    });
  };

  const inputParams: Parameter[] = data.inputParams || [];
  const returnSchema: Parameter[] = data.returnSchema || [];

  const addParam = (type: "input" | "return") => {
    const newField: Parameter = {
      id: `param_${Date.now()}`,
      name: type === "input" ? "param" : "field",
      type: "string",
      required: true,
    };
    if (type === "input") {
      updateNode(node.id, {
        data: {
          ...data,
          inputParams: [...inputParams, newField],
        },
      });
    } else {
      updateNode(node.id, {
        data: {
          ...data,
          returnSchema: [...returnSchema, newField],
        },
      });
    }
  };

  const removeParam = (type: "input" | "return", paramId?: string) => {
    if (type === "input") {
      updateNode(node.id, {
        data: {
          ...data,
          inputParams: inputParams.filter((p) => p.id !== paramId),
        },
      });
    } else {
      updateNode(node.id, {
        data: {
          ...data,
          returnSchema: returnSchema.filter((p) => p.id !== paramId),
        },
      });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar p-4 space-y-5 select-none text-xs">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b">
        <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
          <Anchor size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {data.hookName || data.label || "useCustomHook"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Custom React Hook & Data Fetching Layer
          </p>
        </div>
      </div>

      {/* Scope & Identity */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Hook Name
          </Label>
          <Input
            value={data.hookName || data.label || ""}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="useProducts"
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Scope
            </Label>
            <Select
              value={scope}
              onValueChange={(v) => handleScopeChange(v === "local" ? "local" : "global")}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global" className="text-xs">
                  Global (All Web Apps)
                </SelectItem>
                <SelectItem value="local" className="text-xs">
                  Local (1 Web App)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Hook Type
            </Label>
            <Select
              value={data.hookType || "query"}
              onValueChange={(v) => {
                const nextHookType =
                  v === "mutation" || v === "subscription" || v === "custom"
                    ? v
                    : "query";
                updateNode(node.id, {
                  data: { ...data, hookType: nextHookType },
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="query" className="text-xs">
                  Data Query (GET)
                </SelectItem>
                <SelectItem value="mutation" className="text-xs">
                  Mutation (POST/PUT/DEL)
                </SelectItem>
                <SelectItem value="subscription" className="text-xs">
                  Subscription (WS/SSE)
                </SelectItem>
                <SelectItem value="custom" className="text-xs">
                  Custom Logic Hook
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {scope === "local" && (
          <div className="space-y-1.5 p-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
            <Label className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Owning Web App
            </Label>
            <Select
              value={data.targetWebAppId || webAppNodes[0]?.id || ""}
              onValueChange={(v) =>
                updateNode(node.id, {
                  data: { ...data, targetWebAppId: v },
                })
              }
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select Web App..." />
              </SelectTrigger>
              <SelectContent>
                {webAppNodes.map((app) => (
                  <SelectItem key={app.id} value={app.id} className="text-xs">
                    {app.data?.label || app.data?.appName || "Web App"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              This hook will be compiled to{" "}
              <code className="text-sky-500">apps/&lt;app&gt;/hooks/</code> and
              accessible to all its pages.
            </p>
          </div>
        )}

        {/* Bound Backend Endpoint */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Backend Endpoint Binding
          </Label>
          <Select
            value={data.targetEndpointId || "none"}
            onValueChange={(v) =>
              updateNode(node.id, {
                data: {
                  ...data,
                  targetEndpointId: v === "none" ? undefined : v,
                },
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="None (Standalone Hook)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                None (Standalone Hook)
              </SelectItem>
              {endpoints.map((ep) => (
                <SelectItem key={ep.id} value={ep.id} className="text-xs font-mono">
                  {(ep.type || "GET").toUpperCase()} {ep.name || "/"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Input Parameters */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Input Arguments
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-cyan-600 hover:text-cyan-500"
            onClick={() => addParam("input")}
          >
            <Plus size={12} className="mr-1" /> Add Arg
          </Button>
        </div>
        {inputParams.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 italic">
            No arguments required
          </p>
        ) : (
          <div className="space-y-1.5">
            {inputParams.map((p, idx) => (
              <div key={p.id || idx} className="flex items-center gap-1.5">
                <Input
                  value={p.name || ""}
                  onChange={(e) => {
                    const next = [...inputParams];
                    next[idx] = { ...p, name: e.target.value };
                    updateNode(node.id, {
                      data: { ...data, inputParams: next },
                    });
                  }}
                  placeholder="paramName"
                  className="h-7 text-xs font-mono flex-1"
                />
                <Input
                  value={p.type || "string"}
                  onChange={(e) => {
                    const next = [...inputParams];
                    next[idx] = { ...p, type: e.target.value };
                    updateNode(node.id, {
                      data: { ...data, inputParams: next },
                    });
                  }}
                  placeholder="string"
                  className="h-7 text-xs font-mono w-24"
                />
                <button
                  onClick={() => removeParam("input", p.id)}
                  className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Implementation Code / AI Prompt */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Code2 size={13} /> Hook Implementation (TypeScript)
          </Label>
        </div>
        <Textarea
          value={data.code || ""}
          onChange={(e) =>
            updateNode(node.id, {
              data: { ...data, code: e.target.value },
            })
          }
          placeholder="// Return custom state, query data, or mutation callbacks&#10;const [state, setState] = useState(null);&#10;return { state, setState };"
          className="min-h-[120px] font-mono text-xs bg-muted/20 resize-y p-2"
        />
      </div>

      {/* AI Generation Prompt */}
      <div className="space-y-2 pt-2 border-t">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Sparkles size={13} className="text-cyan-500" /> AI Instruction Prompt
        </Label>
        <Textarea
          value={data.prompt || ""}
          onChange={(e) =>
            updateNode(node.id, {
              data: { ...data, prompt: e.target.value },
            })
          }
          placeholder="e.g. Automatically fetch products using TanStack Query with 30s stale time and error toast notifications."
          className="min-h-[70px] text-xs bg-muted/20 resize-y p-2"
        />
      </div>
    </div>
  );
};

export default HookConfig;
