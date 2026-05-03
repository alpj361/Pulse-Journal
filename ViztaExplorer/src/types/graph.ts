// Graph node types
export type GraphNodeType = 'query' | 'intent' | 'tool' | 'entity' | 'concept' | 'source' | 'synthesis' | 'planning' | 'memory';

// Graph edge/connection types
export type GraphEdgeType = 'flow' | 'relates_to' | 'mentions' | 'derived_from' | 'produces' | 'uses';

// Entity types that can be extracted from responses
export type EntityType = 'person' | 'organization' | 'location' | 'event' | 'topic' | 'date' | 'source';

// Extracted entity from response content
export interface ExtractedEntity {
  id: string;
  name: string;
  type: EntityType;
  mentions: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  context?: string;
}

// Graph node structure
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  data: {
    entityType?: EntityType;
    mentions?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    toolName?: string;
    latencyMs?: number;
    stepId?: string;
    confidence?: number;
    description?: string;
  };
  size?: number;
  color?: string;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

// Graph edge structure
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  weight?: number;
  label?: string;
  color?: string;
}

// Complete graph data structure
export interface ThinkingGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    query: string;
    totalNodes: number;
    totalEdges: number;
    entityCount: number;
    flowSteps: number;
  };
}

// View mode for the graph
export type GraphViewMode = 'flow' | 'knowledge' | 'combined';

// Node colors by type
export const NODE_COLORS: Record<GraphNodeType, string> = {
  query: '#8B5CF6',     // Purple
  intent: '#3B82F6',    // Blue
  planning: '#6366F1',  // Indigo
  tool: '#10B981',      // Green
  entity: '#F59E0B',    // Amber
  concept: '#EC4899',   // Pink
  source: '#14B8A6',    // Teal
  synthesis: '#F97316', // Orange
  memory: '#A855F7',    // Purple light
};

// Edge colors by type
export const EDGE_COLORS: Record<GraphEdgeType, string> = {
  flow: '#64748B',        // Slate
  relates_to: '#94A3B8',  // Slate lighter
  mentions: '#F59E0B',    // Amber
  derived_from: '#3B82F6', // Blue
  produces: '#10B981',    // Green
  uses: '#6366F1',        // Indigo
};

// Node sizes by type (base sizes, can be modified by importance)
export const NODE_SIZES: Record<GraphNodeType, number> = {
  query: 12,
  intent: 10,
  planning: 9,
  tool: 8,
  entity: 6,
  concept: 5,
  source: 5,
  synthesis: 11,
  memory: 7,
};
