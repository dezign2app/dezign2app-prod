import type React from "react";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";

export interface StateTabContentProps {
  stateChannels: LangGraphStateChannel[];
  setStateChannels: React.Dispatch<
    React.SetStateAction<LangGraphStateChannel[]>
  >;
  customReducers?: LangGraphCustomReducer[];
  onAddCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onUpdateCustomReducer?: (
    idOrName: string,
    changes: Partial<LangGraphCustomReducer>,
  ) => void;
  onDeleteCustomReducer?: (idOrName: string) => void;
  onClose?: () => void;
  defaultTab?: "channels" | "testing";
  initialSelectedReducer?: string;
}
