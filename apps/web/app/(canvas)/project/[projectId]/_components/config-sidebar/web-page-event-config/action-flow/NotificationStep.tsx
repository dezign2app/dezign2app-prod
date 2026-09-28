import React from "react";
import { Bell } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { FrontendActionStepDraft } from "./types";

export interface NotificationStepProps {
  draft: FrontendActionStepDraft;
  onChange: (updated: FrontendActionStepDraft) => void;
}

export const NotificationStep: React.FC<NotificationStepProps> = ({
  draft,
  onChange,
}) => {
  const notifyType = draft.notifyType || "toast";
  const notifyLevel = draft.notifyLevel || "success";
  const notifyMessage = draft.notifyMessage || "";

  return (
    <div className="space-y-3 pt-1 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Notification Kind
          </Label>
          <Select
            value={notifyType}
            onValueChange={(val: "toast" | "alert") =>
              onChange({ ...draft, notifyType: val })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toast">Toast Notification</SelectItem>
              <SelectItem value="alert">Modal Alert Dialog</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Feedback Level
          </Label>
          <Select
            value={notifyLevel}
            onValueChange={(val: "success" | "error" | "info" | "warning") =>
              onChange({ ...draft, notifyLevel: val })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">
          Message Text
        </Label>
        <Input
          value={notifyMessage}
          onChange={(e) => onChange({ ...draft, notifyMessage: e.target.value })}
          placeholder="e.g. Upload completed successfully!"
          className="h-7 text-xs bg-background"
        />
      </div>
    </div>
  );
};
