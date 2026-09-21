"use client";

import React, { useState, useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Database, Sliders, Zap } from "lucide-react";
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
}

export const StateStoreConfig: React.FC<StateStoreConfigProps> = ({
  id,
  nodeId,
}) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === (nodeId || id)),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);

  const [activeTab, setActiveTab] = useState<"schema" | "playground">("schema");

  const fields: GlobalStoreField[] = useMemo(() => node?.data?.fields || [], [node?.data?.fields]);
  const actions: GlobalStoreAction[] = useMemo(() => node?.data?.actions || [], [node?.data?.actions]);
  const savedTestCases: StateStoreTestCase[] = useMemo(() => node?.data?.testCases || [], [node?.data?.testCases]);

  if (!node) return null;

  const data = node.data;
  const webPageNodes = allNodes.filter((n) => n.type === "webPage");

  const storeName = data.storeName || data.label || "App";
  const scope = data.scope || "global";
  const storage = data.storage || "memory";

  const rawBase = storeName.trim().replace(/[^a-zA-Z0-9_$]/g, "");
  const baseName = rawBase.charAt(0).toUpperCase() + rawBase.slice(1);
  const hookName = baseName.endsWith("Store") ? `use${baseName}` : `use${baseName}Store`;

  // Connected pages via graph edges
  const connectedPageIds = allEdges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => (e.source === node.id ? e.target : e.source));
  const connectedPages = webPageNodes.filter((p) => connectedPageIds.includes(p.id));

  const handleApplyPreset = (preset: StorePreset) => {
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
        ...data,
        label: `${preset.name}Store`,
        storeName: preset.name,
        description: preset.description,
        storage: preset.storage,
        fields: newFields,
        actions: newActions,
      },
    });
    toast.success(`Applied ${preset.name} preset!`);
  };

  const handleAddField = () => {
    const newField: GlobalStoreField = {
      id: `f-${Date.now()}`,
      name: `field${fields.length + 1}`,
      type: "string",
      defaultValue: "",
    };
    updateNode(node.id, {
      data: {
        ...data,
        fields: [...fields, newField],
      },
    });
  };

  const handleUpdateField = (fieldId: string, patch: Partial<GlobalStoreField>) => {
    const updated = fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f));
    updateNode(node.id, {
      data: {
        ...data,
        fields: updated,
      },
    });
  };

  const handleRemoveField = (fieldId: string) => {
    const updatedFields = fields.filter((f) => f.id !== fieldId);
    const updatedActions = actions.filter((a) => a.targetFieldId !== fieldId);
    updateNode(node.id, {
      data: {
        ...data,
        fields: updatedFields,
        actions: updatedActions,
      },
    });
  };

  const handleAddAction = () => {
    const newAction: GlobalStoreAction = {
      id: `act-${Date.now()}`,
      name: `update${fields[0]?.name ? fields[0].name.charAt(0).toUpperCase() + fields[0].name.slice(1) : "State"}`,
      targetFieldId: fields[0]?.id,
      actionType: "set",
    };
    updateNode(node.id, {
      data: {
        ...data,
        actions: [...actions, newAction],
      },
    });
  };

  const handleUpdateAction = (actionId: string, patch: Partial<GlobalStoreAction>) => {
    const updated = actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a));
    updateNode(node.id, {
      data: {
        ...data,
        actions: updated,
      },
    });
  };

  const handleRemoveAction = (actionId: string) => {
    updateNode(node.id, {
      data: {
        ...data,
        actions: actions.filter((a) => a.id !== actionId),
      },
    });
  };

  const handleSaveTestCases = (tc: StateStoreTestCase[]) => {
    updateNode(node.id, {
      data: {
        ...data,
        testCases: tc,
      },
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar p-4 text-xs gap-4 select-none">
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
            onApplyPreset={handleApplyPreset}
            onUpdateStoreName={(name) => updateNode(node.id, { data: { ...data, storeName: name, label: name } })}
            onUpdateDescription={(desc) => updateNode(node.id, { data: { ...data, description: desc } })}
            onUpdateScope={(val) => updateNode(node.id, { data: { ...data, scope: val } })}
            onUpdateStorage={(val) => updateNode(node.id, { data: { ...data, storage: val } })}
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
