import { motion } from 'framer-motion';
import { Clock, Wrench, Zap } from 'lucide-react';
import type { DebugStep, ViztaDebugResponse } from '../../types/vizta';
import { TimelineStep } from './TimelineStep';

interface ProcessTimelineProps {
  response: ViztaDebugResponse | null;
  selectedStep: DebugStep | null;
  onSelectStep: (step: DebugStep) => void;
  loading?: boolean;
}

export function ProcessTimeline({
  response,
  selectedStep,
  onSelectStep,
  loading,
}: ProcessTimelineProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-blue-500"
        />
        <p className="mt-4 text-slate-400">Processing query...</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
          <Zap size={28} className="text-slate-500" />
        </div>
        <p className="text-slate-400 mb-2">No query executed yet</p>
        <p className="text-sm text-slate-500">
          Enter a query on the left to see the execution timeline
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header Stats */}
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Execution Timeline</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Clock size={14} />
              <span className="text-xs">Total Time</span>
            </div>
            <p className="text-lg font-semibold text-white">
              {response.metadata.totalLatencyMs}ms
            </p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Wrench size={14} />
              <span className="text-xs">Tools Used</span>
            </div>
            <p className="text-lg font-semibold text-white">
              {response.metadata.toolsUsed.length}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Zap size={14} />
              <span className="text-xs">Steps</span>
            </div>
            <p className="text-lg font-semibold text-white">
              {response.steps.length}
            </p>
          </div>
        </div>
      </div>

      {/* Query Info */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
        <p className="text-xs text-slate-500 mb-1">Query</p>
        <p className="text-sm text-white line-clamp-2">{response.query.original}</p>
        {response.query.enhanced && response.query.enhanced !== response.query.original && (
          <>
            <p className="text-xs text-slate-500 mt-2 mb-1">Enhanced Query</p>
            <p className="text-sm text-blue-300 line-clamp-2">{response.query.enhanced}</p>
          </>
        )}
      </div>

      {/* Steps Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {response.steps.map((step, index) => (
          <TimelineStep
            key={step.id}
            step={step}
            index={index}
            isSelected={selectedStep?.id === step.id}
            isLast={index === response.steps.length - 1}
            onClick={() => onSelectStep(step)}
          />
        ))}
      </div>

      {/* Tools Used Summary */}
      {response.metadata.toolsUsed.length > 0 && (
        <div className="p-4 border-t border-slate-700 bg-slate-800/30">
          <p className="text-xs text-slate-500 mb-2">Tools Used</p>
          <div className="flex flex-wrap gap-2">
            {response.metadata.toolsUsed.map(tool => (
              <span
                key={tool}
                className="px-2 py-1 text-xs bg-green-500/20 text-green-300 rounded-md border border-green-500/30"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
