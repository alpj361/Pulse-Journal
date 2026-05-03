import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Loader2, Copy, Check, RefreshCw, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { getPrompts, updatePrompt } from '../services/viztaDebug';
import type { ViztaPromptsResponse } from '../types/vizta';

type PromptKey = 'systemPrompt' | 'synthesisPrompt' | 'intentPrompt';

const promptLabels: Record<PromptKey, { label: string; description: string }> = {
  systemPrompt: {
    label: 'System Prompt',
    description: 'Main personality and behavior instructions for Vizta',
  },
  synthesisPrompt: {
    label: 'Synthesis Prompt',
    description: 'Instructions for synthesizing tool results into responses',
  },
  intentPrompt: {
    label: 'Intent Classification',
    description: 'Prompt for classifying user intent and suggesting tools',
  },
};

export function Prompts() {
  const [prompts, setPrompts] = useState<ViztaPromptsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptKey>('systemPrompt');
  const [copied, setCopied] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchPrompts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPrompts();
      setPrompts(data);
      // Initialize edited content with current prompt
      const currentContent = typeof data[selectedPrompt] === 'string' 
        ? data[selectedPrompt] 
        : JSON.stringify(data[selectedPrompt], null, 2);
      setEditedContent(currentContent);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  // Update edited content when selected prompt changes
  useEffect(() => {
    if (prompts) {
      const currentContent = typeof prompts[selectedPrompt] === 'string'
        ? prompts[selectedPrompt]
        : JSON.stringify(prompts[selectedPrompt], null, 2);
      setEditedContent(currentContent);
      setHasChanges(false);
      setSaveSuccess(false);
    }
  }, [selectedPrompt, prompts]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditedContent(value);
      const originalContent = prompts
        ? typeof prompts[selectedPrompt] === 'string'
          ? prompts[selectedPrompt]
          : JSON.stringify(prompts[selectedPrompt], null, 2)
        : '';
      setHasChanges(value !== originalContent);
      setSaveSuccess(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges || !prompts) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await updatePrompt(selectedPrompt, editedContent);
      
      // Update local state
      setPrompts({
        ...prompts,
        [selectedPrompt]: editedContent
      });
      
      setHasChanges(false);
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (prompts) {
      const promptContent = prompts[selectedPrompt];
      if (typeof promptContent === 'string') {
        navigator.clipboard.writeText(promptContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-blue-500" />
          <p className="text-slate-400">Loading prompts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Prompts</h3>
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button
            onClick={fetchPrompts}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
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
      {/* Sidebar - Prompt Selection */}
      <div className="w-72 flex-shrink-0 bg-slate-800/50 border-r border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">System Prompts</h2>
        <div className="space-y-2">
          {(Object.keys(promptLabels) as PromptKey[]).map(key => (
            <button
              key={key}
              onClick={() => setSelectedPrompt(key)}
              className={`w-full text-left p-3 rounded-lg transition-all ${
                selectedPrompt === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <p className="font-medium">{promptLabels[key].label}</p>
              <p className="text-xs opacity-70 mt-1">{promptLabels[key].description}</p>
            </button>
          ))}
        </div>

        {/* Metadata */}
        {prompts && (
          <div className="mt-6 p-3 bg-slate-700/30 rounded-lg">
            <p className="text-xs text-slate-500 mb-2">Model Configuration</p>
            <div className="space-y-1">
              <p className="text-sm text-slate-300">
                Model: <span className="text-blue-400">{prompts.metadata?.model || 'N/A'}</span>
              </p>
              <p className="text-sm text-slate-300">
                Synthesis:{' '}
                <span className="text-green-400">{prompts.metadata?.synthesisModel || 'N/A'}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {promptLabels[selectedPrompt].label}
            </h3>
            <p className="text-sm text-slate-400">{promptLabels[selectedPrompt].description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                hasChanges && !saving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check size={16} className="text-green-400" />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={fetchPrompts}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <motion.div
          key={selectedPrompt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1"
        >
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={editedContent}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              tabSize: 2,
              insertSpaces: true,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
