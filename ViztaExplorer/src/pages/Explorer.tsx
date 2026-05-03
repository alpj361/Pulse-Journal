import { useEffect, useState, useCallback } from 'react';
import { List, Network } from 'lucide-react';
import { QueryInput } from '../components/input/QueryInput';
import { ProcessTimeline } from '../components/timeline/ProcessTimeline';
import { StepDetail } from '../components/details/StepDetail';
import { ThinkingGraph } from '../components/graph/ThinkingGraph';
import { useViztaDebug } from '../hooks/useViztaDebug';
import { useThinkingGraph } from '../hooks/useThinkingGraph';
import type { GraphNode } from '../types/graph';

type VizMode = 'timeline' | 'graph';

export function Explorer() {
  const {
    loading,
    error,
    response,
    selectedStep,
    history,
    executeQuery,
    selectStep,
    loadHistoryEntry,
    clearHistory,
    loadSavedHistory,
  } = useViztaDebug();

  const {
    graphData,
    viewMode,
    changeViewMode,
    selectNodeByStepId,
  } = useThinkingGraph(response);

  const [vizMode, setVizMode] = useState<VizMode>('timeline');

  // Load saved history on mount
  useEffect(() => {
    loadSavedHistory();
  }, [loadSavedHistory]);

  // Sync timeline selection to graph
  useEffect(() => {
    if (selectedStep && vizMode === 'graph') {
      selectNodeByStepId(selectedStep.id);
    }
  }, [selectedStep, vizMode, selectNodeByStepId]);

  // Handle graph node click - sync to timeline
  const handleGraphNodeClick = useCallback((node: GraphNode) => {
    if (node.data.stepId && response) {
      const step = response.steps.find(s => s.id === node.data.stepId);
      if (step) {
        selectStep(step);
      }
    }
  }, [response, selectStep]);

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Left Panel - Query Input */}
      <div className="w-80 flex-shrink-0 bg-slate-800/50 border-r border-slate-700 flex flex-col">
        <QueryInput
          onSubmit={(query, options) => executeQuery(query, options)}
          loading={loading}
          history={history}
          onHistorySelect={loadHistoryEntry}
          onClearHistory={clearHistory}
        />
      </div>

      {/* Center Panel - Timeline or Graph */}
      <div className="w-96 flex-shrink-0 bg-slate-800/30 border-r border-slate-700 flex flex-col overflow-hidden">
        {/* Viz Mode Toggle Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-sm font-semibold text-slate-300">
            {vizMode === 'timeline' ? 'Process Timeline' : 'Thinking Graph'}
          </h2>
          <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg p-0.5">
            <button
              onClick={() => setVizMode('timeline')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                vizMode === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="View as Timeline"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>
            <button
              onClick={() => setVizMode('graph')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                vizMode === 'graph'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="View as Graph"
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Graph</span>
            </button>
          </div>
        </div>

        {/* Visualization Content */}
        <div className="flex-1 overflow-hidden">
          {vizMode === 'timeline' ? (
            <ProcessTimeline
              response={response}
              selectedStep={selectedStep}
              onSelectStep={selectStep}
              loading={loading}
            />
          ) : (
            <ThinkingGraph
              data={graphData}
              viewMode={viewMode}
              selectedNodeId={selectedStep?.id}
              onNodeClick={handleGraphNodeClick}
              onViewModeChange={changeViewMode}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* Right Panel - Details */}
      <div className="flex-1 bg-slate-900 flex flex-col overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        ) : (
          <StepDetail step={selectedStep} finalResponse={response?.finalResponse} />
        )}
      </div>
    </div>
  );
}
