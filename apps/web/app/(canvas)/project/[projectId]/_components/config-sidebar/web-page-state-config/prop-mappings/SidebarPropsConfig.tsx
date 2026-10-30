"use client";

import React from "react";
import {
  PanelLeft,
  PanelRight,
  SlidersHorizontal,
  Zap,
  Plus,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { LocalInput } from "../../../backend-nodes/graph-nodes/shared";
import { StateStoreVariablePicker } from "../StateStoreVariablePicker";
import { isSidebarCollapsible, isSidebarVariant, isSidebarSide } from "../constants";
import { SidebarPropsConfigProps } from "./types";
import { SidebarStaticItemRow } from "./SidebarStaticItemRow";

export const SidebarPropsConfig: React.FC<SidebarPropsConfigProps> = React.memo(({
  propMappings,
  onUpdatePropMapping,
  stateStores,
  effectiveStoreName,
  effectiveStoreId,
  onCreateNavStateVariable,
}) => {
  const navMode = propMappings.sidebarNavMode || "dynamic";
  const staticItems = propMappings.sidebarStaticItems ?? [
    { id: "nav-1", name: "Dashboard", link: "/dashboard", icon: "LayoutDashboard" },
    { id: "nav-2", name: "Analytics", link: "/analytics", icon: "BarChart3" },
    { id: "nav-3", name: "Projects", link: "/projects", icon: "Folder" },
    { id: "nav-4", name: "Settings", link: "/settings", icon: "Settings" },
  ];

  const handleAddStaticItem = () => {
    const nextId = `nav-${Date.now()}`;
    const newItem = {
      id: nextId,
      name: `Page ${staticItems.length + 1}`,
      link: `/page-${staticItems.length + 1}`,
      icon: "Circle",
    };
    onUpdatePropMapping({
      sidebarStaticItems: [...staticItems, newItem],
    });
  };

  const handleUpdateStaticItem = (id: string, patch: Partial<typeof staticItems[0]>) => {
    const updated = staticItems.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
    onUpdatePropMapping({ sidebarStaticItems: updated });
  };

  const handleDeleteStaticItem = (id: string) => {
    const updated = staticItems.filter((item) => item.id !== id);
    onUpdatePropMapping({ sidebarStaticItems: updated });
  };

  return (
    <div className="flex flex-col gap-3.5 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
      {/* Header pill / store indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40 text-[11px]">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <PanelLeft size={13} className="text-primary" />
          <span>Sidebar Navigation Setup</span>
        </div>
        {navMode === "dynamic" && effectiveStoreName ? (
          <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Store: {effectiveStoreName.endsWith("Store") ? effectiveStoreName : `${effectiveStoreName}Store`}
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

      {/* Sidebar Title / Header Brand */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-foreground flex items-center justify-between">
          <span>Sidebar Title / Header</span>
          <span className="text-[9px] text-muted-foreground font-mono">title</span>
        </Label>
        <LocalInput
          value={propMappings.sidebarTitle ?? "Dezign App"}
          onChange={(e) => onUpdatePropMapping({ sidebarTitle: e.target.value })}
          placeholder="Dezign App"
          className="h-8 text-xs bg-background"
        />
      </div>

      {/* Layout & Behavior Selectors (Side, Variant, Collapsible) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-medium text-foreground flex items-center gap-1.5">
            <SlidersHorizontal size={11} className="text-primary" />
            <span>Layout & Shadcn Variants</span>
          </Label>
          <code className="text-[9px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
            {`<Sidebar side="${propMappings.sidebarSide || "left"}" variant="${propMappings.sidebarVariant || "sidebar"}" collapsible="${propMappings.sidebarCollapsible || "offcanvas"}" />`}
          </code>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* 1. Placement / Side */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Position / Side</span>
              <span className="font-mono text-[9px] text-cyan-500">side</span>
            </Label>
            <Select
              value={propMappings.sidebarSide || "left"}
              onValueChange={(val) => {
                if (isSidebarSide(val)) {
                  onUpdatePropMapping({ sidebarSide: val });
                }
              }}
            >
              <SelectTrigger className="h-7 text-[11px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left" className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <PanelLeft size={12} className="text-muted-foreground" />
                    <span>Left (Default)</span>
                  </div>
                </SelectItem>
                <SelectItem value="right" className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <PanelRight size={12} className="text-muted-foreground" />
                    <span>Right (Docked)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 2. Visual Variant */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Visual Variant</span>
              <span className="font-mono text-[9px] text-cyan-500">variant</span>
            </Label>
            <Select
              value={propMappings.sidebarVariant || "sidebar"}
              onValueChange={(val) => {
                if (isSidebarVariant(val)) {
                  onUpdatePropMapping({ sidebarVariant: val });
                }
              }}
            >
              <SelectTrigger className="h-7 text-[11px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sidebar" className="text-xs">Standard (sidebar)</SelectItem>
                <SelectItem value="floating" className="text-xs">Floating Card (floating)</SelectItem>
                <SelectItem value="inset" className="text-xs">Inset Panel (inset)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 3. Collapsible Mode */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Collapsible Mode</span>
              <span className="font-mono text-[9px] text-cyan-500">collapsible</span>
            </Label>
            <Select
              value={propMappings.sidebarCollapsible || "offcanvas"}
              onValueChange={(val) => {
                if (isSidebarCollapsible(val)) {
                  onUpdatePropMapping({ sidebarCollapsible: val });
                }
              }}
            >
              <SelectTrigger className="h-7 text-[11px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offcanvas" className="text-xs">Offcanvas (Drawer)</SelectItem>
                <SelectItem value="icon" className="text-xs">Icon Rail (Rail)</SelectItem>
                <SelectItem value="none" className="text-xs">None (Fixed)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
            onClick={() => onUpdatePropMapping({ sidebarNavMode: "dynamic" })}
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
            onClick={() => onUpdatePropMapping({ sidebarNavMode: "static" })}
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
              onClick={() => onCreateNavStateVariable?.(effectiveStoreId)}
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
            valueBinding={propMappings.sidebarNavBinding || propMappings.valueBinding || "navItems"}
            storeName={propMappings.sidebarNavStoreName || effectiveStoreName}
            storeId={propMappings.sidebarNavStoreId || effectiveStoreId}
            mode={propMappings.valueMode || "store_var"}
            stateStores={stateStores}
            expectedType="any"
            placeholder="navItems"
            description="StateStore variable containing navigation items (NavItem[])."
            onChange={(res) => {
              onUpdatePropMapping({
                sidebarNavBinding: res.valueBinding,
                sidebarNavStoreName: res.storeName,
                sidebarNavStoreId: res.storeId,
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
            <span className="text-[11px] font-medium text-foreground">Navigation Items ({staticItems.length})</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddStaticItem}
              className="h-6 text-[10px] gap-1 px-2 cursor-pointer"
            >
              <Plus size={10} />
              <span>Add Item</span>
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
                No navigation items. Click "+ Add Item" to define your menu.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
SidebarPropsConfig.displayName = "SidebarPropsConfig";
