import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Loader2, FlaskConical } from 'lucide-react';
import { runExperiment } from '../services/viztaDebug';
import type { ExperimentConfig, ExperimentResult } from '../types/vizta';
import { JsonViewer } from '../components/details/JsonViewer';
import { ProcessTimeline } from '../components/timeline/ProcessTimeline';

export function Experiments() {
  const [query, setQuery] = useState('');
  const [systemPromptOverride, setSystemPromptOverride] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunExperiment = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const config: ExperimentConfig = {
        query: query.trim(),
        overrides: {},
      };

      if (systemPromptOverride.trim()) {
        config.overrides!.systemPrompt = systemPromptOverride.trim();
      }

      if (temperature !== 0.7) {
        config.overrides!.temperature = temperature;
      }

      const data = await runExperiment(config);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Experiment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Configuration Panel */}
      <div className="w-[450px] flex-shrink-0 bg-slate-800/50 border-r border-slate-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical size={24} className="text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Experiment Configuration</h2>
          </div>
          <p className="text-sm text-slate-400">
            Test Vizta with custom prompts and parameters
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Query Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Query <span className="text-red-400">*</span>
            </label>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Enter your test query..."
              className="w-full h-32 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                         text-white text-sm placeholder-slate-500 resize-none
                         focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Temperature Slider */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={e => setTemperature(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                         accent-purple-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Precise (0)</span>
              <span>Creative (1)</span>
            </div>
          </div>

          {/* System Prompt Override */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              System Prompt Override (optional)
            </label>
            <div className="h-48 border border-slate-600 rounded-lg overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="markdown"
                value={systemPromptOverride}
                onChange={value => setSystemPromptOverride(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'off',
                  wordWrap: 'on',
                  padding: { top: 8 },
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Leave empty to use the default system prompt
            </p>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunExperiment}
            disabled={!query.trim() || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3
                       bg-purple-600 text-white rounded-lg font-medium
                       hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Running Experiment...
              </>
            ) : (
              <>
                <Play size={18} />
                Run Experiment
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Panel */}
      <div className="flex-1 bg-slate-900 flex flex-col overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Experiment Failed</h3>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        ) : result ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stats Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Experiment Results</h3>
                  <p className="text-sm text-slate-400">ID: {result.experimentId}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Total Time</p>
                    <p className="text-lg font-semibold text-white">
                      {result.metadata.totalLatencyMs}ms
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Steps</p>
                    <p className="text-lg font-semibold text-white">{result.steps.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline and Response */}
            <div className="flex-1 flex overflow-hidden">
              {/* Mini Timeline */}
              <div className="w-80 border-r border-slate-700 overflow-y-auto">
                <ProcessTimeline
                  response={result}
                  selectedStep={null}
                  onSelectStep={() => {}}
                />
              </div>

              {/* Final Response */}
              <div className="flex-1 overflow-y-auto p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Final Response</h4>
                <div className="bg-slate-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-white whitespace-pre-wrap">
                    {result.finalResponse || 'No response generated'}
                  </p>
                </div>

                <h4 className="text-sm font-medium text-slate-300 mb-3">Full Debug Data</h4>
                <JsonViewer data={result} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
              <FlaskConical size={28} className="text-slate-500" />
            </div>
            <p className="text-slate-400 mb-2">No experiment results yet</p>
            <p className="text-sm text-slate-500">
              Configure your experiment on the left and click "Run Experiment"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
