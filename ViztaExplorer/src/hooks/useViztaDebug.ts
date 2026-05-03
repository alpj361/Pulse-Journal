import { useState, useCallback } from 'react';
import type { ViztaDebugResponse, DebugStep, HistoryEntry } from '../types/vizta';
import { executeDebugQuery } from '../services/viztaDebug';
import { supabase } from '../lib/supabase';

interface UseViztaDebugState {
  loading: boolean;
  error: string | null;
  response: ViztaDebugResponse | null;
  selectedStep: DebugStep | null;
  history: HistoryEntry[];
}

export function useViztaDebug() {
  const [state, setState] = useState<UseViztaDebugState>({
    loading: false,
    error: null,
    response: null,
    selectedStep: null,
    history: [],
  });

  const executeQuery = useCallback(async (message: string, options?: { useCodex?: boolean }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let codexItemIds: string[] | undefined;

      if (options?.useCodex) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: codexItems } = await supabase
            .from('codex_items')
            .select('id')
            .eq('user_id', session.user.id);
          if (codexItems && codexItems.length > 0) {
            codexItemIds = codexItems.map((item: { id: string }) => item.id);
          }
        }
      }

      const response = await executeDebugQuery(message, undefined, undefined, codexItemIds);

      const historyEntry: HistoryEntry = {
        id: `hist-${Date.now()}`,
        query: message,
        timestamp: new Date().toISOString(),
        response,
      };

      setState(prev => ({
        ...prev,
        loading: false,
        response,
        selectedStep: response.steps[0] || null,
        history: [historyEntry, ...prev.history].slice(0, 50), // Keep last 50 entries
      }));

      // Save to localStorage
      try {
        const savedHistory = JSON.parse(localStorage.getItem('viztaExplorerHistory') || '[]');
        const newHistory = [historyEntry, ...savedHistory].slice(0, 50);
        localStorage.setItem('viztaExplorerHistory', JSON.stringify(newHistory));
      } catch {
        console.warn('Failed to save history to localStorage');
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw err;
    }
  }, []);

  const selectStep = useCallback((step: DebugStep | null) => {
    setState(prev => ({ ...prev, selectedStep: step }));
  }, []);

  const loadHistoryEntry = useCallback((entry: HistoryEntry) => {
    setState(prev => ({
      ...prev,
      response: entry.response,
      selectedStep: entry.response.steps[0] || null,
    }));
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({ ...prev, history: [] }));
    localStorage.removeItem('viztaExplorerHistory');
  }, []);

  const loadSavedHistory = useCallback(() => {
    try {
      const savedHistory = JSON.parse(localStorage.getItem('viztaExplorerHistory') || '[]');
      setState(prev => ({ ...prev, history: savedHistory }));
    } catch {
      console.warn('Failed to load history from localStorage');
    }
  }, []);

  return {
    ...state,
    executeQuery,
    selectStep,
    loadHistoryEntry,
    clearHistory,
    loadSavedHistory,
  };
}
