import { Editor, getSnapshot, TLShapeId, TLShapePartial, TLShape, createShapeId } from "tldraw";
import {
  CanvasAdapter,
  CanvasOperation,
  FrontendDesignDoc,
} from "@/types/canvas";

export class FrontendCanvasAdapter implements CanvasAdapter<FrontendDesignDoc> {
  private editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
  }

  getState(): FrontendDesignDoc {
    return {
      snapshot: getSnapshot(this.editor.store),
    };
  }

  applyOperations(ops: CanvasOperation[]): void {
    const shapesToAdd: TLShapePartial[] = [];
    const shapesToUpdate: TLShapePartial[] = [];
    const shapesToDelete: TLShapeId[] = [];

    for (const op of ops) {
      if (op.op === "add_shape") {
        shapesToAdd.push({
          id: createShapeId(),
          type: (op.type as TLShapePartial["type"]) || "geo",
          x: op.x,
          y: op.y,
          props: op.props,
        });
      } else if (op.op === "update_shape") {
        const existingShape = this.editor.getShape(op.id as TLShapeId);
        shapesToUpdate.push({
          id: op.id as TLShapeId,
          type: (existingShape?.type || "geo") as TLShapePartial["type"],
          props: op.props,
        });
      } else if (op.op === "delete_shape") {
        shapesToDelete.push(op.id as TLShapeId);
      }
    }

    if (shapesToAdd.length > 0) {
      this.editor.createShapes(shapesToAdd);
    }
    if (shapesToUpdate.length > 0) {
      this.editor.updateShapes(shapesToUpdate);
    }
    if (shapesToDelete.length > 0) {
      this.editor.deleteShapes(shapesToDelete);
    }
  }

  serialize(): string {
    // Serialize current shapes to a concise format for AI context
    const shapes = Array.from(this.editor.store.allRecords()).filter(
      (r): r is TLShape => r.typeName === "shape",
    );

    if (shapes.length === 0) return "Canvas is empty.";

    const summary = shapes.map((s) => {
      let text = "";
      const sProps = s.props as { text?: string } | undefined;
      if (sProps?.text) text = ` text: "${sProps.text}"`;
      return `- [${s.type}] id: ${s.id}, x: ${Math.round(s.x)}, y: ${Math.round(
        s.y,
      )}${text}`;
    });

    return `Frontend Canvas Shapes:\n${summary.join("\n")}`;
  }
}
