import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, Loader2, History, Trash2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HistoryEntry } from '../../types/vizta';

interface QueryInputProps {
  onSubmit: (query: string, options: { useCodex: boolean }) => void;
  loading: boolean;
  history: HistoryEntry[];
  onHistorySelect: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

export function QueryInput({
  onSubmit,
  loading,
  history,
  onHistorySelect,
  onClearHistory,
}: QueryInputProps) {
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [useCodex, setUseCodex] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (query.trim() && !loading) {
      onSubmit(query.trim(), { useCodex });
      setQuery('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const exampleQueries = [
    'What are the trending topics in Guatemala?',
    'Search for news about the president',
    'Analyze the sentiment of tweets about elections',
    'What is happening with the congress today?',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Query Input Area */}
      <div className="p-4 space-y-3">
        <label className="text-sm font-medium text-slate-300">Query</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your query to test Vizta..."
            className="w-full h-32 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg
                       text-white placeholder-slate-500 resize-none
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-all"
            disabled={loading}
          />
          <button
            onClick={handleSubmit}
            disabled={!query.trim() || loading}
            className="absolute bottom-3 right-3 p-2 rounded-lg bg-blue-600 text-white
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>

        {/* Use Codex Toggle */}
        <button
          type="button"
          onClick={() => setUseCodex(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all w-full ${
            useCodex
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
          }`}
        >
          <BookOpen size={14} />
          <span>Use Codex</span>
          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${useCodex ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-700 text-slate-500'}`}>
            {useCodex ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Example Queries */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example, i) => (
              <button
                key={i}
                onClick={() => setQuery(example)}
                className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-md
                           hover:bg-slate-600 transition-colors truncate max-w-[200px]"
                title={example}
              >
                {example.length > 30 ? example.substring(0, 30) + '...' : example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="flex-1 border-t border-slate-700 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <History size={16} />
            <span>History ({history.length})</span>
          </button>
          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-slate-500 hover:text-red-400 transition-colors"
              title="Clear history"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-y-auto flex-1"
            >
              {history.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 text-center">No history yet</p>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {history.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => onHistorySelect(entry)}
                      className="w-full p-3 text-left hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-sm text-white truncate">{entry.query}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-xs text-slate-600">|</span>
                        <span className="text-xs text-slate-500">
                          {entry.response.steps.length} steps
                        </span>
                        <span className="text-xs text-slate-600">|</span>
                        <span className="text-xs text-slate-500">
                          {entry.response.metadata.totalLatencyMs}ms
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
