import { Id } from "@workspace/backend/_generated/dataModel";
import { BackendCanvasView } from "@/types/canvas";

export interface AiPanelProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  setView?: (view: BackendCanvasView) => void;
}

export interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
}

export interface SerializedEndpoint {
  id?: string;
  type?: string;
  name?: string;
  databaseNodeIds?: string[];
  databaseNodeId?: string;
}

export interface SerializedNodeData {
  label?: string;
  endpoints?: SerializedEndpoint[];
  tableRef?: string;
}

export interface ProjectChat {
  _id: Id<"project_chats">;
  _creationTime: number;
  projectId: Id<"projects">;
  title: string;
  createdAt?: number;
}
