import { create } from "zustand";
import { DeletedNodeInfo } from "../compiler/nodeDeletionDiff";

export interface NodeDeletionEvent {
  id: string;
  timestamp: number;
  deletedNodes: DeletedNodeInfo[];
  deletedFiles: string[];
  modifiedFiles: string[];
  addedFiles: string[];
  outputDir: string | null;
  syncedToDisk: boolean;
  syncedFileCount?: number;
}

export interface AffectedFilesState {
  activeEvent: NodeDeletionEvent | null;
  isDetailsOpen: boolean;
  history: NodeDeletionEvent[];

  showDeletionEvent: (event: NodeDeletionEvent) => void;
  dismissBanner: () => void;
  toggleDetails: () => void;
  setDetailsOpen: (open: boolean) => void;
  markDiskSynced: (eventId: string, synced: boolean, count?: number) => void;
  clearHistory: () => void;
}

export const useAffectedFilesStore = create<AffectedFilesState>((set) => ({
  activeEvent: null,
  isDetailsOpen: false,
  history: [],

  showDeletionEvent: (event) =>
    set((state) => ({
      activeEvent: event,
      // Default to false so banner stays compact, user can expand if desired
      isDetailsOpen: false,
      history: [event, ...state.history.slice(0, 19)], // Keep up to 20 recent events
    })),

  dismissBanner: () =>
    set({
      activeEvent: null,
      isDetailsOpen: false,
    }),

  toggleDetails: () =>
    set((state) => ({
      isDetailsOpen: !state.isDetailsOpen,
    })),

  setDetailsOpen: (open) =>
    set({
      isDetailsOpen: open,
    }),

  markDiskSynced: (eventId, synced, count) =>
    set((state) => {
      const active = state.activeEvent;
      if (active && active.id === eventId) {
        return {
          activeEvent: {
            ...active,
            syncedToDisk: synced,
            syncedFileCount: count ?? active.syncedFileCount,
          },
          history: state.history.map((h) =>
            h.id === eventId
              ? {
                  ...h,
                  syncedToDisk: synced,
                  syncedFileCount: count ?? h.syncedFileCount,
                }
              : h,
          ),
        };
      }
      return state;
    }),

  clearHistory: () =>
    set({
      history: [],
    }),
}));
