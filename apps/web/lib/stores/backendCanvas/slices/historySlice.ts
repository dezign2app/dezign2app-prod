import { BackendCanvasState } from "../types";
import { BackendCanvasView } from "@/types/canvas";
import { GraphSnapshot, SchemaSnapshot } from "../history/types";
import {
  captureSchemaSnapshot,
  applySchemaSnapshot,
} from "../history/schemaHistory";
import {
  captureGraphSnapshot,
  applyGraphSnapshot,
} from "../history/graphHistory";

export interface HistorySlice {
  graphUndoStack: GraphSnapshot[];
  graphRedoStack: GraphSnapshot[];
  schemaUndoStack: SchemaSnapshot[];
  schemaRedoStack: SchemaSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  pushGraphHistorySnapshot: () => void;
  pushSchemaHistorySnapshot: () => void;
  pushHistorySnapshot: (view?: BackendCanvasView) => void;
  undoGraph: () => void;
  undoSchema: () => void;
  undo: () => void;
  redoGraph: () => void;
  redoSchema: () => void;
  redo: () => void;
  clearHistory: () => void;
}

const MAX_HISTORY_LIMIT = 50;

export const createHistorySlice = (
  set: (
    partial:
      | Partial<BackendCanvasState>
      | ((state: BackendCanvasState) => Partial<BackendCanvasState>),
  ) => void,
  get: () => BackendCanvasState,
): HistorySlice => ({
  graphUndoStack: [],
  graphRedoStack: [],
  schemaUndoStack: [],
  schemaRedoStack: [],
  canUndo: false,
  canRedo: false,

  pushGraphHistorySnapshot: () => {
    const currentState = get();
    const snapshot = captureGraphSnapshot(currentState);
    const updatedGraphUndoStack = [
      ...currentState.graphUndoStack,
      snapshot,
    ].slice(-MAX_HISTORY_LIMIT);

    const isCurrent = (currentState.canvasView || "graph") === "graph";

    set({
      graphUndoStack: updatedGraphUndoStack,
      graphRedoStack: [],
      ...(isCurrent && {
        canUndo: updatedGraphUndoStack.length > 0,
        canRedo: false,
      }),
    });
  },

  pushSchemaHistorySnapshot: () => {
    const currentState = get();
    const snapshot = captureSchemaSnapshot(currentState);
    const updatedSchemaUndoStack = [
      ...currentState.schemaUndoStack,
      snapshot,
    ].slice(-MAX_HISTORY_LIMIT);

    const isCurrent = currentState.canvasView === "schema";

    set({
      schemaUndoStack: updatedSchemaUndoStack,
      schemaRedoStack: [],
      ...(isCurrent && {
        canUndo: updatedSchemaUndoStack.length > 0,
        canRedo: false,
      }),
    });
  },

  pushHistorySnapshot: (viewOverride?: BackendCanvasView) => {
    const activeView = viewOverride || get().canvasView || "graph";
    if (activeView === "schema") {
      get().pushSchemaHistorySnapshot();
    } else {
      get().pushGraphHistorySnapshot();
    }
  },

  undoSchema: () => {
    const currentState = get();
    if (currentState.schemaUndoStack.length === 0) return;

    const currentSnapshot = captureSchemaSnapshot(currentState);
    const newSchemaUndoStack = [...currentState.schemaUndoStack];
    const previousSnapshot = newSchemaUndoStack.pop();

    if (!previousSnapshot) return;

    const newSchemaRedoStack = [
      ...currentState.schemaRedoStack,
      currentSnapshot,
    ].slice(-MAX_HISTORY_LIMIT);

    const diffUpdates = applySchemaSnapshot(previousSnapshot, currentState);
    const isCurrent = currentState.canvasView === "schema";

    set({
      ...diffUpdates,
      schemaUndoStack: newSchemaUndoStack,
      schemaRedoStack: newSchemaRedoStack,
      ...(isCurrent && {
        canUndo: newSchemaUndoStack.length > 0,
        canRedo: newSchemaRedoStack.length > 0,
      }),
    });
  },

  undoGraph: () => {
    const currentState = get();
    if (currentState.graphUndoStack.length === 0) return;

    const currentSnapshot = captureGraphSnapshot(currentState);
    const newGraphUndoStack = [...currentState.graphUndoStack];
    const previousSnapshot = newGraphUndoStack.pop();

    if (!previousSnapshot) return;

    const newGraphRedoStack = [
      ...currentState.graphRedoStack,
      currentSnapshot,
    ].slice(-MAX_HISTORY_LIMIT);

    const diffUpdates = applyGraphSnapshot(previousSnapshot, currentState);
    const isCurrent = (currentState.canvasView || "graph") === "graph";

    set({
      ...diffUpdates,
      graphUndoStack: newGraphUndoStack,
      graphRedoStack: newGraphRedoStack,
      ...(isCurrent && {
        canUndo: newGraphUndoStack.length > 0,
        canRedo: newGraphRedoStack.length > 0,
      }),
    });
  },

  undo: () => {
    const activeView = get().canvasView || "graph";
    if (activeView === "schema") {
      get().undoSchema();
    } else {
      get().undoGraph();
    }
  },

  redoSchema: () => {
    const currentState = get();
    if (currentState.schemaRedoStack.length === 0) return;

    const currentSnapshot = captureSchemaSnapshot(currentState);
    const newSchemaRedoStack = [...currentState.schemaRedoStack];
    const nextSnapshot = newSchemaRedoStack.pop();

    if (!nextSnapshot) return;

    const newSchemaUndoStack = [
      ...currentState.schemaUndoStack,
      currentSnapshot,
    ].slice(-MAX_HISTORY_LIMIT);

    const diffUpdates = applySchemaSnapshot(nextSnapshot, currentState);
    const isCurrent = currentState.canvasView === "schema";

    set({
      ...diffUpdates,
      schemaUndoStack: newSchemaUndoStack,
      schemaRedoStack: newSchemaRedoStack,
      ...(isCurrent && {
        canUndo: newSchemaUndoStack.length > 0,
        canRedo: newSchemaRedoStack.length > 0,
      }),
    });
  },

  redoGraph: () => {
    const currentState = get();
    if (currentState.graphRedoStack.length === 0) return;

    const currentSnapshot = captureGraphSnapshot(currentState);
    const newGraphRedoStack = [...currentState.graphRedoStack];
    const nextSnapshot = newGraphRedoStack.pop();

    if (!nextSnapshot) return;

    const newGraphUndoStack = [
      ...currentState.graphUndoStack,
      currentSnapshot,
    ].slice(-MAX_HISTORY_LIMIT);

    const diffUpdates = applyGraphSnapshot(nextSnapshot, currentState);
    const isCurrent = (currentState.canvasView || "graph") === "graph";

    set({
      ...diffUpdates,
      graphUndoStack: newGraphUndoStack,
      graphRedoStack: newGraphRedoStack,
      ...(isCurrent && {
        canUndo: newGraphUndoStack.length > 0,
        canRedo: newGraphRedoStack.length > 0,
      }),
    });
  },

  redo: () => {
    const activeView = get().canvasView || "graph";
    if (activeView === "schema") {
      get().redoSchema();
    } else {
      get().redoGraph();
    }
  },

  clearHistory: () => {
    set({
      graphUndoStack: [],
      graphRedoStack: [],
      schemaUndoStack: [],
      schemaRedoStack: [],
      canUndo: false,
      canRedo: false,
    });
  },
});


