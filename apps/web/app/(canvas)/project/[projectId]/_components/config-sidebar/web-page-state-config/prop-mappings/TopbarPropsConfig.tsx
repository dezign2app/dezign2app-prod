"use client";

import React from "react";
import {
  PanelTop,
  Zap,
  Plus,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { SidebarStaticItem } from "@/types/canvas";
import { LocalInput } from "../../../backend-nodes/graph-nodes/shared";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { TopbarPropsConfigProps } from "./types";
import { SidebarStaticItemRow } from "./SidebarStaticItemRow";

export const TopbarPropsConfig: React.FC<TopbarPropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
  effectiveStoreName,
  effectiveStoreId,
  onCreateNavStateVariable,
}) => {
  const navMode = propMappings.topbarNavMode || "static";
  const staticItems = propMappings.topbarStaticItems ?? propMappings.sidebarStaticItems ?? [
    { id: "nav-1", name: "Home", link: "/" },
    { id: "nav-2", name: "Features", link: "/features" },
    { id: "nav-3", name: "Pricing", link: "/pricing" },
    { id: "nav-4", name: "About", link: "/about" },
  ];
  const isSticky = propMappings.topbarSticky ?? true;
  const showAuthButtons = propMappings.showAuthButtons ?? true;

  const handleAddStaticItem = () => {
    const nextId = `nav-${Date.now()}`;
    const newItem: SidebarStaticItem = {
      id: nextId,
      name: `Page ${staticItems.length + 1}`,
      link: `/page-${staticItems.length + 1}`,
    };
    onUpdatePropMapping({
      topbarStaticItems: [...staticItems, newItem],
    });
  };

  const handleUpdateStaticItem = (id: string, patch: Partial<SidebarStaticItem>) => {
    const updated = staticItems.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
    onUpdatePropMapping({ topbarStaticItems: updated });
  };

  const handleDeleteStaticItem = (id: string) => {
    const updated = staticItems.filter((item) => item.id !== id);
    onUpdatePropMapping({ topbarStaticItems: updated });
  };

  return (
    <div className="flex flex-col gap-3.5 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
      {/* Header pill / status indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40 text-[11px]">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <PanelTop size={13} className="text-primary" />
          <span>Top Bar Navigation Setup</span>
        </div>
        {navMode === "dynamic" && (propMappings.topbarNavStoreName || effectiveStoreName) ? (
          <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Store: {(propMappings.topbarNavStoreName || effectiveStoreName || "").endsWith("Store") ? (propMappings.topbarNavStoreName || effectiveStoreName) : `${propMappings.topbarNavStoreName || effectiveStoreName}Store`}
          </Badge>
        ) : navMode === "dynamic" ? (
          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-amber-500 border-amber-500/30">
            Store Unbound
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-emerald-500 border-emerald-500/30">
            Static Mode ({staticItems.length} links)
          </Badge>
        )}
      </div>

      {/* Topbar Title / Brand */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-foreground flex items-center justify-between">
          <span>Brand Logo / Header Title</span>
          <span className="text-[9px] text-muted-foreground font-mono">topbarTitle</span>
        </Label>
        <LocalInput
          value={propMappings.topbarTitle ?? "Dezign App"}
          onChange={(e) => onUpdatePropMapping({ topbarTitle: e.target.value })}
          placeholder="Dezign App"
          className="h-8 text-xs bg-background"
        />
      </div>

      {/* Sticky Header Toggle */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/40">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium text-foreground">Sticky Header</Label>
          <div className="text-[10px] text-muted-foreground">Keep topbar fixed at the top on scroll</div>
        </div>
        <Switch
          checked={isSticky}
          onCheckedChange={(checked) => onUpdatePropMapping({ topbarSticky: checked })}
        />
      </div>

      {/* Sign In & Register Auth Buttons Configuration */}
      <div className="space-y-2.5 p-3 rounded-xl bg-muted/30 border border-border/40">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Auth Action Buttons</span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0">Public</Badge>
            </Label>
            <div className="text-[10px] text-muted-foreground">Show Sign In and Register CTA buttons on top right</div>
          </div>
          <Switch
            checked={showAuthButtons}
            onCheckedChange={(checked) => onUpdatePropMapping({ showAuthButtons: checked })}
          />
        </div>

        {showAuthButtons && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-border/30">
            {/* Sign In button config */}
            <div className="space-y-1.5 p-2 rounded-lg bg-background/70 border border-border/40">
              <Label className="text-[10px] font-medium text-muted-foreground">Sign In Button</Label>
              <div className="space-y-1">
                <LocalInput
                  value={propMappings.signInText ?? "Sign In"}
                  onChange={(e) => onUpdatePropMapping({ signInText: e.target.value })}
                  placeholder="Sign In"
                  className="h-7 text-xs bg-background"
                />
                <LocalInput
                  value={propMappings.signInLink ?? "/login"}
                  onChange={(e) => onUpdatePropMapping({ signInLink: e.target.value })}
                  placeholder="/login"
                  className="h-7 text-[11px] font-mono bg-background text-muted-foreground"
                />
              </div>
            </div>

            {/* Register button config */}
            <div className="space-y-1.5 p-2 rounded-lg bg-background/70 border border-border/40">
              <Label className="text-[10px] font-medium text-muted-foreground">Register Button</Label>
              <div className="space-y-1">
                <LocalInput
                  value={propMappings.registerText ?? "Register"}
                  onChange={(e) => onUpdatePropMapping({ registerText: e.target.value })}
                  placeholder="Register"
                  className="h-7 text-xs bg-background"
                />
                <LocalInput
                  value={propMappings.registerLink ?? "/register"}
                  onChange={(e) => onUpdatePropMapping({ registerLink: e.target.value })}
                  placeholder="/register"
                  className="h-7 text-[11px] font-mono bg-background text-muted-foreground"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Mode Switcher: Dynamic vs Static */}
      <div className="space-y-2 pt-1 border-t border-border/40">
        <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
          <span>Navigation Items Source</span>
          <span className="text-[9px] text-muted-foreground font-mono">
            {navMode === "dynamic" ? "Dynamic (Zustand Store)" : "Static (Inline List)"}
          </span>
        </Label>
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/50 text-xs">
          <button
            type="button"
            onClick={() => onUpdatePropMapping({ topbarNavMode: "dynamic" })}
            className={`flex-1 py-1 px-2.5 rounded-md text-center text-xs font-medium transition-colors cursor-pointer ${
              navMode === "dynamic"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ⚡ Dynamic (State Store)
          </button>
          <button
            type="button"
            onClick={() => onUpdatePropMapping({ topbarNavMode: "static" })}
            className={`flex-1 py-1 px-2.5 rounded-md text-center text-xs font-medium transition-colors cursor-pointer ${
              navMode === "static"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Static Navigation
          </button>
        </div>
      </div>

      {/* Dynamic Navigation Mode */}
      {navMode === "dynamic" && (
        <div className="flex flex-col gap-3 pt-1">
          {/* 1-Click State Store Shortcut Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-sky-500/[0.08] border border-sky-500/25">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
                <Zap size={14} />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">
                  ⚡ Quick-Create "navItems" Variable
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Auto-provisions NavItem[] typed schema with sample routes in your State Store & TypesNode
                </div>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => onCreateNavStateVariable?.(propMappings.topbarNavStoreId || effectiveStoreId)}
              className="h-7 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shrink-0 ml-2 shadow-xs"
            >
              <Zap size={11} className="mr-1" />
              Create & Bind
            </Button>
          </div>

          {/* State Store Variable Picker */}
          <StateStoreVariablePicker
            label="Navigation Items State Variable"
            propName="navItems"
            valueBinding={propMappings.topbarNavBinding || propMappings.valueBinding || "navItems"}
            storeName={propMappings.topbarNavStoreName || effectiveStoreName}
            storeId={propMappings.topbarNavStoreId || effectiveStoreId}
            mode={propMappings.valueMode || "store_var"}
            stateStores={stateStores}
            expectedType="any"
            placeholder="navItems"
            description="StateStore variable containing navigation items (NavItem[])."
            onChange={(res) => {
              onUpdatePropMapping({
                topbarNavBinding: res.valueBinding,
                topbarNavStoreName: res.storeName,
                topbarNavStoreId: res.storeId,
                valueBinding: res.valueBinding,
                valueStoreName: res.storeName,
                valueStoreId: res.storeId,
                valueMode: res.mode,
              });
            }}
          />

          {/* Field contract hint */}
          <div className="p-2.5 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-1">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Expected Item Fields
            </div>
            <div className="font-mono text-[10px] text-muted-foreground space-y-0.5">
              <div>• <span className="text-foreground font-semibold">id</span>: string <span className="text-[9px] text-muted-foreground">(unique item key)</span></div>
              <div>• <span className="text-foreground font-semibold">name</span>: string <span className="text-[9px] text-muted-foreground">(menu label)</span></div>
              <div>• <span className="text-foreground font-semibold">link</span>: string <span className="text-[9px] text-muted-foreground">(route URL path)</span></div>
              <div>• <span className="text-foreground font-semibold">icon</span>?: string <span className="text-[9px] text-muted-foreground">(Lucide icon name)</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Static Navigation Mode */}
      {navMode === "static" && (
        <div className="flex flex-col gap-2.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground">Navigation Links ({staticItems.length})</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddStaticItem}
              className="h-6 text-[10px] gap-1 px-2 cursor-pointer"
            >
              <Plus size={10} />
              <span>Add Link</span>
            </Button>
          </div>

          <div className="space-y-2">
            {staticItems.map((item, idx) => (
              <SidebarStaticItemRow
                key={item.id || idx}
                item={item}
                idx={idx}
                stateStores={stateStores}
                onUpdate={(patch) => handleUpdateStaticItem(item.id, patch)}
                onDelete={() => handleDeleteStaticItem(item.id)}
              />
            ))}

            {staticItems.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No navigation links. Click "+ Add Link" to define your topbar menu.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
TopbarPropsConfig.displayName = "TopbarPropsConfig";
