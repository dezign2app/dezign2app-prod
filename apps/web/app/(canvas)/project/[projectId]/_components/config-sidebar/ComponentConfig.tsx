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
import { Layout, Sparkles, Code2, Plus, Trash2 } from "lucide-react";
import { Parameter } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";

export interface ComponentConfigProps {
  id: string;
  nodeId: string;
}

export const ComponentConfig: React.FC<ComponentConfigProps> = ({
  id,
  nodeId,
}) => {
  const rawNode = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === (nodeId || id)),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);

  const node = React.useMemo(() => {
    if (!rawNode) return null;
    if (rawNode.type === "component_ref" && rawNode.data?.componentRef) {
      const master = allNodes.find(
        (n) =>
          n.type === "component" &&
          (n.id === rawNode.data.componentRef ||
            n.data?.componentName === rawNode.data.componentRef ||
            n.data?.label === rawNode.data.componentRef),
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
        componentName: clean,
        label: clean,
      },
    });
  };

  const propsSchema: Parameter[] = data.propsSchema || [];

  const addProp = () => {
    const newProp: Parameter = {
      id: `prop_${Date.now()}`,
      name: "propName",
      type: "string",
      required: true,
    };
    updateNode(node.id, {
      data: {
        ...data,
        propsSchema: [...propsSchema, newProp],
      },
    });
  };

  const removeProp = (propId?: string) => {
    updateNode(node.id, {
      data: {
        ...data,
        propsSchema: propsSchema.filter((p) => p.id !== propId),
      },
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar p-4 space-y-5 select-none text-xs">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b">
        <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
          <Layout size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {data.componentName || data.label || "CustomComponent"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            UI Building Block & Layout Slot Widget
          </p>
        </div>
      </div>

      {/* Scope & Identity */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Component Name
          </Label>
          <Input
            value={data.componentName || data.label || ""}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="ProductCard"
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
              Default Slot
            </Label>
            <Select
              value={data.slotName || "main"}
              onValueChange={(v) => {
                const nextSlot =
                  v === "header" ||
                  v === "sidebar" ||
                  v === "footer" ||
                  v === "modal" ||
                  v === "custom"
                    ? v
                    : "main";
                updateNode(node.id, {
                  data: { ...data, slotName: nextSlot },
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main" className="text-xs">
                  Main Content
                </SelectItem>
                <SelectItem value="header" className="text-xs">
                  Header / Navbar
                </SelectItem>
                <SelectItem value="sidebar" className="text-xs">
                  Sidebar
                </SelectItem>
                <SelectItem value="footer" className="text-xs">
                  Footer
                </SelectItem>
                <SelectItem value="modal" className="text-xs">
                  Modal / Dialog
                </SelectItem>
                <SelectItem value="custom" className="text-xs">
                  Custom Widget
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
              This component will be compiled to{" "}
              <code className="text-sky-500">apps/&lt;app&gt;/components/</code> and
              accessible to all its pages.
            </p>
          </div>
        )}
      </div>

      {/* Props Interface */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Props Interface
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-indigo-600 hover:text-indigo-500"
            onClick={addProp}
          >
            <Plus size={12} className="mr-1" /> Add Prop
          </Button>
        </div>
        {propsSchema.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 italic">
            No props (Self-contained component)
          </p>
        ) : (
          <div className="space-y-1.5">
            {propsSchema.map((p, idx) => (
              <div key={p.id || idx} className="flex items-center gap-1.5">
                <Input
                  value={p.name || ""}
                  onChange={(e) => {
                    const next = [...propsSchema];
                    next[idx] = { ...p, name: e.target.value };
                    updateNode(node.id, {
                      data: { ...data, propsSchema: next },
                    });
                  }}
                  placeholder="title"
                  className="h-7 text-xs font-mono flex-1"
                />
                <Input
                  value={p.type || "string"}
                  onChange={(e) => {
                    const next = [...propsSchema];
                    next[idx] = { ...p, type: e.target.value };
                    updateNode(node.id, {
                      data: { ...data, propsSchema: next },
                    });
                  }}
                  placeholder="string"
                  className="h-7 text-xs font-mono w-24"
                />
                <button
                  onClick={() => removeProp(p.id)}
                  className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Component Code / Template */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Code2 size={13} /> React TSX Code
          </Label>
        </div>
        <Textarea
          value={data.code || ""}
          onChange={(e) =>
            updateNode(node.id, {
              data: { ...data, code: e.target.value },
            })
          }
          placeholder="export function ProductCard({ title }: { title: string }) {&#10;  return (&#10;    <div className='p-4 border rounded-xl shadow-sm'>&#10;      <h3>{title}</h3>&#10;    </div>&#10;  );&#10;}"
          className="min-h-[120px] font-mono text-xs bg-muted/20 resize-y p-2"
        />
      </div>

      {/* AI Generation Prompt */}
      <div className="space-y-2 pt-2 border-t">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Sparkles size={13} className="text-indigo-500" /> AI Instruction Prompt
        </Label>
        <Textarea
          value={data.prompt || ""}
          onChange={(e) =>
            updateNode(node.id, {
              data: { ...data, prompt: e.target.value },
            })
          }
          placeholder="e.g. Modern card with image header, price badge, title, rating stars, and add to cart button using shadcn UI and Tailwind CSS."
          className="min-h-[70px] text-xs bg-muted/20 resize-y p-2"
        />
      </div>
    </div>
  );
};

export default ComponentConfig;
