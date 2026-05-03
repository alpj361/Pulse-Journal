import type {
  ViztaDebugResponse,
  ViztaPromptsResponse,
  ViztaToolsResponse,
  ExperimentConfig,
  ExperimentResult,
} from '../types/vizta';
import { supabase } from '../lib/supabase';

// Use the same endpoint as ThePulse
const API_BASE = '/api/vizta-chat';

/**
 * Get authorization headers with the current session token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

/**
 * Execute a debug query to Vizta
 * Uses the same /query endpoint as ThePulse but with debug: true
 */
export async function executeDebugQuery(
  message: string,
  sessionId?: string,
  context?: object,
  codexItemIds?: string[]
): Promise<ViztaDebugResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      sessionId,
      context,
      debug: true, // Enable debug mode to get step-by-step data
      ...(codexItemIds && codexItemIds.length > 0 && { codex_item_ids: codexItemIds }),
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('No autorizado. Por favor inicia sesion.');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to execute query');
  }

  const data = await response.json();
  // The debug info is in the response.debug field
  return data.debug || data;
}

/**
 * Get all Vizta system prompts
 */
export async function getPrompts(): Promise<ViztaPromptsResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/prompts`, { headers });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('No autorizado. Por favor inicia sesion.');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch prompts');
  }

  const data = await response.json();
  return data.prompts;
}

/**
 * Update a specific Vizta system prompt
 */
export async function updatePrompt(
  promptKey: string,
  content: string
): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/prompts`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      promptKey,
      content,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('No autorizado. Por favor inicia sesion.');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to update prompt');
  }

  return response.json();
}

/**
 * Get all available Vizta tools
 * Uses /tools-info endpoint which provides detailed tool information
 */
export async function getTools(): Promise<ViztaToolsResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/tools-info`, { headers });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('No autorizado. Por favor inicia sesion.');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch tools');
  }

  return response.json();
}

/**
 * Run an experiment with custom overrides
 * Uses /query with debug mode and experiment configuration
 */
export async function runExperiment(
  config: ExperimentConfig
): Promise<ExperimentResult> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: config.query,
      debug: true,
      experiment: true,
      overrides: config.overrides,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('No autorizado. Por favor inicia sesion.');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to run experiment');
  }

  const data = await response.json();
  return {
    experimentId: `exp-${Date.now()}`,
    config,
    ...(data.debug || data),
  };
}

/**
 * Execute a single tool directly
 * Uses /execute-tool endpoint for testing individual tools
 */
export async function executeTool(
  toolName: string,
  parameters: object
): Promise<{ success: boolean; result: object; latencyMs: number }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/execute-tool`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      toolName,
      parameters,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('No autorizado. Por favor inicia sesion.');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to execute tool');
  }

  return response.json();
}

/**
 * Health check for the Vizta Chat API
 */
export async function healthCheck(): Promise<{
  success: boolean;
  status: string;
  version: string;
}> {
  // Health check doesn't need auth
  const response = await fetch('/health');

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}
