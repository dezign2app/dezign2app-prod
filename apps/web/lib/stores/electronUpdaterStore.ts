import { create } from "zustand";
import { getElectronAPI, isElectron } from "@/lib/electron";
import type { ElectronUpdaterState } from "@/types/electron";

export interface ElectronUpdaterStore {
  status: ElectronUpdaterState["status"];
  version?: string;
  percent: number;
  error?: string;
  isMinimized: boolean;
  isDismissed: boolean;
  isChecking: boolean;
  isRestarting: boolean;

  // Actions
  init: () => () => void;
  checkForUpdates: () => Promise<void>;
  quitAndInstall: () => void;
  setMinimized: (minimized: boolean) => void;
  setDismissed: (dismissed: boolean) => void;
  simulateStatus: (mock: Partial<ElectronUpdaterState>) => void;
}

let activeSubscriptionCleanup: (() => void) | null = null;
let initialized = false;

export const useElectronUpdaterStore = create<ElectronUpdaterStore>((set, get) => ({
  status: "idle",
  version: undefined,
  percent: 0,
  error: undefined,
  isMinimized: false,
  isDismissed: false,
  isChecking: false,
  isRestarting: false,

  init: () => {
    if (!isElectron()) {
      return () => {};
    }

    const api = getElectronAPI();
    if (!api?.updater) {
      return () => {};
    }

    // If already subscribed, return existing cleanup
    if (initialized && activeSubscriptionCleanup) {
      return activeSubscriptionCleanup;
    }

    initialized = true;

    // Fetch initial status from Electron main process
    api.updater
      .getStatus()
      .then((currentState) => {
        if (currentState) {
          set({
            status: currentState.status || "idle",
            version: currentState.version,
            percent: currentState.percent ?? 0,
            error: currentState.error,
            // If already downloaded or downloading, un-dismiss so user sees it
            isDismissed: false,
          });
        }
      })
      .catch((err) => {
        console.warn("[electronUpdaterStore] Failed to fetch initial updater status:", err);
      });

    // Listen to real-time status broadcasts
    const unsubscribe = api.updater.onStatus((newState) => {
      set((prev) => ({
        status: newState.status,
        version: newState.version ?? prev.version,
        percent:
          newState.percent !== undefined
            ? newState.percent
            : newState.status === "downloaded"
              ? 100
              : prev.percent,
        error: newState.error,
        isChecking: newState.status === "checking",
        // Whenever a new update starts downloading or is downloaded, make sure it is visible
        isDismissed:
          newState.status === "downloading" || newState.status === "downloaded"
            ? false
            : prev.isDismissed,
      }));
    });

    activeSubscriptionCleanup = () => {
      unsubscribe();
      activeSubscriptionCleanup = null;
      initialized = false;
    };

    return activeSubscriptionCleanup;
  },

  checkForUpdates: async () => {
    const api = getElectronAPI();
    if (!api?.updater) return;

    set({ isChecking: true, isDismissed: false });
    try {
      const res = await api.updater.checkForUpdates();
      if (!res.success && res.message) {
        set({ error: res.message });
      }
    } catch (e: any) {
      set({ error: e?.message || "Check failed" });
    } finally {
      set({ isChecking: false });
    }
  },

  quitAndInstall: () => {
    const api = getElectronAPI();
    if (!api?.updater) return;

    set({ isRestarting: true });
    api.updater.quitAndInstall();
  },

  setMinimized: (minimized) => set({ isMinimized: minimized }),
  setDismissed: (dismissed) => set({ isDismissed: dismissed }),

  simulateStatus: (mock) => {
    const api = getElectronAPI();
    if (api?.updater?.simulateStatus) {
      api.updater.simulateStatus(mock);
    } else {
      set((prev) => ({
        status: mock.status || prev.status,
        version: mock.version ?? prev.version,
        percent: mock.percent ?? (mock.status === "downloaded" ? 100 : prev.percent),
        error: mock.error,
        isDismissed: false,
      }));
    }
  },
}));
