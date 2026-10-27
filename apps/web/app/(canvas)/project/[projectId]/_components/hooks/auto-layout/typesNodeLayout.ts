import type { LayoutNode, LayoutEdge } from "./types";
import { getNodeDimensions } from "./nodeDimensions";

export interface TypesNodeLayoutParams {
  typesNodes: LayoutNode[];
  transformerNodes?: LayoutNode[];
  positionsMap: Map<string, { x: number; y: number }>;
  edges?: LayoutEdge[];
  startMarginX?: number;
  startMarginY?: number;
  columnGap?: number;
  rowGap?: number;
  mainGraphSeparation?: number;
}

/**
 * Positions TypesNode (entity types, service endpoint contracts, package types, extended types)
 * and Transformer definition nodes in a dedicated "away" area along the left canvas margin:
 *
 *  - Column 1: Entity Types (database entity schemas)
 *  - Column 2: Service Types (service endpoint request/response contracts)
 *  - Column 3: Package / Standalone Custom Types
 *  - Next Column: Extended Types aligned with their parent base types
 *  - Column next to Types: Transformer definition nodes floating beside the types nodes
 *  - Main architecture graph is shifted right so it cleanly begins after the Types & Transformer section.
 */
export function layoutTypesNodes({
  typesNodes,
  transformerNodes = [],
  positionsMap,
  edges = [],
  startMarginX = 60,
  startMarginY = 60,
  columnGap = 80,
  rowGap = 32,
  mainGraphSeparation = 200,
}: TypesNodeLayoutParams): void {
  if (typesNodes.length === 0 && transformerNodes.length === 0) return;

  const typesNodeIds = new Set<string>(typesNodes.map((n) => n.id));

  let typesRight = startMarginX;

  if (typesNodes.length > 0) {
    // 1. Identify extended types nodes vs base types categories
    const isExtendedNode = (node: LayoutNode): boolean => {
      const data = node.data;
      if (
        Boolean(data?.isExtended) ||
        Boolean(data?.extendedFromNodeId && typesNodeIds.has(data.extendedFromNodeId))
      ) {
        return true;
      }
      return edges.some(
        (e) => e.target === node.id && typesNodeIds.has(e.source),
      );
    };

    const getParentBaseId = (node: LayoutNode): string | undefined => {
      const data = node.data;
      if (data?.extendedFromNodeId && typesNodeIds.has(data.extendedFromNodeId)) {
        return data.extendedFromNodeId;
      }
      const incomingEdge = edges.find(
        (e) => e.target === node.id && typesNodeIds.has(e.source),
      );
      return incomingEdge?.source;
    };

    const isEntityTypesNode = (node: LayoutNode): boolean => {
      const data = node.data;
      return (
        node.id === "types-entity-schemas" ||
        Boolean(data?.isEntitySchemas) ||
        Boolean(data?.sourceEntityId) ||
        data?.label === "Entity Types" ||
        Boolean(data?.types?.some((t) => t.id.startsWith("type-entity-")))
      );
    };

    const isServiceTypesNode = (node: LayoutNode): boolean => {
      const data = node.data;
      return (
        Boolean(data?.isServiceEndpointSchemas) ||
        node.id.startsWith("types-service-") ||
        Boolean(data?.sourceServiceId) ||
        Boolean(data?.types?.some((t) => t.id.startsWith("type-endpoint-")))
      );
    };

    const extendedNodes: LayoutNode[] = [];
    const entityTypesNodes: LayoutNode[] = [];
    const serviceTypesNodes: LayoutNode[] = [];
    const packageOrOtherNodes: LayoutNode[] = [];

    typesNodes.forEach((node) => {
      if (isExtendedNode(node)) {
        extendedNodes.push(node);
      } else if (isEntityTypesNode(node)) {
        entityTypesNodes.push(node);
      } else if (isServiceTypesNode(node)) {
        serviceTypesNodes.push(node);
      } else {
        packageOrOtherNodes.push(node);
      }
    });

    // Fallback: If all are categorized as extended without any base, treat all as base
    if (
      entityTypesNodes.length === 0 &&
      serviceTypesNodes.length === 0 &&
      packageOrOtherNodes.length === 0 &&
      extendedNodes.length > 0
    ) {
      packageOrOtherNodes.push(...extendedNodes.splice(0, extendedNodes.length));
    }

    interface TypesColumnGroup {
      category: "entity" | "service" | "package";
      nodes: LayoutNode[];
    }

    const columnGroups: TypesColumnGroup[] = [];
    if (entityTypesNodes.length > 0) {
      columnGroups.push({ category: "entity", nodes: entityTypesNodes });
    }
    if (serviceTypesNodes.length > 0) {
      columnGroups.push({ category: "service", nodes: serviceTypesNodes });
    }
    if (packageOrOtherNodes.length > 0) {
      columnGroups.push({ category: "package", nodes: packageOrOtherNodes });
    }

    // 2. Layout Base Types Columns (Entity Types in one column, Service Types in one column, Package/Other in another)
    let curColX = startMarginX;
    const allBaseNodes: LayoutNode[] = [];

    columnGroups.forEach((group) => {
      let curColY = startMarginY;
      let colWidth = 270;

      group.nodes.forEach((node) => {
        allBaseNodes.push(node);
        const dims = getNodeDimensions(node);
        if (dims.width > colWidth) {
          colWidth = dims.width;
        }
        positionsMap.set(node.id, {
          x: curColX,
          y: curColY,
        });
        curColY += dims.height + rowGap;
      });

      curColX += colWidth + columnGap;
    });

    typesRight = curColX > startMarginX ? curColX - columnGap : startMarginX;

    // 3. Layout Column for Extended Types (placed to the right of base types columns)
    if (extendedNodes.length > 0) {
      const extColX = curColX;
      let extColWidth = 270;
      let curExtY = startMarginY;

      // Place extended nodes grouped next to their parent base node
      const placedExtIds = new Set<string>();

      allBaseNodes.forEach((baseNode) => {
        const children = extendedNodes.filter(
          (ext) => getParentBaseId(ext) === baseNode.id,
        );
        if (children.length > 0) {
          const parentPos = positionsMap.get(baseNode.id) ?? {
            x: startMarginX,
            y: startMarginY,
          };
          let extY = Math.max(curExtY, parentPos.y);

          children.forEach((child) => {
            const dims = getNodeDimensions(child);
            if (dims.width > extColWidth) {
              extColWidth = dims.width;
            }
            positionsMap.set(child.id, {
              x: extColX,
              y: extY,
            });
            placedExtIds.add(child.id);
            extY += dims.height + rowGap;
          });

          curExtY = extY;
        }
      });

      // Place any remaining extended nodes whose parent was not found
      extendedNodes.forEach((node) => {
        if (!placedExtIds.has(node.id)) {
          const dims = getNodeDimensions(node);
          if (dims.width > extColWidth) {
            extColWidth = dims.width;
          }
          positionsMap.set(node.id, {
            x: extColX,
            y: curExtY,
          });
          curExtY += dims.height + rowGap;
        }
      });

      typesRight = extColX + extColWidth;
    }
  }

  // 3.5. Layout Transformer definition nodes floating in the column next to Types nodes
  let sectionRight = typesRight;

  if (transformerNodes.length > 0) {
    const transColX =
      typesNodes.length > 0 ? typesRight + columnGap : startMarginX;
    let transColWidth = 260;
    let curTransY = startMarginY;

    transformerNodes.forEach((node) => {
      const dims = getNodeDimensions(node);
      if (dims.width > transColWidth) {
        transColWidth = dims.width;
      }
      positionsMap.set(node.id, {
        x: transColX,
        y: curTransY,
      });
      curTransY += dims.height + rowGap;
    });

    sectionRight = transColX + transColWidth;
  }

  // 4. Shift main architecture graph nodes rightwards so they begin safely after Types & Transformer section
  const excludedIds = new Set<string>([
    ...typesNodeIds,
    ...transformerNodes.map((n) => n.id),
  ]);

  let minMainX = Infinity;
  positionsMap.forEach((pos, id) => {
    if (!excludedIds.has(id)) {
      if (pos.x < minMainX) {
        minMainX = pos.x;
      }
    }
  });

  if (minMainX !== Infinity) {
    const targetMainX = sectionRight + mainGraphSeparation;
    if (minMainX < targetMainX) {
      const shiftX = targetMainX - minMainX;
      positionsMap.forEach((pos, id) => {
        if (!excludedIds.has(id)) {
          positionsMap.set(id, {
            x: pos.x + shiftX,
            y: pos.y,
          });
        }
      });
    }
  }
}
