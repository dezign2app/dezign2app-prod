"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Database, Sliders, Zap, AlertCircle, AlertTriangle } from "lucide-react";
import { GlobalStoreField, GlobalStoreAction, StateStoreTestCase } from "@workspace/canvas/types";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";
import {
  StorePreset,
  StoreIdentitySection,
  StoreFieldsSection,
  StoreActionsSection,
  StoreLiveTestPlayground,
} from "./state-store-config";

export interface StateStoreConfigProps {
  id: string;
  nodeId: string;
  className?: string;
}

export const StateStoreConfig: React.FC<StateStoreConfigProps> = ({
  id,
  nodeId,
  className,
}) => {
  const targetNodeId = nodeId || id;
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === targetNodeId),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);

  const [activeTab, setActiveTab] = useState<"schema" | "playground">("schema");

  const fields: GlobalStoreField[] = useMemo(() => node?.data?.fields || [], [node?.data?.fields]);
  const actions: GlobalStoreAction[] = useMemo(() => node?.data?.actions || [], [node?.data?.actions]);
  const savedTestCases: StateStoreTestCase[] = useMemo(() => node?.data?.testCases || [], [node?.data?.testCases]);

  const connectedPages = useMemo(() => {
    if (!targetNodeId) return [];
    const connectedPageIds = new Set(
      allEdges
        .filter((e) => e.source === targetNodeId || e.target === targetNodeId)
        .map((e) => (e.source === targetNodeId ? e.target : e.source))
    );
    return allNodes.filter((n) => n.type === "webPage" && connectedPageIds.has(n.id));
  }, [allNodes, allEdges, targetNodeId]);

  const handleApplyPreset = useCallback((preset: StorePreset) => {
    if (!node) return;
    const newFields: GlobalStoreField[] = preset.fields.map((f, idx) => ({
      id: `f-${Date.now()}-${idx}`,
      name: f.name,
      type: f.type,
      defaultValue: f.defaultValue,
    }));

    const newActions: GlobalStoreAction[] = preset.actions.map((a, idx) => {
      const matchedField = newFields.find((f) => f.name === a.targetFieldName);
      return {
        id: `act-${Date.now()}-${idx}`,
        name: a.name,
        targetFieldId: matchedField?.id,
        actionType: a.actionType,
        code: a.code,
        parameters: a.parameters,
      };
    });

    updateNode(node.id, {
      data: {
        ...node.data,
        label: `${preset.name}Store`,
        storeName: preset.name,
        description: preset.description,
        storage: preset.storage,
        fields: newFields,
        actions: newActions,
      },
    });
    toast.success(`Applied ${preset.name} preset!`);
  }, [node, updateNode]);

  const handleAddField = useCallback(() => {
    if (!node) return;
    const existingNames = new Set(fields.map((f) => f.name.trim().toLowerCase()));
    let nextNum = fields.length + 1;
    while (existingNames.has(`field${nextNum}`.toLowerCase())) {
      nextNum++;
    }
    const newField: GlobalStoreField = {
      id: `f-${Date.now()}`,
      name: `field${nextNum}`,
      type: "string",
      defaultValue: "",
    };
    updateNode(node.id, {
      data: {
        ...node.data,
        fields: [...fields, newField],
      },
    });
  }, [node, fields, updateNode]);

  const handleUpdateField = useCallback((fieldId: string, patch: Partial<GlobalStoreField>) => {
    if (!node) return;
    const updated = fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f));
    updateNode(node.id, {
      data: {
        ...node.data,
        fields: updated,
      },
    });
  }, [node, fields, updateNode]);

  const handleRemoveField = useCallback((fieldId: string) => {
    if (!node) return;
    const updatedFields = fields.filter((f) => f.id !== fieldId);
    const updatedActions = actions.filter((a) => a.targetFieldId !== fieldId);
    updateNode(node.id, {
      data: {
        ...node.data,
        fields: updatedFields,
        actions: updatedActions,
      },
    });
  }, [node, fields, actions, updateNode]);

  const handleAddAction = useCallback(() => {
    if (!node) return;
    const newAction: GlobalStoreAction = {
      id: `act-${Date.now()}`,
      name: `update${fields[0]?.name ? fields[0].name.charAt(0).toUpperCase() + fields[0].name.slice(1) : "State"}`,
      targetFieldId: fields[0]?.id,
      actionType: "set",
    };
    updateNode(node.id, {
      data: {
        ...node.data,
        actions: [...actions, newAction],
      },
    });
  }, [node, fields, actions, updateNode]);

  const handleUpdateAction = useCallback((actionId: string, patch: Partial<GlobalStoreAction>) => {
    if (!node) return;
    const updated = actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a));
    updateNode(node.id, {
      data: {
        ...node.data,
        actions: updated,
      },
    });
  }, [node, actions, updateNode]);

  const handleRemoveAction = useCallback((actionId: string) => {
    if (!node) return;
    updateNode(node.id, {
      data: {
        ...node.data,
        actions: actions.filter((a) => a.id !== actionId),
      },
    });
  }, [node, actions, updateNode]);

  const handleSaveTestCases = useCallback((tc: StateStoreTestCase[]) => {
    if (!node) return;
    updateNode(node.id, {
      data: {
        ...node.data,
        testCases: tc,
      },
    });
  }, [node, updateNode]);

  const handleUpdateStoreName = useCallback((name: string) => {
    if (!node) return;
    updateNode(node.id, { data: { ...node.data, storeName: name, label: name } });
  }, [node, updateNode]);

  const handleUpdateDescription = useCallback((desc: string) => {
    if (!node) return;
    updateNode(node.id, { data: { ...node.data, description: desc } });
  }, [node, updateNode]);

  const handleUpdateScope = useCallback((val: "global" | "local") => {
    if (!node) return;
    updateNode(node.id, { data: { ...node.data, scope: val } });
  }, [node, updateNode]);

  const handleUpdateStorage = useCallback((val: "memory" | "localStorage" | "sessionStorage") => {
    if (!node) return;
    updateNode(node.id, { data: { ...node.data, storage: val } });
  }, [node, updateNode]);

  if (!node) return null;

  const data = node.data;
  const storeName = data.storeName || data.label || "App";
  const scope = data.scope || "global";
  const storage = data.storage || "memory";

  const rawBase = storeName.trim().replace(/[^a-zA-Z0-9_$]/g, "");
  const baseName = rawBase.charAt(0).toUpperCase() + rawBase.slice(1);
  const hookName = baseName.endsWith("Store") ? `use${baseName}` : `use${baseName}Store`;

  const currentStoreName = storeName.trim();
  const duplicateStoreNodes = useMemo(() => {
    const key = currentStoreName.toLowerCase();
    if (!key) return [];
    return allNodes.filter(
      (n) =>
        n.id !== node.id &&
        n.type === "state_store" &&
        (n.data?.storeName || n.data?.label || "App").trim().toLowerCase() === key,
    );
  }, [allNodes, node.id, currentStoreName]);
  const isDuplicateStoreName = duplicateStoreNodes.length > 0;

  const duplicateFieldNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of fields) {
      const key = f.name?.trim().toLowerCase();
      if (key) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const duplicates = new Set<string>();
    for (const [key, count] of counts.entries()) {
      if (count > 1) duplicates.add(key);
    }
    return duplicates;
  }, [fields]);

  return (
    <div
      className={cn(
        "flex flex-col h-full overflow-y-auto hide-scrollbar p-4 text-xs gap-4 select-none",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            <Database size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              State Store
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] px-1 py-0 uppercase font-mono",
                  scope === "global"
                    ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                    : "text-sky-400 border-sky-500/30 bg-sky-500/10",
                )}
              >
                {scope}
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              {hookName}()
            </p>
          </div>
        </div>
      </div>

      {/* Validation Warnings / Error Alerts */}
      {isDuplicateStoreName && (
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-destructive/15 border border-destructive/40 text-destructive text-xs">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-xs">Duplicate App Store Name</span>
            <span className="text-[11px] text-destructive/90">
              Another App Store on this canvas is already named &quot;{storeName}&quot; (Node: {duplicateStoreNodes[0]?.data?.label || duplicateStoreNodes[0]?.id}). Each App Store must have a unique name.
            </span>
          </div>
        </div>
      )}

      {duplicateFieldNames.size > 0 && (
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-destructive/15 border border-destructive/40 text-destructive text-xs">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-xs">Duplicate State Field Names</span>
            <span className="text-[11px] text-destructive/90">
              {duplicateFieldNames.size} duplicate field {duplicateFieldNames.size === 1 ? "name" : "names"} detected ({Array.from(duplicateFieldNames).join(", ")}). Field names must be unique within this store.
            </span>
          </div>
        </div>
      )}

      {/* Main Tabs: Store & Logic vs. Live Test Area */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "schema" | "playground")}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-full h-8 bg-muted/40 p-0.5 rounded-lg border border-border/50">
          <TabsTrigger
            value="schema"
            className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sliders size={12} />
            <span>Store & Logic</span>
          </TabsTrigger>
          <TabsTrigger
            value="playground"
            className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Zap size={12} className="text-amber-400" />
            <span>Live Test Area</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Store & Logic */}
        <TabsContent value="schema" className="mt-4 space-y-4">
          <StoreIdentitySection
            storeName={storeName}
            description={data.description || ""}
            scope={scope}
            storage={storage}
            connectedPages={connectedPages}
            isDuplicateStoreName={isDuplicateStoreName}
            duplicateStoreMessage={
              isDuplicateStoreName
                ? `Another App Store is already named "${storeName}" (${duplicateStoreNodes[0]?.data?.label || duplicateStoreNodes[0]?.id}). Store names must be unique.`
                : undefined
            }
            onApplyPreset={handleApplyPreset}
            onUpdateStoreName={handleUpdateStoreName}
            onUpdateDescription={handleUpdateDescription}
            onUpdateScope={handleUpdateScope}
            onUpdateStorage={handleUpdateStorage}
          />

          <StoreFieldsSection
            fields={fields}
            onAddField={handleAddField}
            onUpdateField={handleUpdateField}
            onRemoveField={handleRemoveField}
          />

          <StoreActionsSection
            actions={actions}
            fields={fields}
            onAddAction={handleAddAction}
            onUpdateAction={handleUpdateAction}
            onRemoveAction={handleRemoveAction}
          />
        </TabsContent>

        {/* TAB 2: Live Test Area (State Manipulator Playground & Test Cases) */}
        <TabsContent value="playground" className="mt-4 space-y-4">
          <StoreLiveTestPlayground
            fields={fields}
            actions={actions}
            savedTestCases={savedTestCases}
            onSaveTestCases={handleSaveTestCases}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StateStoreConfig;
