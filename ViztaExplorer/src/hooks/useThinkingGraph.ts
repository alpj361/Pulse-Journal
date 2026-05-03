import { useState, useCallback, useMemo } from 'react';
import type { ViztaDebugResponse } from '../types/vizta';
import type {
  ThinkingGraphData,
  GraphViewMode,
  GraphNode,
  ExtractedEntity,
} from '../types/graph';
import {
  transformToFlowGraph,
  transformToKnowledgeGraph,
  transformToCombinedGraph,
  extractEntitiesFromResponse,
  findNodeByStepId,
} from '../utils/graphTransformers';

interface UseThinkingGraphReturn {
  graphData: ThinkingGraphData | null;
  viewMode: GraphViewMode;
  selectedNode: GraphNode | null;
  entities: ExtractedEntity[];
  selectNode: (node: GraphNode | null) => void;
  changeViewMode: (mode: GraphViewMode) => void;
  selectNodeByStepId: (stepId: string) => void;
  clearSelection: () => void;
}

export function useThinkingGraph(response: ViztaDebugResponse | null): UseThinkingGraphReturn {
  const [viewMode, setViewMode] = useState<GraphViewMode>('flow');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Extract entities from response
  const entities = useMemo(() => {
    if (!response) return [];
    return extractEntitiesFromResponse(response);
  }, [response]);

  // Transform response to graph data based on view mode
  const graphData = useMemo(() => {
    if (!response) return null;

    switch (viewMode) {
      case 'flow':
        return transformToFlowGraph(response);
      case 'knowledge':
        return transformToKnowledgeGraph(response, entities);
      case 'combined':
        return transformToCombinedGraph(response, entities);
      default:
        return transformToFlowGraph(response);
    }
  }, [response, viewMode, entities]);

  // Select a node
  const selectNode = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
  }, []);

  // Change view mode
  const changeViewMode = useCallback((mode: GraphViewMode) => {
    setViewMode(mode);
    setSelectedNode(null); // Clear selection when changing mode
  }, []);

  // Select node by step ID (for timeline synchronization)
  const selectNodeByStepId = useCallback((stepId: string) => {
    if (!graphData) return;
    const node = findNodeByStepId(graphData, stepId);
    if (node) {
      setSelectedNode(node);
    }
  }, [graphData]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return {
    graphData,
    viewMode,
    selectedNode,
    entities,
    selectNode,
    changeViewMode,
    selectNodeByStepId,
    clearSelection,
  };
}
