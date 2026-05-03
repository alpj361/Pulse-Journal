import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  RefreshCw,
  Play,
  Wrench,
  MessageSquare,
  Search,
} from 'lucide-react';
import { getTools, executeTool } from '../services/viztaDebug';
import type { ToolInfo } from '../types/vizta';
import { JsonViewer } from '../components/details/JsonViewer';

interface ToolCardProps {
  tool: ToolInfo & { isInChatMode?: boolean };
  onExecute: (toolName: string, params: object) => void;
  executing: boolean;
}

function ToolCard({ tool, onExecute, executing }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});

  // Lista de tools depreciadas
  const deprecatedTools = [
    'nitter_context',
    'nitter_profile',
    'latest_trends',
    'webagent_extract',
    'user_projects',
    'project_decisions',
    'resolve_twitter_handle'
  ];

  const isDeprecated = deprecatedTools.includes(tool.name);

  const handleExecute = () => {
    // Convert params to appropriate types
    const typedParams: Record<string, unknown> = {};
    Object.entries(params).forEach(([key, value]) => {
      const paramInfo = tool.parameters[key];
      if (paramInfo?.type === 'number') {
        typedParams[key] = Number(value);
      } else if (paramInfo?.type === 'boolean') {
        typedParams[key] = value === 'true';
      } else {
        typedParams[key] = value;
      }
    });
    onExecute(tool.name, typedParams);
  };

  return (
    <motion.div
      layout
      className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-start gap-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className={`w-10 h-10 rounded-lg ${isDeprecated ? 'bg-orange-500/20' : 'bg-green-500/20'} flex items-center justify-center flex-shrink-0`}>
          <Wrench size={20} className={isDeprecated ? 'text-orange-400' : 'text-green-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">
              {isDeprecated && '❗ '}
              {tool.name}
            </h3>
            {tool.isInChatMode && (
              <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full">
                Chat Mode
              </span>
            )}
            {isDeprecated && (
              <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-300 rounded-full">
                Deprecated
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{tool.description}</p>
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-slate-700"
        >
          {/* Parameters */}
          <div className="p-4 space-y-4">
            <h4 className="text-sm font-medium text-slate-300">Parameters</h4>
            {Object.keys(tool.parameters).length === 0 ? (
              <p className="text-sm text-slate-500">No parameters required</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(tool.parameters).map(([key, info]) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-400 mb-1">
                      {key}
                      {info.required && <span className="text-red-400">*</span>}
                      <span className="text-slate-600 ml-2">({info.type})</span>
                    </label>
                    <input
                      type="text"
                      value={params[key] || ''}
                      onChange={e => setParams({ ...params, [key]: e.target.value })}
                      placeholder={info.description}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md
                                 text-white text-sm placeholder-slate-500
                                 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Examples */}
            {tool.examples && tool.examples.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Examples</h4>
                <div className="space-y-1">
                  {tool.examples.map((example, i) => (
                    <code
                      key={i}
                      className="block text-xs bg-slate-700/50 text-green-300 p-2 rounded"
                    >
                      {example}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg
                         hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {executing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Execute Tool
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export function Tools() {
  const [tools, setTools] = useState<(ToolInfo & { isInChatMode?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [result, setResult] = useState<{ toolName: string; data: object } | null>(null);
  const [filter, setFilter] = useState('');

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTools();
      setTools(data.tools);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const handleExecuteTool = async (toolName: string, params: object) => {
    setExecuting(toolName);
    setResult(null);
    try {
      const data = await executeTool(toolName, params);
      setResult({ toolName, data });
    } catch (err) {
      setResult({
        toolName,
        data: { error: err instanceof Error ? err.message : 'Execution failed' },
      });
    } finally {
      setExecuting(null);
    }
  };

  const filteredTools = tools.filter(
    tool =>
      tool.name.toLowerCase().includes(filter.toLowerCase()) ||
      tool.description.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-green-500" />
          <p className="text-slate-400">Loading tools...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Tools</h3>
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button
            onClick={fetchTools}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Tools List */}
      <div className="w-[500px] flex-shrink-0 border-r border-slate-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Available Tools</h2>
            <span className="text-sm text-slate-400">{tools.length} tools</span>
          </div>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search tools..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg
                         text-white text-sm placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Tools Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredTools.map(tool => (
            <ToolCard
              key={tool.name}
              tool={tool}
              onExecute={handleExecuteTool}
              executing={executing === tool.name}
            />
          ))}
        </div>
      </div>

      {/* Result Panel */}
      <div className="flex-1 bg-slate-900 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Execution Result</h3>
          {result && (
            <p className="text-sm text-slate-400 mt-1">
              Tool: <span className="text-green-400">{result.toolName}</span>
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {result ? (
            <JsonViewer data={result.data} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-slate-500" />
              </div>
              <p className="text-slate-400 mb-2">No result yet</p>
              <p className="text-sm text-slate-500">
                Execute a tool to see its output here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
