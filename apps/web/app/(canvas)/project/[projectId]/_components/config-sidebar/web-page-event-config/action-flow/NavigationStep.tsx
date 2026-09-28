import React from "react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { BackendNode } from "@workspace/canvas";
import type { FrontendActionStepDraft } from "./types";

export interface NavigationStepProps {
  draft: FrontendActionStepDraft;
  allNodes: BackendNode[];
  onChange: (updated: FrontendActionStepDraft) => void;
}

export const NavigationStep: React.FC<NavigationStepProps> = ({
  draft,
  allNodes,
  onChange,
}) => {
  const pageNodes = allNodes.filter(
    (n) => n.type === "webPage" || n.type === "page_ref",
  );

  const navType = draft.navType || "route";
  const targetRoute = draft.targetRoute || "/";
  const navCondition = draft.navCondition || "direct";

  return (
    <div className="space-y-3 pt-1 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Navigation Target
          </Label>
          <Select
            value={navType}
            onValueChange={(val: "route" | "page") =>
              onChange({ ...draft, navType: val })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="route">Route / URL Path</SelectItem>
              <SelectItem value="page">Canvas Web Page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Trigger Condition
          </Label>
          <Select
            value={navCondition}
            onValueChange={(val: "direct" | "on_success" | "on_error") =>
              onChange({ ...draft, navCondition: val })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Immediate</SelectItem>
              <SelectItem value="on_success">On Prior Success</SelectItem>
              <SelectItem value="on_error">On Prior Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {navType === "page" ? (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Target Page
          </Label>
          <Select
            value={draft.targetPageId || ""}
            onValueChange={(val) => {
              const targetNode = pageNodes.find((p) => p.id === val);
              const path = targetNode?.data?.path || "/";
              onChange({
                ...draft,
                targetPageId: val,
                targetRoute: path,
              });
            }}
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue placeholder="Choose page node" />
            </SelectTrigger>
            <SelectContent>
              {pageNodes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.data?.label || p.data?.path || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Route Path / Destination
          </Label>
          <Input
            value={targetRoute}
            onChange={(e) =>
              onChange({ ...draft, targetRoute: e.target.value })
            }
            placeholder="e.g. /dashboard, /gallery, /checkout"
            className="h-7 text-xs bg-background font-mono"
          />
        </div>
      )}
    </div>
  );
};
