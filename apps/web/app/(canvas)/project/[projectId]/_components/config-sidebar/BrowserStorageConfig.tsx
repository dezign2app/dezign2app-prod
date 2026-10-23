"use client";

import React, { useState, useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
  HardDrive,
  Plus,
  Trash2,
  KeyRound,
  ShieldCheck,
  Clock,
  Sparkles,
  Link,
  BookOpen,
  Info,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";
import { BrowserStorageKey, BrowserStorageEngine } from "@workspace/canvas";
import { BackendNodeData } from "@/types/canvas";

export interface BrowserStorageConfigProps {
  id?: string;
  nodeId?: string;
}

const COMMON_PRESETS: Array<{
  name: string;
  type: BrowserStorageKey["type"];
  defaultValue: string | number | boolean;
  description: string;
}> = [
  {
    name: "auth_token",
    type: "string",
    defaultValue: "",
    description: "JWT access or session token",
  },
  {
    name: "theme",
    type: "string",
    defaultValue: "dark",
    description: "UI color scheme preference (dark/light)",
  },
  {
    name: "user_profile",
    type: "object",
    defaultValue: "",
    description: "Cached user details / avatar metadata",
  },
  {
    name: "recent_searches",
    type: "array",
    defaultValue: "",
    description: "List of recently queried search terms",
  },
  {
    name: "has_seen_onboarding",
    type: "boolean",
    defaultValue: false,
    description: "Flag indicating welcome tour completion",
  },
];

export const BrowserStorageConfig: React.FC<BrowserStorageConfigProps> = ({
  id,
  nodeId,
}) => {
  const targetId = nodeId || id;
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === targetId),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);

  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyType, setNewKeyType] = useState<BrowserStorageKey["type"]>("string");
  const [newKeyDefault, setNewKeyDefault] = useState("");
  const [newKeyDesc, setNewKeyDesc] = useState("");

  const data = node?.data;
  const storageName = data?.storageName || data?.label || "BrowserStorage";
  const storageEngine: BrowserStorageEngine = data?.storageEngine || "localStorage";
  const namespace = data?.namespace || "";
  const description = data?.description || "";
  const keys: BrowserStorageKey[] = data?.keys || [];

  // Find all webPages connected to this browser_storage node
  const connectedPages = useMemo(() => {
    if (!targetId) return [];
    const connectedPageIds = new Set<string>();
    edges.forEach((e) => {
      if (e.source === targetId) {
        const targetNode = allNodes.find((n) => n.id === e.target);
        if (targetNode?.type === "webPage") connectedPageIds.add(targetNode.id);
      }
      if (e.target === targetId) {
        const sourceNode = allNodes.find((n) => n.id === e.source);
        if (sourceNode?.type === "webPage") connectedPageIds.add(sourceNode.id);
      }
    });
    return allNodes.filter((n) => connectedPageIds.has(n.id));
  }, [edges, allNodes, targetId]);

  if (!node) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Browser Storage node not found.
      </div>
    );
  }

  const handleUpdate = (updatedData: Partial<BackendNodeData>) => {
    if (!targetId || !node) return;
    updateNode(targetId, {
      data: {
        ...node.data,
        ...updatedData,
        label: updatedData.label ?? node.data.label,
      },
    });
  };

  const handleAddKey = () => {
    const trimmed = newKeyName.trim();
    if (!trimmed) {
      toast.error("Please enter a key name");
      return;
    }
    if (keys.some((k) => k.name === trimmed)) {
      toast.error(`Key "${trimmed}" already exists`);
      return;
    }

    let parsedDefault: string | number | boolean = newKeyDefault;
    if (newKeyType === "number") {
      parsedDefault = Number(newKeyDefault) || 0;
    } else if (newKeyType === "boolean") {
      parsedDefault = newKeyDefault === "true";
    }

    const newKey: BrowserStorageKey = {
      id: crypto.randomUUID(),
      name: trimmed,
      type: newKeyType,
      defaultValue: parsedDefault,
      description: newKeyDesc.trim(),
    };

    handleUpdate({ keys: [...keys, newKey] });
    setNewKeyName("");
    setNewKeyDefault("");
    setNewKeyDesc("");
    toast.success(`Added key "${trimmed}"`);
  };

  const handleAddPreset = (preset: typeof COMMON_PRESETS[0]) => {
    if (keys.some((k) => k.name === preset.name)) {
      toast.info(`Key "${preset.name}" is already in this storage`);
      return;
    }
    const newKey: BrowserStorageKey = {
      id: crypto.randomUUID(),
      name: preset.name,
      type: preset.type,
      defaultValue: preset.defaultValue,
      description: preset.description,
    };
    handleUpdate({ keys: [...keys, newKey] });
    toast.success(`Added preset key "${preset.name}"`);
  };

  const handleDeleteKey = (keyId: string) => {
    handleUpdate({ keys: keys.filter((k) => k.id !== keyId) });
  };

  return (
    <div className="flex flex-col gap-5 p-4 text-xs font-sans">
      {/* Header Banner */}
      <div className="flex items-start justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-md bg-emerald-500/20 text-emerald-500 shrink-0 mt-0.5">
            <HardDrive size={18} />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground text-sm">
              <span>{storageName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono"
              >
                {storageEngine}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Client-side persistent Key-Value storage with getters, setters, and removers.
            </p>
          </div>
        </div>
      </div>

      {/* Storage Identity Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider text-[11px]">
          <Info size={13} className="text-emerald-500" />
          <span>Storage Configuration</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground">Storage Name</Label>
            <Input
              value={storageName}
              onChange={(e) =>
                handleUpdate({ storageName: e.target.value, label: e.target.value })
              }
              placeholder="e.g. AppStorage, UserSession"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground">Storage Engine</Label>
            <Select
              value={storageEngine}
              onValueChange={(val: BrowserStorageEngine) =>
                handleUpdate({ storageEngine: val })
              }
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="localStorage">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    <span>localStorage (Persists across restarts)</span>
                  </div>
                </SelectItem>
                <SelectItem value="sessionStorage">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-emerald-500" />
                    <span>sessionStorage (Active tab only)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground">
              Key Namespace / Prefix (Optional)
            </Label>
            <Input
              value={namespace}
              onChange={(e) => handleUpdate({ namespace: e.target.value })}
              placeholder="e.g. app: or myapp_"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground">Description</Label>
            <Input
              value={description}
              onChange={(e) => handleUpdate({ description: e.target.value })}
              placeholder="Brief description of stored keys..."
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Quick Presets Strip */}
      <div className="space-y-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <Sparkles size={12} className="text-amber-500" />
          <span>Quick Key Presets</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_PRESETS.map((p) => {
            const isAdded = keys.some((k) => k.name === p.name);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handleAddPreset(p)}
                disabled={isAdded}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer",
                  isAdded
                    ? "opacity-50 cursor-not-allowed bg-muted/20 border-border/40 text-muted-foreground"
                    : "bg-background hover:bg-emerald-500/10 border-border/70 hover:border-emerald-500/50 text-foreground",
                )}
                title={p.description}
              >
                <span>+ {p.name}</span>
                <span className="text-[8px] text-muted-foreground uppercase">({p.type})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Keys Schema Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider text-[11px]">
            <KeyRound size={13} className="text-emerald-500" />
            <span>Defined Storage Keys ({keys.length})</span>
          </div>
        </div>

        {keys.length === 0 ? (
          <div className="p-4 text-center rounded-lg border border-dashed border-border/70 text-muted-foreground text-[11px]">
            No keys defined yet. Use the presets above or form below to define keys.
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/40 bg-card/40">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between p-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {namespace ? `${namespace}${k.name}` : k.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 uppercase font-mono text-emerald-400 border-emerald-500/30"
                    >
                      {k.type}
                    </Badge>
                  </div>
                  {k.description && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {k.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {k.defaultValue !== undefined && k.defaultValue !== "" && (
                    <span className="font-mono text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
                      default: {String(k.defaultValue)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteKey(k.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    title="Delete key"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New Key Form */}
        <div className="p-3 rounded-lg border border-border/60 bg-muted/15 space-y-2.5">
          <span className="text-[11px] font-semibold text-foreground">Add Custom Key</span>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. token)..."
              className="h-7 text-xs font-mono"
            />
            <Select
              value={newKeyType}
              onValueChange={(val: BrowserStorageKey["type"]) => setNewKeyType(val)}
            >
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">string</SelectItem>
                <SelectItem value="number">number</SelectItem>
                <SelectItem value="boolean">boolean</SelectItem>
                <SelectItem value="object">object (JSON)</SelectItem>
                <SelectItem value="array">array (List)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newKeyDefault}
              onChange={(e) => setNewKeyDefault(e.target.value)}
              placeholder="Default value (optional)..."
              className="h-7 text-xs font-mono"
            />
            <Input
              value={newKeyDesc}
              onChange={(e) => setNewKeyDesc(e.target.value)}
              placeholder="Description (optional)..."
              className="h-7 text-xs"
            />
          </div>

          <Button
            size="sm"
            onClick={handleAddKey}
            className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
          >
            <Plus size={12} className="mr-1" />
            Add Key
          </Button>
        </div>
      </div>

      {/* Connected Pages Section */}
      <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/20">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Link size={13} className="text-emerald-500" />
          <span>Connected Pages ({connectedPages.length})</span>
        </div>
        {connectedPages.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Connect this storage node to any WebPage on the canvas so actions and components on that page can reference these keys.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {connectedPages.map((p) => (
              <Badge
                key={p.id}
                variant="secondary"
                className="text-[10px] font-mono bg-background border border-border/60"
              >
                {p.data?.label || p.data?.path || p.id}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* How it Works / Docs */}
      <div className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1 font-semibold text-foreground text-xs">
          <BookOpen size={12} className="text-emerald-500" />
          <span>Action Step Usage</span>
        </div>
        <p>
          In any connected WebPage, open the <strong>Action Flow</strong> and add a <strong>Browser Storage</strong> step to set, remove, or clear these keys after API calls, user submissions, or logout triggers.
        </p>
      </div>
    </div>
  );
};

export default BrowserStorageConfig;
