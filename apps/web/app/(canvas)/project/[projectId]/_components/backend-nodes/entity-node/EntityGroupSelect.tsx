import React, { useState, useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { Boxes, Plus, Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { getNodeDimensions } from "../../hooks/auto-layout/nodeDimensions";

export interface EntityGroupSelectProps {
  nodeId: string;
  variant?: "button" | "sidebar";
  size?: "sm" | "default";
  className?: string;
  readOnly?: boolean;
}

interface GroupOption {
  id?: string;
  title: string;
  badge?: string;
  color?: string;
  memberCount?: number;
}

export const EntityGroupSelect: React.FC<EntityGroupSelectProps> = ({
  nodeId,
  variant = "button",
  size = "default",
  className,
  readOnly = false,
}) => {
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addNode = useBackendCanvasStore((s) => s.addNode);

  const [isOpen, setIsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) return null;

  // Existing group nodes on canvas
  const canvasGroups = useMemo((): GroupOption[] => {
    return allNodes
      .filter((n) => n.type === "group")
      .map((g) => {
        const title = g.data?.label || "Untitled Group";
        const count = allNodes.filter((n) => {
          if (n.type !== "entity" && n.type !== "redis_schema") return false;
          // Priority: 1. data.groupId, 2. data.group matching label, 3. legacy parentId
          if (n.data?.groupId) {
            return n.data.groupId === g.id;
          }
          if (n.data?.group) {
            return (
              (n.data.group || "").toLowerCase().trim() ===
              title.toLowerCase().trim()
            );
          }
          return (n.parentId || n.data?.parentId) === g.id;
        }).length;

        return {
          id: g.id,
          title,
          badge: g.data?.badge,
          color: g.data?.color,
          memberCount: count,
        };
      });
  }, [allNodes]);

  // Resolve the single selected group for this entity
  const selectedGroup = useMemo((): GroupOption | null => {
    // 1. Primary: data.groupId matching an existing canvas group
    if (node.data?.groupId) {
      const matchById = canvasGroups.find((g) => g.id === node.data.groupId);
      if (matchById) return matchById;
    }

    // 2. Secondary: data.group (group title) matching an existing canvas group
    if (node.data?.group) {
      const matchByTitle = canvasGroups.find(
        (g) =>
          g.title.toLowerCase().trim() ===
          (node.data.group || "").toLowerCase().trim(),
      );
      if (matchByTitle) return matchByTitle;
    }

    // 3. Fallback: legacy parentId / data.parentId
    const legacyParent = node.parentId || node.data?.parentId;
    if (legacyParent) {
      const matchByParent = canvasGroups.find((g) => g.id === legacyParent);
      if (matchByParent) return matchByParent;
    }

    // 4. If assigned via title but group node doesn't exist on canvas yet
    if (node.data?.group) {
      return {
        id: node.data?.groupId,
        title: node.data.group,
      };
    }

    return null;
  }, [
    node.data?.groupId,
    node.data?.group,
    node.parentId,
    node.data?.parentId,
    canvasGroups,
  ]);

  const handleSelectGroup = (option: { id?: string; title: string }) => {
    // Check if group node with matching label already exists on canvas
    let targetGroupNode = allNodes.find(
      (n) =>
        n.type === "group" &&
        (n.id === option.id ||
          (n.data?.label || "").toLowerCase().trim() ===
            option.title.toLowerCase().trim()),
    );

    let finalGroupId = targetGroupNode?.id;
    let nextEntityPos = node.position || { x: 150, y: 150 };

    if (!targetGroupNode) {
      const cleanSlug = option.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const newId = `group-${cleanSlug || "custom"}-${crypto.randomUUID().slice(0, 8)}`;
      const entityPos = node.position || { x: 150, y: 150 };

      const dimensions = getNodeDimensions(node);
      // Enclose entity with 36px side padding and 130px top padding (clearing group header tab) + 80px bottom padding
      const groupX = Math.max(0, entityPos.x - 36);
      const groupY = Math.max(0, entityPos.y - 130);
      const groupWidth = Math.max(520, dimensions.width + 72);
      const groupHeight = Math.max(480, dimensions.height + 210);

      const newGroupNode: Omit<BackendNode, "fractionalIndex"> = {
        id: newId,
        type: "group",
        position: {
          x: groupX,
          y: groupY,
        },
        width: groupWidth,
        height: groupHeight,
        style: { width: groupWidth, height: groupHeight, zIndex: -1 },
        zIndex: -1,
        data: {
          label: option.title,
        },
      };

      addNode(newGroupNode);
      finalGroupId = newId;
      // Entity table stays at its exact canvas coordinates which are now cleanly inside the group container
      nextEntityPos = { x: entityPos.x, y: entityPos.y };
    } else {
      const groupPos = targetGroupNode.position || { x: 100, y: 100 };
      const groupW =
        (typeof targetGroupNode.width === "number" && targetGroupNode.width > 0)
          ? targetGroupNode.width
          : 520;
      const groupH =
        (typeof targetGroupNode.height === "number" && targetGroupNode.height > 0)
          ? targetGroupNode.height
          : 380;

      const dimensions = getNodeDimensions(node);
      const measuredH = dimensions.height;
      const measuredW = dimensions.width;

      // Check if table is currently located within this group's bounding box
      const isAlreadyInside =
        node.position &&
        node.position.x >= groupPos.x &&
        node.position.x + 200 <= groupPos.x + groupW &&
        node.position.y >= groupPos.y &&
        node.position.y + 100 <= groupPos.y + groupH;

      if (!isAlreadyInside) {
        // Place table inside the target group container
        const otherMembers = allNodes.filter(
          (n) =>
            n.id !== nodeId &&
            (n.type === "entity" || n.type === "redis_schema") &&
            (n.data?.groupId === targetGroupNode.id || n.parentId === targetGroupNode.id),
        );

        let targetX = groupPos.x + 36;
        let targetY = groupPos.y + 130;

        if (otherMembers.length > 0) {
          const rightMost = otherMembers.reduce((max, cur) => {
            return (cur.position?.x || 0) > (max.position?.x || 0) ? cur : max;
          }, otherMembers[0]!);

          targetX = (rightMost.position?.x || targetX) + (rightMost.width || 320) + 36;
          targetY = rightMost.position?.y || targetY;
        }

        // Expand group container width and height if needed so table never overflows
        const neededWidth = targetX - groupPos.x + measuredW + 36;
        const neededHeight = targetY - groupPos.y + measuredH + 80;
        const nextW = Math.max(groupW, neededWidth);
        const nextH = Math.max(groupH, neededHeight);
        if (nextW > groupW || nextH > groupH) {
          updateNode(targetGroupNode.id, {
            width: nextW,
            height: nextH,
            style: { ...targetGroupNode.style, width: nextW, height: nextH },
          });
        }

        nextEntityPos = { x: targetX, y: targetY };
      }
    }

    // In SchemaView, nodes use pure absolute canvas coordinates and data.groupId for container association.
    // Clean up all legacy parentId fields so there is no stale reference to any other group.
    const nextData = {
      ...node.data,
      groupId: finalGroupId,
      group: option.title,
      parentId: undefined,
    };

    updateNode(nodeId, {
      parentId: undefined,
      position: nextEntityPos,
      data: nextData,
    });

    toast.success(
      `Assigned table "${node.data?.label || "Entity"}" to group "${option.title}"`,
    );
    setIsOpen(false);
  };

  const handleClearGroup = () => {
    const nextData = {
      ...node.data,
      parentId: undefined,
      groupId: undefined,
      group: undefined,
    };

    updateNode(nodeId, {
      parentId: undefined,
      data: nextData,
    });

    toast.success(
      `Removed table "${node.data?.label || "Entity"}" from group`,
    );
    setIsOpen(false);
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGroupName.trim();
    if (!clean) return;

    handleSelectGroup({
      title: clean,
    });
    setNewGroupName("");
  };

  const isAssigned = Boolean(
    selectedGroup || node.data?.groupId || node.data?.group,
  );
  const displayLabel =
    selectedGroup?.title || node.data?.group || "Select Group";

  const popoverContent = (
    <PopoverContent
      align="end"
      sideOffset={6}
      onClick={(e) => e.stopPropagation()}
      className="w-64 p-3 bg-popover/95 backdrop-blur-md border-border/80 shadow-2xl rounded-xl nodrag z-50 text-foreground"
    >
      <PopoverHeader className="pb-2 border-b border-border/40">
        <div className="flex items-center justify-between">
          <PopoverTitle className="text-xs font-bold flex items-center gap-1.5">
            <Boxes className="h-4 w-4 text-primary" />
            Select Group
          </PopoverTitle>
          {isAssigned && (
            <button
              onClick={handleClearGroup}
              type="button"
              className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-muted/50 cursor-pointer"
              title="Remove from group"
            >
              <X className="h-3 w-3" />
              Ungroup
            </button>
          )}
        </div>
      </PopoverHeader>

      <div className="py-2 space-y-2 max-h-[240px] overflow-y-auto">
        {canvasGroups.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic px-1 py-1">
            No groups created yet.
          </p>
        ) : (
          <div className="space-y-1">
            {canvasGroups.map((group) => {
              const isSelected = Boolean(
                selectedGroup && selectedGroup.id === group.id,
              );

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelectGroup(group)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer text-xs",
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/70 text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Boxes
                      size={13}
                      className={cn(
                        "shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{group.title}</span>
                    {typeof group.memberCount === "number" && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({group.memberCount})
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={14} className="text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Create New Group */}
        <div className="pt-2 border-t border-border/40">
          <form
            onSubmit={handleCreateCustom}
            className="flex items-center gap-1.5"
          >
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="New group name..."
              className="h-7 text-xs bg-muted/40 border-border/50 focus:bg-background"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newGroupName.trim()}
              className="h-7 px-2.5 text-xs font-medium gap-1 shrink-0 cursor-pointer"
            >
              <Plus size={12} />
              Add
            </Button>
          </form>
        </div>
      </div>
    </PopoverContent>
  );

  // Variant: Sidebar display in ConfigSidebar (EntityFunctionsConfig)
  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-secondary/15 p-3.5 mb-5 space-y-2.5",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Boxes className="h-4 w-4 text-sky-400" />
            <span>Group</span>
          </div>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={readOnly}
                onClick={(e) => e.stopPropagation()}
                className="h-7 text-xs gap-1.5 cursor-pointer bg-background/80 hover:bg-background font-medium"
              >
                <Boxes size={13} className="text-sky-400" />
                {isAssigned ? "Change Group" : "Select Group"}
                <ChevronDown size={12} className="text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            {popoverContent}
          </Popover>
        </div>

        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/60 border border-border/40">
          <div className="flex items-center gap-2 min-w-0">
            <Boxes
              size={14}
              className={cn(
                "shrink-0",
                isAssigned ? "text-sky-400" : "text-muted-foreground",
              )}
            />
            <span className="text-xs font-medium text-foreground truncate">
              {displayLabel}
            </span>
          </div>

          {isAssigned && !readOnly && (
            <button
              type="button"
              onClick={handleClearGroup}
              className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted transition-colors cursor-pointer shrink-0"
              title="Remove from group"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Variant: Compact Button for EntityNode card on canvas
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={readOnly}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            "h-5 px-1.5 py-0 text-[10px] font-semibold rounded flex items-center gap-1 transition-all cursor-pointer border max-w-[140px] truncate",
            isAssigned
              ? "bg-secondary/40 hover:bg-secondary/70 border-border/50 text-foreground"
              : "bg-background/60 hover:bg-background border-dashed border-border/70 text-muted-foreground hover:text-foreground",
            readOnly && "opacity-70 cursor-not-allowed",
            className,
          )}
          title={`Group: ${displayLabel}`}
        >
          <Boxes
            size={10}
            className={cn(
              "shrink-0",
              isAssigned ? "text-sky-400" : "text-muted-foreground",
            )}
          />
          <span className="truncate">{displayLabel}</span>
          <ChevronDown size={9} className="text-muted-foreground/70 shrink-0" />
        </button>
      </PopoverTrigger>
      {popoverContent}
    </Popover>
  );
};
