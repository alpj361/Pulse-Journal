import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, ChevronRight } from 'lucide-react';
import type { PixelAgentData } from './PixelCharacter';
import { executeDebugQuery } from '../../services/viztaDebug';

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
  thinking?: boolean;
  steps?: number; // how many debug steps ran
  latencyMs?: number;
}

interface Props {
  agent: PixelAgentData;
  onClose: () => void;
  onQueryComplete?: (query: string) => void;
}

const specialtyIcons: Record<string, string> = {
  data: '📊', field: '🔎', sources: '📰', digital: '💻',
  legal: '⚖️', finance: '💰', strategy: '🧠', archives: '📁',
  vizta: '🤖', search: '🔍', trending: '📈', news: '📡',
};

const PixelAgentChat = ({ agent, onClose, onQueryComplete }: Props) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'agent',
      text: agent.greeting || '¡Hola! ¿En qué puedo ayudarte?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);
    setError(null);

    // Add thinking placeholder
    const thinkingId = `t-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: thinkingId, role: 'agent', text: '...', thinking: true },
    ]);

    const startTime = Date.now();

    try {
      // Build query with agent context
      const contextualQuery = agent.viztaContext
        ? `[Contexto del agente: ${agent.viztaContext}]\n\nPregunta: ${text}`
        : text;

      const response = await executeDebugQuery(contextualQuery, undefined, {
        agentId: agent.id,
        agentRole: agent.role,
      });

      const latencyMs = Date.now() - startTime;
      const finalText = response.finalResponse || 'No pude obtener una respuesta.';
      const stepCount = response.steps?.length || 0;

      setMessages(prev =>
        prev
          .filter(m => m.id !== thinkingId)
          .concat({
            id: `a-${Date.now()}`,
            role: 'agent',
            text: finalText,
            steps: stepCount,
            latencyMs,
          })
      );

      onQueryComplete?.(text);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errMsg);
      setMessages(prev => prev.filter(m => m.id !== thinkingId));
    } finally {
      setIsThinking(false);
    }
  }, [input, isThinking, agent, onQueryComplete]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const icon = specialtyIcons[agent.specialty || ''] || '🕵️';

  const exampleQueries = [
    '¿Qué está trending en Guatemala hoy?',
    '¿Cuáles son las noticias más importantes?',
    'Analiza la situación política actual',
    'Busca información sobre economía guatemalteca',
  ].slice(0, 2);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0f172a', borderLeft: '2px solid #1e293b' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: '#0a0f1e', borderBottom: '2px solid #1e293b' }}>
        {/* Mini pixel avatar */}
        <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
          <div
            className="w-full h-full rounded-full"
            style={{ backgroundColor: agent.shirtColor, border: '2px solid #fbbf24' }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full"
              style={{ backgroundColor: agent.color }}
            />
            <div
              className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-3 rounded-t-full"
              style={{ backgroundColor: agent.hairColor }}
            />
          </div>
          <span className="absolute -bottom-1 -right-1 text-xs">{icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-pixel text-yellow-400 truncate" style={{ fontSize: '8px' }}>{agent.name}</div>
          <div className="font-pixel text-slate-400 truncate" style={{ fontSize: '6px' }}>{agent.role}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="font-pixel text-green-400" style={{ fontSize: '5px' }}>CONECTADO A VIZTA</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Example queries when only greeting */}
        {messages.length === 1 && (
          <div className="space-y-1.5">
            <div className="font-pixel text-slate-500" style={{ fontSize: '6px' }}>SUGERENCIAS:</div>
            {exampleQueries.map((q, i) => (
              <button
                key={i}
                onClick={() => setInput(q)}
                className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800 transition-all group"
              >
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-blue-400 flex-shrink-0" />
                <span className="font-pixel text-slate-400 group-hover:text-slate-200" style={{ fontSize: '6px' }}>{q}</span>
              </button>
            ))}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] px-3 py-2 font-pixel leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tl-lg rounded-tr-sm rounded-b-lg'
                  : msg.thinking
                  ? 'bg-slate-800 text-slate-400 rounded-tr-lg rounded-tl-sm rounded-b-lg'
                  : 'bg-slate-800 text-slate-100 rounded-tr-lg rounded-tl-sm rounded-b-lg'
              }`}
              style={{ fontSize: '7px', lineHeight: '1.6' }}
            >
              {msg.thinking ? (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-vizta-thinking" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-vizta-thinking" style={{ animationDelay: '0.3s' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-vizta-thinking" style={{ animationDelay: '0.6s' }} />
                  <span className="ml-1 text-slate-500" style={{ fontSize: '6px' }}>Vizta pensando...</span>
                </div>
              ) : (
                <>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</div>
                  {msg.steps !== undefined && msg.latencyMs !== undefined && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-600/50 flex items-center gap-2 text-slate-500" style={{ fontSize: '5px' }}>
                      <span>⚡ {msg.steps} pasos</span>
                      <span>•</span>
                      <span>⏱ {(msg.latencyMs / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {/* Error display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
            <div className="font-pixel text-red-400" style={{ fontSize: '6px' }}>Error: {error}</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2" style={{ backgroundColor: '#0a0f1e', borderTop: '2px solid #1e293b' }}>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregúntale a Vizta..."
            className="flex-1 text-white placeholder-slate-500 px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:ring-1 focus:border-blue-500 font-pixel"
            style={{ backgroundColor: '#1e293b', fontSize: '7px' }}
            disabled={isThinking}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="p-2 bg-blue-600 text-white rounded-lg disabled:opacity-40 hover:bg-blue-500 transition-colors cursor-pointer flex-shrink-0"
          >
            {isThinking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <div className="mt-1 font-pixel text-slate-600 text-center" style={{ fontSize: '5px' }}>
          Powered by Vizta AI • Enter para enviar
        </div>
      </div>
    </div>
  );
};

export default PixelAgentChat;
