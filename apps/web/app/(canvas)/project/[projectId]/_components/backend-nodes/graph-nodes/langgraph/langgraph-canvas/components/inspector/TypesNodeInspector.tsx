import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Braces, Trash, Plus, Link2, ExternalLink, Code2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type {
  LangGraphTypesNodeData,
  LangGraphTypesRefNodeData,
  LangGraphCanvasNode,
  LangGraphTypesNode,
  CustomTypeItem,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_TYPES,
  LANGGRAPH_CANVAS_NODE_TYPES_REF,
} from "../../constants";
import {
  TypeNavigatorBar,
  TypeEditorForm,
} from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/types-config";

interface TypesNodeInspectorProps {
  selectedTypesData?: LangGraphTypesNodeData | null;
  selectedTypesRefData?: LangGraphTypesRefNodeData | null;
  onDeleteTypes: () => void;
  onUpdateTypes: (changes: Partial<LangGraphTypesNodeData>) => void;
  onUpdateTypesRef?: (changes: Partial<LangGraphTypesRefNodeData>) => void;
  nodes?: LangGraphCanvasNode[];
  onSelectNode?: (nodeId: string) => void;
}

export function TypesNodeInspector({
  selectedTypesData,
  selectedTypesRefData,
  onDeleteTypes,
  onUpdateTypes,
  onUpdateTypesRef,
  nodes = [],
  onSelectNode,
}: TypesNodeInspectorProps) {
  const isRefNode = Boolean(selectedTypesRefData);

  // If this is a TypesRef node, find its referenced master node
  const masterNode = useMemo(() => {
    if (!selectedTypesRefData?.typesRef) return undefined;
    return nodes.find(
      (n): n is LangGraphTypesNode =>
        n.id === selectedTypesRefData.typesRef &&
        n.type === LANGGRAPH_CANVAS_NODE_TYPES,
    );
  }, [nodes, selectedTypesRefData?.typesRef]);

  const availableMasterTypes = useMemo(() => {
    return nodes.filter(
      (n): n is LangGraphTypesNode => n.type === LANGGRAPH_CANVAS_NODE_TYPES,
    );
  }, [nodes]);

  // Types list for definition node
  const typesList: CustomTypeItem[] = useMemo(() => {
    if (!selectedTypesData) return [];
    return Array.isArray(selectedTypesData.types) ? selectedTypesData.types : [];
  }, [selectedTypesData]);

  const [activeTypeId, setActiveTypeId] = useState<string | undefined>(
    typesList[0]?.id,
  );

  useEffect(() => {
    if (activeTypeId && typesList.some((t) => t.id === activeTypeId)) return;
    setActiveTypeId(typesList[0]?.id);
  }, [typesList, activeTypeId]);

  const currentType = useMemo(() => {
    return typesList.find((t) => t.id === activeTypeId) || typesList[0];
  }, [typesList, activeTypeId]);

  // Names of other custom types defined across all types nodes in the graph
  const otherCustomTypes = useMemo(() => {
    const names: string[] = [];
    nodes.forEach((n) => {
      if (n.type === LANGGRAPH_CANVAS_NODE_TYPES && n.data?.types) {
        n.data.types.forEach((t) => {
          if (
            t.name &&
            t.name.trim() &&
            t.id !== currentType?.id &&
            t.name.trim() !== currentType?.name?.trim()
          ) {
            names.push(t.name.trim());
          }
        });
      }
    });
    return names;
  }, [nodes, currentType]);

  const handleAddType = useCallback(() => {
    const newTypeId = `type_${Date.now().toString(36).slice(-4)}`;
    const newTypeNumber = typesList.length + 1;
    const newTypeItem: CustomTypeItem = {
      id: newTypeId,
      name: `Type${newTypeNumber}`,
      kind: "interface",
      description: "Custom interface schema",
      fields: [
        {
          id: `field_1`,
          name: "id",
          type: "string",
          required: true,
        },
      ],
    };
    onUpdateTypes({
      types: [...typesList, newTypeItem],
    });
    setActiveTypeId(newTypeId);
  }, [typesList, onUpdateTypes]);

  const handleUpdateCurrentType = useCallback(
    (updates: Partial<CustomTypeItem>) => {
      if (!currentType) return;
      const updatedTypes = typesList.map((t) =>
        t.id === currentType.id ? { ...t, ...updates } : t,
      );
      onUpdateTypes({ types: updatedTypes });
    },
    [currentType, typesList, onUpdateTypes],
  );

  const handleDeleteCurrentType = useCallback(() => {
    if (!currentType) return;
    const remaining = typesList.filter((t) => t.id !== currentType.id);
    onUpdateTypes({ types: remaining });
    setActiveTypeId(remaining[0]?.id);
  }, [currentType, typesList, onUpdateTypes]);

  // If viewing a Ref node
  if (isRefNode && selectedTypesRefData) {
    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">
                {selectedTypesRefData.label || "Types Ref"}
              </span>
              <span className="text-[10px] text-muted-foreground block font-mono">
                Types Reference Node
              </span>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDeleteTypes}
            title="Delete Types Ref node"
          >
            <Trash className="w-4 h-4" />
          </Button>
        </div>

        {/* Master Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-foreground">
            Referenced Types Definition
          </label>
          <Select
            value={selectedTypesRefData.typesRef || ""}
            onValueChange={(val) => {
              const target = availableMasterTypes.find((m) => m.id === val);
              onUpdateTypesRef?.({
                typesRef: val,
                label: target?.data?.label
                  ? `${target.data.label} (Ref)`
                  : "Types Ref",
              });
            }}
          >
            <SelectTrigger className="text-xs font-mono">
              <SelectValue placeholder="Select master Types node..." />
            </SelectTrigger>
            <SelectContent>
              {availableMasterTypes.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                  {m.data.label || m.id} ({m.data.types?.length || 0} types)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Master Preview / Jump */}
        {masterNode ? (
          <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Target: {masterNode.data.label || masterNode.id}
              </span>
              {onSelectNode && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
                  onClick={() => onSelectNode(masterNode.id)}
                >
                  <ExternalLink className="w-3 h-3" /> Go to Master
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(masterNode.data.types || []).map((t) => (
                <Badge
                  key={t.id}
                  variant="secondary"
                  className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                >
                  {t.name} ({t.kind})
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-dashed border-border/70 text-center text-xs text-muted-foreground">
            No master Types node selected. Select one above.
          </div>
        )}
      </div>
    );
  }

  // Master Types definition node
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Braces className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">
              {selectedTypesData?.label || "Custom Types"}
            </span>
            <span className="text-[10px] text-muted-foreground block font-mono">
              TypeScript Interfaces, Types &amp; Enums
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-cyan-500/30 text-cyan-400 bg-cyan-500/10"
          >
            {typesList.length} {typesList.length === 1 ? "type" : "types"}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDeleteTypes}
            title="Delete Types node"
          >
            <Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Navigation bar: type dropdown + add button */}
      <TypeNavigatorBar
        types={typesList}
        currentTypeId={currentType?.id}
        isPackageNode={false}
        onSelectType={setActiveTypeId}
        onAddType={handleAddType}
      />

      {/* Type editor form */}
      {currentType ? (
        <TypeEditorForm
          nodeId={selectedTypesData?.typesId || "types_node"}
          currentType={currentType}
          otherCustomTypes={otherCustomTypes}
          onUpdateCurrentType={handleUpdateCurrentType}
          onDeleteCurrentType={handleDeleteCurrentType}
        />
      ) : (
        <div className="p-6 text-center border border-dashed border-border/70 rounded-xl flex flex-col items-center gap-2">
          <Braces className="w-8 h-8 text-cyan-400/50" />
          <span className="text-xs text-muted-foreground">
            No types defined in this node.
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 text-xs text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20"
            onClick={handleAddType}
          >
            <Plus className="w-3.5 h-3.5" /> Add Type Definition
          </Button>
        </div>
      )}
    </div>
  );
}
