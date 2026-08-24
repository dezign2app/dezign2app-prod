import { ConnectionContext } from "../types";

/**
 * Handles column-to-column foreign key connections.
 * Determines PK vs FK column, marks the referencing column as `isForeignKey: true`,
 * and sets `references: { table: refTable, column: refColName }`.
 */
export function handleForeignKeyConnect({
  get,
  connection,
  sourceNode,
  targetNode,
  newEdge,
}: ConnectionContext): void {
  const isColumnToColumn = newEdge.type === "foreign-key";
  if (!isColumnToColumn) return;

  let sourceColIndex: number | undefined;
  let targetColIndex: number | undefined;

  if (connection.sourceHandle?.startsWith("source-")) {
    sourceColIndex = parseInt(
      connection.sourceHandle.replace("source-", ""),
      10,
    );
  } else if (connection.sourceHandle?.startsWith("target-")) {
    targetColIndex = parseInt(
      connection.sourceHandle.replace("target-", ""),
      10,
    );
  }

  if (connection.targetHandle?.startsWith("target-")) {
    targetColIndex = parseInt(
      connection.targetHandle.replace("target-", ""),
      10,
    );
  } else if (connection.targetHandle?.startsWith("source-")) {
    sourceColIndex = parseInt(
      connection.targetHandle.replace("source-", ""),
      10,
    );
  }

  if (
    sourceColIndex === undefined ||
    isNaN(sourceColIndex) ||
    targetColIndex === undefined ||
    isNaN(targetColIndex)
  ) {
    return;
  }

  const sourceCol = sourceNode.data.columns?.[sourceColIndex];
  const targetCol = targetNode.data.columns?.[targetColIndex];

  if (!sourceCol || !targetCol) return;

  const isSourcePK =
    sourceCol.isPrimaryKey ||
    sourceCol.isUnique ||
    sourceCol.name === "_id";
  const isTargetPK =
    targetCol.isPrimaryKey ||
    targetCol.isUnique ||
    targetCol.name === "_id";

  let fkNode = sourceNode;
  let fkCol = sourceCol;
  let fkColIndex = sourceColIndex;
  let refNode = targetNode;
  let refCol = targetCol;

  if (isSourcePK && !isTargetPK) {
    fkNode = targetNode;
    fkCol = targetCol;
    fkColIndex = targetColIndex;
    refNode = sourceNode;
    refCol = sourceCol;
  }

  const refTable = refNode.data.label || "";
  const refColName = refCol.name || "_id";

  if (fkNode.data.columns) {
    const newCols = [...fkNode.data.columns];
    newCols[fkColIndex] = {
      ...fkCol,
      isForeignKey: true,
      references: {
        table: refTable,
        column: refColName,
      },
    };
    get().updateNode(fkNode.id, {
      data: { ...fkNode.data, columns: newCols },
    });
  }
}
