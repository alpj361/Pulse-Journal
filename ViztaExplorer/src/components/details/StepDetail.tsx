import { motion } from 'framer-motion';
import { Copy, Check, FileText, Code, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { DebugStep } from '../../types/vizta';
import { JsonViewer } from './JsonViewer';

interface StepDetailProps {
  step: DebugStep | null;
  finalResponse?: string;
}

export function StepDetail({ step, finalResponse }: StepDetailProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  if (!step) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
          <FileText size={28} className="text-slate-500" />
        </div>
        <p className="text-slate-400 mb-2">No step selected</p>
        <p className="text-sm text-slate-500">
          Click on a step in the timeline to view details
        </p>
      </div>
    );
  }

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const renderIntentDetails = () => (
    <div className="space-y-4">
      {step.prompt && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-300">Classification Prompt</h4>
            <button
              onClick={() => handleCopyPrompt(step.prompt!)}
              className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
            >
              {copiedPrompt ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <Copy size={14} className="text-slate-400" />
              )}
            </button>
          </div>
          <pre className="p-3 bg-slate-800 rounded-lg text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48">
            {step.prompt}
          </pre>
        </div>
      )}

      {step.rawResponse && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Raw Response</h4>
          <pre className="p-3 bg-slate-800 rounded-lg text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48">
            {step.rawResponse}
          </pre>
        </div>
      )}

      {step.result && (
        <JsonViewer data={step.result} title="Parsed Result" />
      )}
    </div>
  );

  const renderPlanningDetails = () => (
    <div className="space-y-4">
      {step.systemPrompt && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-300">System Prompt</h4>
            <button
              onClick={() => handleCopyPrompt(step.systemPrompt!)}
              className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
            >
              {copiedPrompt ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <Copy size={14} className="text-slate-400" />
              )}
            </button>
          </div>
          <pre className="p-3 bg-slate-800 rounded-lg text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-64">
            {step.systemPrompt}
          </pre>
        </div>
      )}

      {step.payload && (
        <JsonViewer data={step.payload} title="Request Payload" />
      )}

      {step.plan && (
        <JsonViewer data={step.plan} title="Generated Plan" />
      )}
    </div>
  );

  const renderToolDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Tool Name</p>
          <p className="text-sm font-medium text-green-400">{step.toolName}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Latency</p>
          <p className="text-sm font-medium text-white">{step.latencyMs}ms</p>
        </div>
      </div>

      {step.reason && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Reason for Calling</h4>
          <p className="p-3 bg-slate-800 rounded-lg text-sm text-slate-300">
            {step.reason}
          </p>
        </div>
      )}

      {step.parameters && (
        <JsonViewer data={step.parameters} title="Parameters" />
      )}

      {step.error ? (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
          <div>
            <h4 className="text-sm font-medium text-red-400 mb-1">Error</h4>
            <p className="text-sm text-red-300">{step.error}</p>
          </div>
        </div>
      ) : (
        step.output && <JsonViewer data={step.output} title="Output" />
      )}
    </div>
  );

  const renderSynthesisDetails = () => (
    <div className="space-y-4">
      {step.synthesisPrompt && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-300">Synthesis Prompt</h4>
            <button
              onClick={() => handleCopyPrompt(step.synthesisPrompt!)}
              className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
            >
              {copiedPrompt ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <Copy size={14} className="text-slate-400" />
              )}
            </button>
          </div>
          <pre className="p-3 bg-slate-800 rounded-lg text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-64">
            {step.synthesisPrompt}
          </pre>
        </div>
      )}

      {step.finalMessage && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Final Message</h4>
          <div className="p-4 bg-slate-800 rounded-lg">
            <p className="text-sm text-white whitespace-pre-wrap">{step.finalMessage}</p>
          </div>
        </div>
      )}

      {step.sources && step.sources.length > 0 && (
        <JsonViewer data={step.sources} title="Sources" />
      )}
    </div>
  );

  const renderMemoryDetails = () => (
    <div className="space-y-4">
      {step.memoryQuery && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Memory Query</h4>
          <p className="p-3 bg-slate-800 rounded-lg text-sm text-slate-300">
            {step.memoryQuery}
          </p>
        </div>
      )}

      {step.memoryResults && (
        <JsonViewer data={step.memoryResults} title="Memory Results" />
      )}
    </div>
  );

  const renderDetails = () => {
    switch (step.type) {
      case 'intent':
        return renderIntentDetails();
      case 'planning':
        return renderPlanningDetails();
      case 'tool':
        return renderToolDetails();
      case 'synthesis':
        return renderSynthesisDetails();
      case 'memory':
        return renderMemoryDetails();
      default:
        return <JsonViewer data={step} title="Step Data" />;
    }
  };

  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-2">
          <Code size={20} className="text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{step.name}</h3>
        </div>
        <div className="flex items-center gap-4">
          <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-md">
            {step.type}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(step.timestamp).toLocaleTimeString()}
          </span>
          <span className="text-xs text-slate-500">{step.latencyMs}ms</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">{renderDetails()}</div>

      {/* Final Response (only shown for synthesis step or if provided) */}
      {(step.type === 'synthesis' || finalResponse) && finalResponse && (
        <div className="p-4 border-t border-slate-700 bg-slate-800/30">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Final Response</h4>
          <div className="p-3 bg-slate-700/50 rounded-lg max-h-48 overflow-y-auto">
            <p className="text-sm text-white whitespace-pre-wrap">{finalResponse}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
