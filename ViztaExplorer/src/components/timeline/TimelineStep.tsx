import { motion } from 'framer-motion';
import {
  Target,
  ListChecks,
  Wrench,
  Sparkles,
  Brain,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import type { DebugStep, StepType } from '../../types/vizta';

interface TimelineStepProps {
  step: DebugStep;
  index: number;
  isSelected: boolean;
  isLast: boolean;
  onClick: () => void;
}

const stepIcons: Record<StepType, React.ReactNode> = {
  intent: <Target size={16} />,
  planning: <ListChecks size={16} />,
  tool: <Wrench size={16} />,
  synthesis: <Sparkles size={16} />,
  memory: <Brain size={16} />,
};

const stepColors: Record<StepType, string> = {
  intent: 'from-purple-500 to-purple-600',
  planning: 'from-blue-500 to-blue-600',
  tool: 'from-green-500 to-green-600',
  synthesis: 'from-orange-500 to-orange-600',
  memory: 'from-pink-500 to-pink-600',
};

const stepBgColors: Record<StepType, string> = {
  intent: 'bg-purple-500/20 border-purple-500/50',
  planning: 'bg-blue-500/20 border-blue-500/50',
  tool: 'bg-green-500/20 border-green-500/50',
  synthesis: 'bg-orange-500/20 border-orange-500/50',
  memory: 'bg-pink-500/20 border-pink-500/50',
};

export function TimelineStep({
  step,
  index,
  isSelected,
  isLast,
  onClick,
}: TimelineStepProps) {
  const hasError = !!step.error;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative"
    >
      {/* Connector Line */}
      {!isLast && (
        <div className="absolute left-5 top-10 w-0.5 h-[calc(100%-8px)] bg-slate-700" />
      )}

      <button
        onClick={onClick}
        className={clsx(
          'w-full flex items-start gap-3 p-3 rounded-lg transition-all text-left',
          isSelected
            ? 'bg-slate-700/80 ring-2 ring-blue-500'
            : 'hover:bg-slate-700/50'
        )}
      >
        {/* Step Icon */}
        <div
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            'bg-gradient-to-br',
            stepColors[step.type],
            'shadow-lg shadow-black/20'
          )}
        >
          {stepIcons[step.type]}
        </div>

        {/* Step Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {step.name}
            </span>
            {hasError ? (
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
            )}
          </div>

          {/* Step Details */}
          <div className="flex items-center gap-2 mt-1">
            <span
              className={clsx(
                'px-2 py-0.5 text-xs rounded-full border',
                stepBgColors[step.type]
              )}
            >
              {step.type}
            </span>
            <span className="text-xs text-slate-500">{step.latencyMs}ms</span>
          </div>

          {/* Tool Name for tool steps */}
          {step.type === 'tool' && step.toolName && (
            <p className="text-xs text-slate-400 mt-1 truncate">
              {step.toolName}
            </p>
          )}

          {/* Intent for intent steps */}
          {step.type === 'intent' && step.result?.intent && (
            <p className="text-xs text-slate-400 mt-1">
              Intent: {step.result.intent} ({Math.round((step.result.confidence || 0) * 100)}%)
            </p>
          )}
        </div>
      </button>
    </motion.div>
  );
}
