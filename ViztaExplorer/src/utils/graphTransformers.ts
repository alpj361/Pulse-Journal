import type { ViztaDebugResponse } from '../types/vizta';
import type {
  GraphNode,
  GraphEdge,
  ThinkingGraphData,
  ExtractedEntity,
  GraphNodeType,
  EntityType,
} from '../types/graph';

// Map step type to graph node type
function stepTypeToNodeType(stepType: string): GraphNodeType {
  const mapping: Record<string, GraphNodeType> = {
    intent: 'intent',
    planning: 'planning',
    tool: 'tool',
    synthesis: 'synthesis',
    memory: 'memory',
  };
  return mapping[stepType] || 'tool';
}

// Get node color based on type
function getNodeColor(type: GraphNodeType): string {
  const colors: Record<GraphNodeType, string> = {
    query: '#8B5CF6',
    intent: '#3B82F6',
    planning: '#6366F1',
    tool: '#10B981',
    entity: '#F59E0B',
    concept: '#EC4899',
    source: '#14B8A6',
    synthesis: '#F97316',
    memory: '#A855F7',
  };
  return colors[type] || '#64748B';
}

// Get node size based on type and optional latency
function getNodeSize(type: GraphNodeType, latencyMs?: number): number {
  const baseSizes: Record<GraphNodeType, number> = {
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

  const baseSize = baseSizes[type] || 6;

  // Scale by latency if provided (tools with longer latency = larger nodes)
  if (latencyMs && type === 'tool') {
    const scale = Math.min(2, 1 + (latencyMs / 5000)); // Max 2x size
    return baseSize * scale;
  }

  return baseSize;
}

/**
 * Transform ViztaDebugResponse into a flow graph (Query → Steps → Synthesis)
 */
export function transformToFlowGraph(response: ViztaDebugResponse): ThinkingGraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Create query node
  const queryNodeId = 'query-0';
  nodes.push({
    id: queryNodeId,
    type: 'query',
    label: response.query.original.length > 30
      ? response.query.original.substring(0, 30) + '...'
      : response.query.original,
    data: {
      description: response.query.original,
    },
    size: getNodeSize('query'),
    color: getNodeColor('query'),
  });

  let previousNodeId = queryNodeId;

  // Create nodes for each step
  response.steps.forEach((step, index) => {
    const nodeType = stepTypeToNodeType(step.type);
    const nodeId = `step-${index}`;

    let label = step.name;
    if (step.type === 'tool' && step.toolName) {
      label = step.toolName;
    } else if (step.type === 'intent' && step.result) {
      label = `Intent: ${step.result.intent}`;
    } else if (step.type === 'synthesis') {
      label = 'Synthesis';
    }

    // Truncate label if too long
    if (label.length > 25) {
      label = label.substring(0, 25) + '...';
    }

    nodes.push({
      id: nodeId,
      type: nodeType,
      label,
      data: {
        stepId: step.id,
        latencyMs: step.latencyMs,
        toolName: step.toolName,
        confidence: step.result?.confidence,
        description: step.reason || step.name,
      },
      size: getNodeSize(nodeType, step.latencyMs),
      color: getNodeColor(nodeType),
    });

    // Create edge from previous node
    edges.push({
      id: `edge-${previousNodeId}-${nodeId}`,
      source: previousNodeId,
      target: nodeId,
      type: 'flow',
      weight: 1,
    });

    previousNodeId = nodeId;
  });

  return {
    nodes,
    edges,
    metadata: {
      query: response.query.original,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      entityCount: 0,
      flowSteps: response.steps.length,
    },
  };
}

/**
 * Extract entities from the response content using pattern matching
 */
export function extractEntitiesFromResponse(response: ViztaDebugResponse): ExtractedEntity[] {
  const entityMap = new Map<string, ExtractedEntity>();

  // Collect all text content from the response
  const textContent: string[] = [];

  if (response.finalResponse) {
    textContent.push(response.finalResponse);
  }

  response.steps.forEach(step => {
    if (step.rawResponse) textContent.push(step.rawResponse);
    if (step.reason) textContent.push(step.reason);
    if (step.finalMessage) textContent.push(step.finalMessage);
    if (step.output && typeof step.output === 'object') {
      textContent.push(JSON.stringify(step.output));
    }
  });

  const fullText = textContent.join(' ');

  // Simple entity extraction patterns
  const patterns: { regex: RegExp; type: EntityType }[] = [
    // Organizations (capitalized phrases with common suffixes)
    { regex: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|Corp|Ltd|LLC|Company|Organization|Agency|Institute|University))?)\b/g, type: 'organization' },
    // Dates
    { regex: /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi, type: 'date' },
    // Locations (common patterns)
    { regex: /\b((?:New|Los|San|Las|El)\s+[A-Z][a-z]+|[A-Z][a-z]+(?:,\s+[A-Z]{2}))\b/g, type: 'location' },
  ];

  // Extract using patterns
  patterns.forEach(({ regex, type }) => {
    const matches = fullText.matchAll(regex);
    for (const match of matches) {
      const name = match[1].trim();
      if (name.length > 2 && name.length < 50) {
        const key = name.toLowerCase();
        if (entityMap.has(key)) {
          entityMap.get(key)!.mentions++;
        } else {
          entityMap.set(key, {
            id: `entity-${entityMap.size}`,
            name,
            type,
            mentions: 1,
            sentiment: 'neutral',
          });
        }
      }
    }
  });

  // Extract topics from tool parameters if they mention keywords
  response.steps.forEach(step => {
    if (step.type === 'tool' && step.parameters) {
      const params = step.parameters as Record<string, unknown>;
      if (params.query && typeof params.query === 'string') {
        const key = params.query.toLowerCase();
        if (!entityMap.has(key) && params.query.length > 3) {
          entityMap.set(key, {
            id: `entity-${entityMap.size}`,
            name: params.query,
            type: 'topic',
            mentions: 1,
            sentiment: 'neutral',
          });
        }
      }
    }
  });

  // Convert map to array and sort by mentions
  return Array.from(entityMap.values())
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 20); // Limit to top 20 entities
}

/**
 * Transform entities into a knowledge graph
 */
export function transformToKnowledgeGraph(
  response: ViztaDebugResponse,
  entities: ExtractedEntity[]
): ThinkingGraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Create entity nodes
  entities.forEach((entity) => {
    nodes.push({
      id: entity.id,
      type: 'entity',
      label: entity.name.length > 20 ? entity.name.substring(0, 20) + '...' : entity.name,
      data: {
        entityType: entity.type,
        mentions: entity.mentions,
        sentiment: entity.sentiment,
        description: entity.name,
      },
      size: 4 + Math.min(entity.mentions * 2, 8), // Size based on mentions
      color: getEntityColor(entity.type),
    });
  });

  // Create relationships between entities that appear in similar contexts
  // Simple co-occurrence based on being mentioned in same step
  const stepEntityMap = new Map<string, Set<string>>();

  response.steps.forEach(step => {
    const stepText = [
      step.rawResponse,
      step.reason,
      step.finalMessage,
      step.output ? JSON.stringify(step.output) : '',
    ].join(' ').toLowerCase();

    const stepEntities = new Set<string>();
    entities.forEach(entity => {
      if (stepText.includes(entity.name.toLowerCase())) {
        stepEntities.add(entity.id);
      }
    });

    if (stepEntities.size > 1) {
      stepEntityMap.set(step.id, stepEntities);
    }
  });

  // Create edges for co-occurring entities
  const addedEdges = new Set<string>();
  stepEntityMap.forEach(entitySet => {
    const entityIds = Array.from(entitySet);
    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        const edgeKey = [entityIds[i], entityIds[j]].sort().join('-');
        if (!addedEdges.has(edgeKey)) {
          addedEdges.add(edgeKey);
          edges.push({
            id: `edge-${edgeKey}`,
            source: entityIds[i],
            target: entityIds[j],
            type: 'relates_to',
            weight: 0.5,
          });
        }
      }
    }
  });

  return {
    nodes,
    edges,
    metadata: {
      query: response.query.original,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      entityCount: entities.length,
      flowSteps: 0,
    },
  };
}

/**
 * Transform into a combined graph with both flow and knowledge
 */
export function transformToCombinedGraph(
  response: ViztaDebugResponse,
  entities: ExtractedEntity[]
): ThinkingGraphData {
  const flowGraph = transformToFlowGraph(response);
  const knowledgeGraph = transformToKnowledgeGraph(response, entities);

  const nodes = [...flowGraph.nodes, ...knowledgeGraph.nodes];
  const edges = [...flowGraph.edges, ...knowledgeGraph.edges];

  // Connect entities to the tools/steps that mention them
  response.steps.forEach((step, index) => {
    const stepText = [
      step.rawResponse,
      step.reason,
      step.finalMessage,
      step.output ? JSON.stringify(step.output) : '',
    ].join(' ').toLowerCase();

    entities.forEach(entity => {
      if (stepText.includes(entity.name.toLowerCase())) {
        edges.push({
          id: `edge-step-${index}-${entity.id}`,
          source: `step-${index}`,
          target: entity.id,
          type: 'mentions',
          weight: 0.3,
        });
      }
    });
  });

  return {
    nodes,
    edges,
    metadata: {
      query: response.query.original,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      entityCount: entities.length,
      flowSteps: response.steps.length,
    },
  };
}

/**
 * Get color for entity type
 */
function getEntityColor(type: EntityType): string {
  const colors: Record<EntityType, string> = {
    person: '#F472B6',      // Pink
    organization: '#60A5FA', // Blue
    location: '#34D399',    // Green
    event: '#FBBF24',       // Yellow
    topic: '#A78BFA',       // Purple
    date: '#FB923C',        // Orange
    source: '#2DD4BF',      // Teal
  };
  return colors[type] || '#94A3B8';
}

/**
 * Find node by step ID
 */
export function findNodeByStepId(graphData: ThinkingGraphData, stepId: string): GraphNode | undefined {
  return graphData.nodes.find(node => node.data.stepId === stepId);
}

/**
 * Get statistics from graph data
 */
export function getGraphStats(graphData: ThinkingGraphData) {
  const nodesByType = new Map<GraphNodeType, number>();
  graphData.nodes.forEach(node => {
    nodesByType.set(node.type, (nodesByType.get(node.type) || 0) + 1);
  });

  const edgesByType = new Map<string, number>();
  graphData.edges.forEach(edge => {
    edgesByType.set(edge.type, (edgesByType.get(edge.type) || 0) + 1);
  });

  return {
    nodesByType: Object.fromEntries(nodesByType),
    edgesByType: Object.fromEntries(edgesByType),
    totalNodes: graphData.nodes.length,
    totalEdges: graphData.edges.length,
  };
}
