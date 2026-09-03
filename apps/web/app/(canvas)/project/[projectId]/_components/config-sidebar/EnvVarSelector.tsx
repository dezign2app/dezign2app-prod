"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  KeyRound,
  Plus,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@workspace/ui/components/select";
import {
  cleanEnvVarName,
  formatEnvVarRef,
  saveLocalEnvVariable,
} from "@/lib/utils/localEnvSync";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { generateId } from "../backend-nodes/graph-nodes/common";
import { toast } from "sonner";

interface EnvVarItem {
  id: string;
  name: string;
  description?: string;
}

interface EnvVarSelectorProps {
  serviceNodeId?: string;
  nodeEnvVars?: EnvVarItem[];
  currentEnvVar: string;
  onChange: (cleanName: string, refString: string) => void;
  projectId?: string;
}

export const EnvVarSelector: React.FC<EnvVarSelectorProps> = ({
  serviceNodeId,
  nodeEnvVars = [],
  currentEnvVar,
  onChange,
  projectId,
}) => {
  const node = useBackendCanvasStore((s) =>
    serviceNodeId ? s.nodes.find((n) => n.id === serviceNodeId) : undefined,
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const cleanCurrent = cleanEnvVarName(currentEnvVar) || "API_KEY";

  const [selectedVar, setSelectedVar] = useState(cleanCurrent);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarSecret, setNewVarSecret] = useState("");

  // Available options: items from node.data.envVars plus current if not yet listed
  const availableVars = useMemo(() => {
    const list: string[] = [];
    const sourceList = node?.data?.envVars || nodeEnvVars || [];
    sourceList.forEach((item) => {
      const clean = cleanEnvVarName(item.name);
      if (clean && !list.includes(clean)) list.push(clean);
    });
    if (cleanCurrent && !list.includes(cleanCurrent)) {
      list.unshift(cleanCurrent);
    }
    if (list.length === 0) {
      list.push("API_KEY");
    }
    return list;
  }, [node, nodeEnvVars, cleanCurrent]);

  // Sync external changes
  useEffect(() => {
    if (cleanCurrent && cleanCurrent !== selectedVar) {
      setSelectedVar(cleanCurrent);
    }
  }, [cleanCurrent, selectedVar]);

  const handleSelectVar = (val: string) => {
    if (val === "__create_new__") {
      setIsCreatingNew(true);
      return;
    }
    setSelectedVar(val);
    onChange(val, formatEnvVarRef(val));
  };

  const handleCreateAndSaveNew = async () => {
    const clean = cleanEnvVarName(newVarName);
    if (!clean) {
      toast.error("Please enter a valid variable name");
      return;
    }

    // 1. Add to node data if serviceNodeId exists
    if (serviceNodeId && node) {
      const currentList = node.data?.envVars || [];
      const updated = [...currentList, { id: generateId(), name: clean }];
      updateNode(serviceNodeId, {
        data: {
          ...node.data,
          envVars: updated,
        },
      });
    }

    // 2. Save secret to local .env
    if (newVarSecret) {
      await saveLocalEnvVariable(clean, newVarSecret, projectId);
    }

    // 3. Set as active
    setSelectedVar(clean);
    onChange(clean, formatEnvVarRef(clean));
    setIsCreatingNew(false);
    setNewVarName("");
    setNewVarSecret("");
    toast.success(`Added ${clean} and saved to local .env`);
  };

  const handleDirectToNode = () => {
    if (serviceNodeId) {
      setActiveConfigItem({
        type: "external",
        id: serviceNodeId,
        nodeId: serviceNodeId,
      });
      // Scroll smoothly to node env section if in canvas DOM
      setTimeout(() => {
        const el = document.getElementById(
          `external-node-env-section-${serviceNodeId}`,
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Environment Variable Selector Dropdown */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5">
            <KeyRound size={12} className="text-primary" />
            <span>Environment Variable</span>
          </Label>
          {serviceNodeId && (
            <button
              type="button"
              onClick={handleDirectToNode}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              title="Open External Node Environment Config"
            >
              <span>Manage on Node</span>
              <ExternalLink size={10} />
            </button>
          )}
        </div>

        <Select value={selectedVar} onValueChange={handleSelectVar}>
          <SelectTrigger className="h-8 text-xs bg-background font-mono">
            <SelectValue placeholder="Select variable..." />
          </SelectTrigger>
          <SelectContent>
            {availableVars.map((v) => (
              <SelectItem key={v} value={v} className="text-xs font-mono">
                process.env.{v}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem
              value="__create_new__"
              className="text-xs font-sans text-primary font-medium focus:text-primary"
            >
              <div className="flex items-center gap-1.5">
                <Plus size={12} />
                <span>Create new key / variable...</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <span className="text-[10px] text-muted-foreground flex items-center justify-between">
          <span>
            Referenced as: <code className="text-primary font-semibold font-mono">process.env.{selectedVar}</code>
          </span>
          <button
            type="button"
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
          >
            {isCreatingNew ? "Cancel" : "+ Create New Key"}
          </button>
        </span>
      </div>

      {/* Inline Key Creator */}
      {isCreatingNew && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 border border-primary/30 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1 text-primary">
              <Sparkles size={12} /> Create New Environment Variable
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Variable Name</Label>
            <Input
              className="h-7 text-xs bg-background font-mono"
              placeholder="e.g. STRIPE_SECRET_KEY"
              value={newVarName}
              onChange={(e) => setNewVarName(cleanEnvVarName(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">
              Secret Value (Stored in local .env)
            </Label>
            <Input
              type="password"
              className="h-7 text-xs bg-background font-mono"
              placeholder="sk_live_... (never saved to database)"
              value={newVarSecret}
              onChange={(e) => setNewVarSecret(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsCreatingNew(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleCreateAndSaveNew}
            >
              <Plus size={12} /> Add Key & Save to .env
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
