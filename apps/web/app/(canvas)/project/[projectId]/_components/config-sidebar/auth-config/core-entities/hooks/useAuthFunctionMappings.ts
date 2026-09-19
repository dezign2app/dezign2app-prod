import {
  AuthFunctionRef,
  DbOperationFunction,
} from "@workspace/canvas";
import { BackendNode, BackendNodeData } from "@/types/canvas";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";

interface UseAuthFunctionMappingsParams {
  authFunctions: AuthFunctionRef[];
  updateData: (changes: Partial<BackendNodeData>) => void;
  schemaEntities: BackendNode[];
  allNodes: BackendNode[];
}

export function useAuthFunctionMappings({
  authFunctions,
  updateData,
  schemaEntities,
  allNodes,
}: UseAuthFunctionMappingsParams) {
  const getEntityDbOps = (entityNodeId?: string): DbOperationFunction[] => {
    if (!entityNodeId) return [];
    const entity = schemaEntities.find((e) => e.id === entityNodeId);
    if (!entity) return [];
    return getEntityDbOperations(entity, allNodes).filter(
      (op) => op.enabled !== false,
    );
  };

  const addFunctionMapping = () => {
    const firstEntity = schemaEntities[0];
    const ops = getEntityDbOps(firstEntity?.id);
    const newRef: AuthFunctionRef = {
      id: `af-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      variableName: "",
      entityNodeId: firstEntity?.id || "",
      functionId: ops[0]?.id || "",
    };
    updateData({ authFunctions: [...authFunctions, newRef] });
  };

  const updateMapping = (
    index: number,
    changes: Partial<AuthFunctionRef>,
  ) => {
    const updated = authFunctions.map((fn, idx) => {
      if (idx !== index) return fn;
      const nextFn = { ...fn, ...changes };
      if (changes.entityNodeId && changes.entityNodeId !== fn.entityNodeId) {
        const ops = getEntityDbOps(changes.entityNodeId);
        nextFn.functionId = ops[0]?.id || "";
      }
      return nextFn;
    });
    updateData({ authFunctions: updated });
  };

  const removeMapping = (index: number) => {
    const updated = authFunctions.filter((_, idx) => idx !== index);
    updateData({ authFunctions: updated });
  };

  return {
    getEntityDbOps,
    addFunctionMapping,
    updateMapping,
    removeMapping,
  };
}
