import { useState } from 'react';
import { JSONTree } from 'react-json-tree';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface JsonViewerProps {
  data: object | null | undefined;
  title?: string;
  defaultExpanded?: boolean;
}

const theme = {
  scheme: 'vizta',
  author: 'vizta explorer',
  base00: '#0f172a', // bg
  base01: '#1e293b',
  base02: '#334155',
  base03: '#64748b', // comments
  base04: '#94a3b8',
  base05: '#e2e8f0',
  base06: '#f1f5f9',
  base07: '#f8fafc', // text
  base08: '#ef4444', // red
  base09: '#f97316', // orange
  base0A: '#facc15', // yellow
  base0B: '#22c55e', // green
  base0C: '#14b8a6', // cyan
  base0D: '#3b82f6', // blue
  base0E: '#a855f7', // purple
  base0F: '#ec4899', // pink
};

export function JsonViewer({ data, title, defaultExpanded = true }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleCopy = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!data) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-lg">
        <p className="text-sm text-slate-500 italic">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-700/50 border-b border-slate-700">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {title}
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-slate-600 transition-colors"
            title="Copy JSON"
          >
            {copied ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} className="text-slate-400" />
            )}
          </button>
        </div>
      )}
      {expanded && (
        <div className="p-4 overflow-x-auto text-sm json-tree">
          <JSONTree
            data={data}
            theme={theme}
            invertTheme={false}
            shouldExpandNodeInitially={() => true}
            hideRoot
          />
        </div>
      )}
    </div>
  );
}
