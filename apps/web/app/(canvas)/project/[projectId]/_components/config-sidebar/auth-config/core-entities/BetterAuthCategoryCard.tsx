import React from "react";
import { Switch } from "@workspace/ui/components/switch";
import { BetterAuthCategoryCardProps } from "./types";

export const BetterAuthCategoryCard: React.FC<BetterAuthCategoryCardProps> = ({
  category,
  children,
}) => {
  const IconComponent = category.icon;
  const isCatDisabled = category.isToggleable && category.isEnabled === false;

  return (
    <div
      className={`flex flex-col gap-2.5 p-3 rounded-lg border transition-colors ${
        isCatDisabled
          ? "bg-background/30 border-border/30 opacity-70"
          : "bg-background/70 border-border/60"
      }`}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wide">
            {category.title}
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-semibold font-mono border ${category.badgeColor}`}
          >
            {category.badgeText}
          </span>
        </div>

        {category.isToggleable && category.onToggle && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">
              {category.isEnabled ? "Plugin Enabled" : "Disabled"}
            </span>
            <Switch
              checked={category.isEnabled ?? false}
              onCheckedChange={(checked: boolean) =>
                category.onToggle?.(checked)
              }
            />
          </div>
        )}
      </div>

      <p className="text-[10.5px] text-muted-foreground">
        {category.description}
      </p>

      {/* Table Rows for this Category */}
      {!isCatDisabled ? (
        <div className="flex flex-col gap-2 pt-1">{children}</div>
      ) : (
        <div className="p-2 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded bg-background/20 font-mono">
          Plugin disabled. Enable switch above to configure tables.
        </div>
      )}
    </div>
  );
};
