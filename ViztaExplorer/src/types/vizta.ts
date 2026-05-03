export type StepType = 'intent' | 'planning' | 'tool' | 'synthesis' | 'memory';

export interface IntentResult {
  intent: string;
  confidence: number;
  reasoning: string;
}

export interface PlanPhase {
  phase: number;
  name: string;
  tools: string[];
  purpose: string;
}

export interface Plan {
  phases: PlanPhase[];
  synthesis: string;
  sourceStrategy: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
  }>;
  examples?: string[];
}

export interface DebugStep {
  id: string;
  name: string;
  type: StepType;
  timestamp: string;
  latencyMs: number;

  // For intent steps
  prompt?: string;
  rawResponse?: string;
  result?: IntentResult;

  // For planning steps
  systemPrompt?: string;
  payload?: object;
  plan?: Plan;

  // For tool steps
  toolName?: string;
  parameters?: object;
  reason?: string;
  output?: object;
  error?: string;

  // For synthesis steps
  synthesisPrompt?: string;
  finalMessage?: string;
  sources?: object[];

  // For memory steps
  memoryQuery?: string;
  memoryResults?: object[];
}

export interface QueryInfo {
  original: string;
  enhanced?: string;
  aliases?: object;
}

export interface ViztaDebugResponse {
  query: QueryInfo;
  steps: DebugStep[];
  metadata: {
    totalLatencyMs: number;
    toolsUsed: string[];
    model: string;
    tokensUsed?: number;
  };
  finalResponse?: string;
}

export interface ViztaPromptsResponse {
  systemPrompt: string;
  synthesisPrompt: string;
  intentPrompt: string;
  plannerPrompts: Record<string, string>;
  metadata?: {
    model?: string;
    synthesisModel?: string;
  };
}

export interface ViztaToolsResponse {
  tools: ToolInfo[];
  stats?: Record<string, {
    callCount: number;
    avgLatencyMs: number;
    successRate: number;
  }>;
}

export interface ExperimentConfig {
  query: string;
  overrides?: {
    systemPrompt?: string;
    synthesisPrompt?: string;
    temperature?: number;
    model?: string;
  };
}

export interface ExperimentResult extends ViztaDebugResponse {
  experimentId: string;
  config: ExperimentConfig;
}

export interface HistoryEntry {
  id: string;
  query: string;
  timestamp: string;
  response: ViztaDebugResponse;
}
