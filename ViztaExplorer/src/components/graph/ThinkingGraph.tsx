import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Maximize2, Minimize2, GitBranch, Network, Layers } from 'lucide-react';
import type { ThinkingGraphData, GraphNode, GraphViewMode } from '../../types/graph';

interface ThinkingGraphProps {
  data: ThinkingGraphData | null;
  viewMode: GraphViewMode;
  selectedNodeId?: string | null;
  onNodeClick?: (node: GraphNode) => void;
  onViewModeChange?: (mode: GraphViewMode) => void;
  loading?: boolean;
}

interface GraphNodeObject {
  id: string;
  type: string;
  label: string;
  data: GraphNode['data'];
  size?: number;
  color?: string;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface GraphLinkObject {
  source: string | GraphNodeObject;
  target: string | GraphNodeObject;
  type: string;
  weight?: number;
}

export function ThinkingGraph({
  data,
  viewMode,
  selectedNodeId,
  onNodeClick,
  onViewModeChange,
  loading,
}: ThinkingGraphProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNodeObject | null>(null);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isFullscreen]);

  // Zoom to fit when data changes
  useEffect(() => {
    if (graphRef.current && data) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 300);
    }
  }, [data]);

  // Center on selected node
  useEffect(() => {
    if (graphRef.current && selectedNodeId && data) {
      const node = data.nodes.find(n => n.id === selectedNodeId || n.data.stepId === selectedNodeId);
      if (node && node.x !== undefined && node.y !== undefined) {
        graphRef.current.centerAt(node.x, node.y, 500);
        graphRef.current.zoom(2, 500);
      }
    }
  }, [selectedNodeId, data]);

  // Custom node renderer
  const paintNode = useCallback((node: GraphNodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = node.size || 6;
    const isSelected = selectedNodeId === node.id || selectedNodeId === node.data.stepId;
    const isHovered = hoveredNode?.id === node.id;

    // Draw outer ring for selected/hovered nodes
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size + 4, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(148, 163, 184, 0.3)';
      ctx.fill();
    }

    // Draw node
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.color || '#64748B';
    ctx.fill();

    // Draw border
    ctx.strokeStyle = isSelected ? '#3B82F6' : '#1E293B';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Draw label
    const label = node.label || '';
    const fontSize = Math.max(10 / globalScale, 3);
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(label, node.x!, node.y! + size + 4);
  }, [selectedNodeId, hoveredNode]);

  // Custom link renderer
  const paintLink = useCallback((link: GraphLinkObject, ctx: CanvasRenderingContext2D) => {
    const source = link.source as GraphNodeObject;
    const target = link.target as GraphNodeObject;

    if (!source.x || !source.y || !target.x || !target.y) return;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);

    // Different colors for different edge types
    const edgeColors: Record<string, string> = {
      flow: '#475569',
      relates_to: '#64748B',
      mentions: '#F59E0B40',
      derived_from: '#3B82F640',
      produces: '#10B98140',
      uses: '#6366F140',
    };

    ctx.strokeStyle = edgeColors[link.type] || '#475569';
    ctx.lineWidth = link.type === 'flow' ? 2 : 1;
    ctx.stroke();

    // Draw arrow for flow edges
    if (link.type === 'flow') {
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const targetSize = (target as GraphNodeObject).size || 6;
      const arrowX = target.x - Math.cos(angle) * (targetSize + 5);
      const arrowY = target.y - Math.sin(angle) * (targetSize + 5);

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle - Math.PI / 6),
        arrowY - 8 * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle + Math.PI / 6),
        arrowY - 8 * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = '#475569';
      ctx.fill();
    }
  }, []);

  const handleNodeClick = useCallback((node: GraphNodeObject) => {
    if (onNodeClick) {
      onNodeClick(node as unknown as GraphNode);
    }
  }, [onNodeClick]);

  const handleNodeHover = useCallback((node: GraphNodeObject | null) => {
    setHoveredNode(node);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Transform data for force-graph
  const graphData = data ? {
    nodes: data.nodes.map(n => ({ ...n })),
    links: data.edges.map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
      weight: e.weight,
    })),
  } : { nodes: [], links: [] };

  if (!data && !loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No data to visualize</p>
          <p className="text-sm text-slate-600 mt-1">Run a query to see the thinking graph</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-slate-900 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'h-full'
      }`}
    >
      {/* Header Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-800/90 backdrop-blur rounded-lg p-1">
          <button
            onClick={() => onViewModeChange?.('flow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'flow'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Flow
          </button>
          <button
            onClick={() => onViewModeChange?.('knowledge')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'knowledge'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Knowledge
          </button>
          <button
            onClick={() => onViewModeChange?.('combined')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'combined'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Combined
          </button>
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-2 bg-slate-800/90 backdrop-blur rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Graph Stats */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-800/90 backdrop-blur rounded-lg px-3 py-2">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Nodes: <span className="text-slate-200">{data?.metadata.totalNodes || 0}</span></span>
          <span>Edges: <span className="text-slate-200">{data?.metadata.totalEdges || 0}</span></span>
          {(data?.metadata.entityCount ?? 0) > 0 && (
            <span>Entities: <span className="text-amber-400">{data?.metadata.entityCount}</span></span>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-16 left-3 z-10 bg-slate-800/95 backdrop-blur rounded-lg px-3 py-2 max-w-xs">
          <div className="text-sm font-medium text-slate-200">{hoveredNode.label}</div>
          <div className="text-xs text-slate-400 mt-1">Type: {hoveredNode.type}</div>
          {hoveredNode.data.latencyMs && (
            <div className="text-xs text-slate-400">Latency: {hoveredNode.data.latencyMs}ms</div>
          )}
          {hoveredNode.data.confidence && (
            <div className="text-xs text-slate-400">Confidence: {(hoveredNode.data.confidence * 100).toFixed(0)}%</div>
          )}
          {hoveredNode.data.description && (
            <div className="text-xs text-slate-500 mt-1 truncate">{hoveredNode.data.description}</div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Processing...</span>
          </div>
        </div>
      )}

      {/* Force Graph */}
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0F172A"
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, (node.size || 6) + 4, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={100}
        linkDirectionalArrowLength={0}
      />
    </div>
  );
}
