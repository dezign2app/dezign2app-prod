"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@workspace/ui/components/popover";
import { Database, ChevronsUpDown, Check, Search, Plus } from "lucide-react";
import { BackendNode, PageStateObject } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";

export interface StateStoreComboboxProps {
  stores: BackendNode[];
  selectedStoreId: string;
  onSelectStore: (storeId: string) => void;
  onCreateStore?: () => void;
  configuredStoreStates?: PageStateObject[];
  pageConnectedStoreIds?: Set<string>;
  className?: string;
  placeholder?: string;
}

export const StateStoreCombobox: React.FC<StateStoreComboboxProps> = ({
  stores,
  selectedStoreId,
  onSelectStore,
  onCreateStore,
  configuredStoreStates,
  pageConnectedStoreIds,
  className,
  placeholder = "Select or search store...",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) || stores[0],
    [stores, selectedStoreId],
  );

  const filteredStores = useMemo(() => {
    if (!search.trim()) return stores;
    const q = search.toLowerCase().trim();
    return stores.filter((s) => {
      const name = (s.data?.label || s.data?.storeName || "").toLowerCase();
      const scope = (s.data?.scope || "").toLowerCase();
      const desc = (s.data?.description || "").toLowerCase();
      return name.includes(q) || scope.includes(q) || desc.includes(q);
    });
  }, [stores, search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const selectedName =
    selectedStore?.data?.label || selectedStore?.data?.storeName || "";

  const selectedActiveCount = useMemo(() => {
    if (!selectedStore || !configuredStoreStates) return 0;
    return configuredStoreStates.filter(
      (s) => s.storeId === selectedStore.id || s.storeNodeId === selectedStore.id,
    ).length;
  }, [selectedStore, configuredStoreStates]);

  const selectedFieldCount = selectedStore?.data?.fields?.length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-border/70 bg-background/80 hover:bg-muted/40 transition-colors cursor-pointer w-full text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50 shadow-2xs",
            className,
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Database size={13} className="text-cyan-500 shrink-0" />
            <span className="truncate text-foreground font-semibold">
              {selectedName || placeholder}
            </span>

            {selectedActiveCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shrink-0">
                {selectedActiveCount} active
              </span>
            ) : selectedFieldCount > 0 ? (
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                ({selectedFieldCount} fields)
              </span>
            ) : null}
          </div>

          <ChevronsUpDown size={12} className="text-muted-foreground shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[300px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2 p-2 border-b border-border/60 bg-muted/20">
          <Search size={13} className="text-muted-foreground shrink-0 ml-1" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stores by name..."
            className="h-7 text-xs bg-transparent border-none shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Scrollable Store List */}
        <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
          {filteredStores.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No matching state stores found.
            </div>
          ) : (
            filteredStores.map((store) => {
              const name =
                store.data?.label || store.data?.storeName || "Store";
              const isSelected = store.id === selectedStore?.id;
              const activeCount = configuredStoreStates
                ? configuredStoreStates.filter(
                    (s) => s.storeId === store.id || s.storeNodeId === store.id,
                  ).length
                : 0;
              const fieldCount = store.data?.fields?.length || 0;
              const isPageConnected = pageConnectedStoreIds?.has(store.id);

              return (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => {
                    onSelectStore(store.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer select-none",
                    isSelected
                      ? "bg-cyan-500/15 text-foreground font-semibold"
                      : "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Database
                      size={13}
                      className={isSelected ? "text-cyan-500 shrink-0" : "text-muted-foreground shrink-0"}
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-foreground truncate">
                          {name}
                        </span>
                        {isPageConnected && (
                          <span className="text-[8px] px-1 py-0.2 rounded font-mono font-semibold bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                            Page
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
                        {store.data?.storage || "memory"} • {fieldCount} {fieldCount === 1 ? "field" : "fields"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {activeCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-semibold bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                        {activeCount} active
                      </span>
                    )}
                    {isSelected && (
                      <Check size={14} className="text-cyan-500 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Create Store Footer Action */}
        {onCreateStore && (
          <div className="p-1 border-t border-border/60 bg-muted/10">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateStore();
              }}
              className="w-full flex items-center gap-1.5 p-1.5 rounded-lg text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Create New State Store</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
