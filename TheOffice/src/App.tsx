import { useEffect, useMemo, useRef, useState } from 'react';

type AgentStatus =
  | 'Disponible'
  | 'Pensando'
  | 'Trabajando'
  | 'Esperando aprobación'
  | 'Bloqueado'
  | 'Terminado'
  | 'Descansando'
  | 'En casa';

interface Agent {
  id: string;
  name: string;
  role: string;
  level: number;
  status: AgentStatus;
  task: string;
  progress: number;
  energy: number;
  focus: number;
  specialty: string;
  shirt: string;
  hair: string;
  skin: string;
  mood: string;
  provider: 'Codex' | 'Claude Code' | 'VPS';
  spriteIndex: number;
}

interface RunEvent {
  event: string;
  status: string;
  activity: string;
  tool: string;
  at: string;
}

interface RuntimeAgent {
  id: string;
  provider: 'Codex' | 'Claude Code' | 'VPS';
  observed: boolean;
  active: boolean;
  status: 'available' | 'thinking' | 'working' | 'waiting_approval' | 'blocked' | 'completed' | 'home';
  phase: string;
  activity: string;
  workspace: string | null;
  lastSeen: string | null;
  signalSource: 'session-log' | 'vps-artifact';
  health?: number;
  cadence?: number;
  events: RunEvent[];
}

const statusTone: Record<AgentStatus, string> = {
  Disponible: 'mint',
  Pensando: 'blue',
  Trabajando: 'amber',
  'Esperando aprobación': 'violet',
  Bloqueado: 'red',
  Terminado: 'mint',
  Descansando: 'blue',
  'En casa': 'muted',
};

const initialAgents: Agent[] = [
  {
    id: 'product-design',
    name: 'Maya',
    role: 'Product & Design',
    level: 3,
    status: 'Disponible',
    task: 'Sin actividad real detectada',
    progress: 0,
    energy: 84,
    focus: 72,
    specialty: 'UX · Producto',
    shirt: '#e96f51',
    hair: '#492e32',
    skin: '#d79a70',
    mood: 'Organizando el moodboard…',
    provider: 'Claude Code',
    spriteIndex: 0,
  },
  {
    id: 'data-analyst',
    name: 'Leo',
    role: 'Data Analyst',
    level: 2,
    status: 'Disponible',
    task: 'Sin actividad real detectada',
    progress: 0,
    energy: 67,
    focus: 91,
    specialty: 'Datos · Sistemas',
    shirt: '#5f8fc4',
    hair: '#282730',
    skin: '#b97855',
    mood: 'Revisando las métricas del día…',
    provider: 'Codex',
    spriteIndex: 1,
  },
  {
    id: 'classifier-worker', name: 'Clara', role: 'Clasificador', level: 4,
    status: 'Disponible', task: 'Esperando señal del VPS', progress: 0, energy: 80, focus: 92,
    specialty: 'Señales · Clasificación', shirt: '#d39b49', hair: '#43322d', skin: '#c98c65',
    mood: 'Leyendo el último resultado…', provider: 'VPS', spriteIndex: 2,
  },
  {
    id: 'legal-worker', name: 'Lex', role: 'Legal Worker', level: 3,
    status: 'Bloqueado', task: 'Monitoreo legal pausado', progress: 0, energy: 24, focus: 68,
    specialty: 'Leyes · Decretos', shirt: '#8d6ab0', hair: '#272934', skin: '#b97959',
    mood: 'La fuente legal está bloqueando el acceso.', provider: 'VPS', spriteIndex: 3,
  },
  {
    id: 'reality-worker', name: 'Rhea', role: 'Reality Worker', level: 4,
    status: 'Disponible', task: 'Esperando señal del VPS', progress: 0, energy: 76, focus: 88,
    specialty: 'Reality · Contexto', shirt: '#ba6655', hair: '#29282e', skin: '#d29a70',
    mood: 'Contrastando el estado del mundo…', provider: 'VPS', spriteIndex: 4,
  },
  {
    id: 'media-worker', name: 'Milo', role: 'Media Worker', level: 5,
    status: 'Disponible', task: 'Agregando canales de medios', progress: 0, energy: 86, focus: 84,
    specialty: 'Cards · Tweets · Feeds', shirt: '#4c9a91', hair: '#303038', skin: '#a96f51',
    mood: 'Vigilando perfiles, feeds y horarios…', provider: 'VPS', spriteIndex: 5,
  },
  {
    id: 'manager-agent', name: 'Director', role: 'Operations Manager', level: 7,
    status: 'Disponible', task: 'Esperando consolidación directiva', progress: 0, energy: 90, focus: 95,
    specialty: 'Dirección · Operaciones', shirt: '#354e67', hair: '#202229', skin: '#c58b65',
    mood: 'Consolidando el pulso de la oficina…', provider: 'VPS', spriteIndex: 1,
  },
];

const observedStatus: Record<RuntimeAgent['status'], AgentStatus> = {
  available: 'Disponible',
  thinking: 'Pensando',
  working: 'Trabajando',
  waiting_approval: 'Esperando aprobación',
  blocked: 'Bloqueado',
  completed: 'Terminado',
  home: 'En casa',
};

function PixelIcon({ children }: { children: string }) {
  return <span className="pixel-icon" aria-hidden="true">{children}</span>;
}

function AgentSprite({ agent, compact = false }: { agent: Agent; compact?: boolean }) {
  const sleeping = agent.status === 'En casa';
  const action = agent.status === 'Trabajando' || agent.status === 'Esperando aprobación'
    ? 'typing'
    : agent.status === 'Pensando'
      ? 'reading'
      : agent.status === 'Disponible' || agent.status === 'Descansando'
        ? 'walking'
        : 'idle';
  return (
    <div
      className={`agent-sprite sprite-${action} state-${statusTone[agent.status]} ${sleeping ? 'sprite-away' : ''} ${compact ? 'sprite-compact' : ''}`}
      style={{
        '--sprite-url': `url('/assets/pixel-agents/characters/char_${agent.spriteIndex}.png')`,
      } as React.CSSProperties}
      aria-label={`${agent.name}, ${agent.status}`}
    >
      {agent.status === 'Pensando' && <div className="thought-bubble"><i /><i /><span>?</span></div>}
      {agent.status === 'Bloqueado' && <div className="alert-bubble">!</div>}
      {agent.status === 'Esperando aprobación' && <div className="approval-bubble">…</div>}
      {agent.status === 'Terminado' && <div className="done-bubble">✓</div>}
      <div className="agent-shadow" />
      <div className="agent-sheet" />
    </div>
  );
}

const agentPosition = (agent: Agent): number => {
  if (agent.status === 'Descansando') return agent.id === 'product-design' ? 49 : 54;
  if (agent.status === 'En casa') return 92;
  if (agent.status === 'Disponible' || agent.status === 'Terminado') return agent.id === 'product-design' ? 39 : 62;
  if (agent.status === 'Esperando aprobación') return 47;
  return agent.id === 'product-design' ? 23 : 72;
};

function GameFloor({ agents, selectedId, realActivityCount, onSelect }: {
  agents: Agent[];
  selectedId: string;
  realActivityCount: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="game-floor" aria-label="Planta principal de The Office">
      <div className="game-wall game-wall-design"><div className="wall-grid" /></div>
      <div className="game-wall game-wall-common"><div className="wall-grid" /></div>
      <div className="game-wall game-wall-data"><div className="wall-grid" /></div>
      <div className="room-beam beam-one" /><div className="room-beam beam-two" />

      <div className="rpg-zone-label design-zone">PRODUCT LAB</div>
      <div className="rpg-zone-label common-zone">COMMONS</div>
      <div className="rpg-zone-label data-zone">DATA LAB</div>

      <div className="wide-window window-left"><i /><span /><b /></div>
      <div className="wide-window window-right"><i /><span /><b /></div>
      <div className="pixel-poster poster-left"><i />MAKE<br />IT HUMAN</div>
      <div className="pixel-poster poster-right"><i />SHIP<br />CLEAN DATA</div>

      <div className="workstation station-design"><Desk variant="design" /><div className="office-chair"><i /></div></div>
      <div className="workstation station-data"><Desk variant="data" /><div className="office-chair"><i /></div></div>

      <div className="coffee-station"><div className="coffee-machine"><i /><b /><span /></div><small>COFFEE<br />+15 EN</small></div>
      <div className="break-sofa"><i /><i /><span /></div>
      <div className="snack-table"><i /><span /></div>
      <div className="office-plant plant-left"><i /><i /><i /><span /></div>
      <div className="office-plant plant-right"><i /><i /><i /><span /></div>
      <div className="floor-server"><i /><i /><i /><span>●</span></div>

      <div className="exit-door"><span>EXIT</span><div><i /><i /></div></div>
      <div className="tiny-cat"><i /><span /></div>

      <div className="walkway"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      {agents.map(agent => (
        <button
          key={agent.id}
          className={`game-agent ${selectedId === agent.id ? 'selected' : ''} ${agent.status === 'En casa' ? 'leaving' : ''}`}
          style={{ '--agent-position': `${agentPosition(agent)}%` } as React.CSSProperties}
          onClick={() => onSelect(agent.id)}
          aria-label={`Seleccionar a ${agent.name}`}
        >
          <span className="agent-speech">{agent.mood}</span>
          <AgentSprite agent={agent} />
          <span className="agent-game-tag"><i className={`tone-${statusTone[agent.status]}`} />{agent.name}<small>LV.{agent.level}</small></span>
        </button>
      ))}
      <div className="game-hint">
        <span>{realActivityCount ? `${realActivityCount} SEÑAL${realActivityCount > 1 ? 'ES' : ''} REAL${realActivityCount > 1 ? 'ES' : ''}` : 'VIDA SIMULADA'}</span>
        <i>{realActivityCount ? 'La actividad externa dirige la oficina' : 'Rutinas locales · sin consumo de modelo'}</i>
      </div>
    </div>
  );
}

function OperationsFloor({ agents, selectedId, onSelect }: {
  agents: Agent[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="operations-floor" aria-label="Planta 02, operaciones del VPS">
      <div className="floor-caption"><span>02</span><strong>VPS · OPERATIONS</strong><i>RESULT SIGNALS</i></div>
      <div className="ops-window"><i /><i /><i /><i /></div>
      <div className="ops-cable" />
      {agents.map((agent, index) => (
        <button
          key={agent.id}
          className={`ops-agent ops-${index + 1} ${selectedId === agent.id ? 'selected' : ''}`}
          onClick={() => onSelect(agent.id)}
          aria-label={`Seleccionar a ${agent.name}`}
        >
          <span className="ops-monitor"><i /><i /><b className={`tone-${statusTone[agent.status]}`} /></span>
          <span className="ops-desk" />
          <AgentSprite agent={agent} />
          <span className="ops-tag"><i className={`tone-${statusTone[agent.status]}`} />{agent.role}<small>{agent.status}</small></span>
          <span className="agent-speech">{agent.mood}</span>
        </button>
      ))}
      <div className="server-rack"><span>VPS</span><i /><i /><i /><b /></div>
    </section>
  );
}

function ManagerFloor({ agent, selected, onSelect }: { agent: Agent; selected: boolean; onSelect: () => void }) {
  return (
    <section className="manager-floor" aria-label="Planta 03, oficina del Director">
      <div className="floor-caption"><span>03</span><strong>DIRECTOR'S OFFICE</strong><i>OVERVIEW</i></div>
      <div className="director-board"><i /><i /><i /><span>OPS</span></div>
      <div className="director-library"><i /><i /><i /><i /></div>
      <button className={`manager-agent ${selected ? 'selected' : ''}`} onClick={onSelect} aria-label={`Seleccionar a ${agent.name}`}>
        <div className="manager-desk"><i /><span /></div>
        <AgentSprite agent={agent} />
        <span className="manager-tag"><i className={`tone-${statusTone[agent.status]}`} />{agent.name}<small>{agent.status}</small></span>
        <span className="agent-speech">{agent.mood}</span>
      </button>
      <div className="director-plant"><i /><i /><span /></div>
    </section>
  );
}

function Desk({ variant }: { variant: 'design' | 'data' }) {
  return (
    <div className={`desk desk-${variant}`} aria-hidden="true">
      <div className="desk-lamp"><i /><span /></div>
      <div className="monitor">
        <div className="monitor-screen">
          {variant === 'design' ? (
            <><i className="ui-card" /><i className="ui-dot" /><i className="ui-line" /></>
          ) : (
            <><i className="chart-bar b1" /><i className="chart-bar b2" /><i className="chart-bar b3" /><i className="chart-line" /></>
          )}
        </div>
        <div className="monitor-neck" />
      </div>
      <div className="mug" />
      <div className="desk-top" />
      <div className="desk-drawers"><i /><i /></div>
      <div className="desk-leg" />
    </div>
  );
}

function OfficeRoom({ agent, variant, selected, onSelect }: {
  agent: Agent;
  variant: 'design' | 'data';
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`office-room room-${variant} ${selected ? 'room-selected' : ''}`} onClick={onSelect}>
      <div className="room-wall-grid" />
      <div className="window"><i /><span className="city-light l1" /><span className="city-light l2" /><span className="city-light l3" /></div>
      <div className="wall-frame">
        {variant === 'design' ? <><i className="poster-circle" /><span>MAKE<br />IT CLEAR</span></> : <><i className="poster-grid" /><span>DATA<br />MOVES</span></>}
      </div>
      <div className="shelf"><i /><i /><i /></div>
      <div className="plant"><i /><i /><i /><span /></div>
      <Desk variant={variant} />
      <AgentSprite agent={agent} />
      <div className="room-label">
        <span className={`status-dot tone-${statusTone[agent.status]}`} />
        <strong>{agent.name}</strong>
        <small>{agent.status}</small>
      </div>
      <div className="floor-texture" />
    </button>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="meter">
      <div><span>{label}</span><b>{value}%</b></div>
      <div className="meter-track"><i style={{ width: `${value}%`, background: color }} /></div>
    </div>
  );
}

export function App() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [selectedId, setSelectedId] = useState('product-design');
  const [time, setTime] = useState(new Date(2026, 8, 14, 20, 42));
  const [panel, setPanel] = useState<'office' | 'tasks' | 'team'>('office');
  const [expansionOpen, setExpansionOpen] = useState(false);
  const [toast, setToast] = useState('Turno nocturno iniciado');
  const [simulationRunning, setSimulationRunning] = useState(true);
  const [gameSpeed, setGameSpeed] = useState<1 | 2>(1);
  const [runtimeAgents, setRuntimeAgents] = useState<RuntimeAgent[]>([]);
  const runtimeAgentsRef = useRef<RuntimeAgent[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(value => new Date(value.getTime() + 60_000)), 4000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!simulationRunning) return;
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      setAgents(current => current.map(agent => {
        if (agent.provider === 'VPS') return agent;
        const observed = runtimeAgentsRef.current.find(candidate => candidate.id === agent.id);
        if (observed?.observed && observed.status !== 'available') {
          return {
            ...agent,
            progress: Math.min(92, agent.progress + gameSpeed * 2),
            energy: Math.max(0, agent.energy - gameSpeed),
          };
        }
        const routineIndex = (tick + (agent.id === 'data-analyst' ? 2 : 0)) % 5;
        if (routineIndex === 1) return { ...agent, status: 'Descansando', task: 'Vida simulada', mood: 'Voy por un café.', energy: Math.min(100, agent.energy + 3) };
        if (routineIndex === 3) return { ...agent, status: 'Disponible', task: 'Vida simulada', mood: agent.id === 'data-analyst' ? 'Revisando las métricas del día…' : 'Organizando el moodboard…' };
        if (routineIndex === 4) return { ...agent, status: 'Disponible', task: 'Vida simulada', mood: 'Dando una vuelta por la oficina.' };
        return { ...agent, status: 'Disponible', task: 'Vida simulada' };
      }));
    }, 6500 / gameSpeed);
    return () => window.clearInterval(timer);
  }, [simulationRunning, gameSpeed]);

  useEffect(() => {
    let active = true;
    const syncAgents = async () => {
      try {
        const response = await fetch('/api/agents', { cache: 'no-store' });
        if (!response.ok) throw new Error('Agent server unavailable');
        const payload = await response.json() as { agents: RuntimeAgent[] };
        if (!active) return;
        setBackendConnected(true);
        setRuntimeAgents(payload.agents);
        runtimeAgentsRef.current = payload.agents;
        setAgents(current => current.map(agent => {
          const live = payload.agents.find(candidate => candidate.id === agent.id);
          if (!live || (!live.observed && live.status === 'available')) return agent;
          return {
            ...agent,
            status: observedStatus[live.status],
            task: live.provider === 'VPS' ? live.activity : live.workspace ? `Actividad en ${live.workspace}` : 'Actividad real detectada',
            progress: live.provider === 'VPS' ? (live.health ?? 0) : live.active ? Math.max(8, agent.progress) : live.status === 'completed' ? 100 : agent.progress,
            energy: live.provider === 'VPS' ? (live.health ?? agent.energy) : agent.energy,
            focus: live.provider === 'VPS' ? (live.cadence ?? agent.focus) : agent.focus,
            mood: live.activity,
          };
        }));
      } catch {
        if (active) setBackendConnected(false);
      }
    };
    void syncAgents();
    const timer = window.setInterval(syncAgents, 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const selected = useMemo(
    () => agents.find(agent => agent.id === selectedId) ?? agents[0],
    [agents, selectedId],
  );
  const selectedRuntime = runtimeAgents.find(agent => agent.id === selected.id) ?? null;
  const selectedHasRealSignal = Boolean(selectedRuntime?.observed && selectedRuntime.status !== 'available');
  const isVpsAgent = selected.provider === 'VPS';
  const localAgents = agents.filter(agent => agent.provider !== 'VPS');
  const operationsAgents = agents.filter(agent => ['classifier-worker', 'legal-worker', 'reality-worker', 'media-worker'].includes(agent.id));
  const manager = agents.find(agent => agent.id === 'manager-agent') ?? agents[0];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><i /><span>THE</span><strong>OFFICE</strong><em>α</em></div>
        <div className="company-status"><span className="live-dot" /> OFICINA EN LÍNEA <small>· CICLO 01</small></div>
        <div className="top-resources">
          <div><PixelIcon>¤</PixelIcon><span>CRÉDITOS</span><strong>12,480</strong></div>
          <div><PixelIcon>◆</PixelIcon><span>REPUTACIÓN</span><strong>128</strong></div>
          <div className="clock"><span>LUN · 14 SEP</span><strong>{time.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</strong></div>
        </div>
      </header>

      <aside className="sidebar" aria-label="Navegación principal">
        <nav>
          {[
            ['office', '▦', 'Oficina'],
            ['tasks', '≡', 'Tareas'],
            ['team', '♟', 'Equipo'],
          ].map(([id, icon, label]) => (
            <button key={id} className={panel === id ? 'active' : ''} onClick={() => setPanel(id as typeof panel)}>
              <PixelIcon>{icon}</PixelIcon><span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="settings-button"><PixelIcon>⚙</PixelIcon><span>Ajustes</span></button>
      </aside>

      <section className="world">
        <div className="sky-stars"><i /><i /><i /><i /><i /><i /></div>
        <div className="moon" />
        <div className="city city-back"><i /><i /><i /><i /><i /><i /></div>
        <div className="city city-front"><i /><i /><i /><i /><i /></div>

        <div className="world-heading">
          <div><span>SEDE CENTRAL</span><h1>La oficina</h1></div>
          <div className="game-controls">
            <button className="sim-control" onClick={() => setSimulationRunning(value => !value)}>{simulationRunning ? 'Ⅱ PAUSA' : '▶ JUGAR'}</button>
            <button className="sim-speed" onClick={() => setGameSpeed(value => value === 1 ? 2 : 1)}>×{gameSpeed}</button>
            <button className="expand-button" onClick={() => setExpansionOpen(true)}><PixelIcon>＋</PixelIcon> EXPANDIR</button>
          </div>
        </div>

        <div className="building-wrap">
          <div className="antenna"><i /><i /><span /></div>
          <div className="building">
            <div className="building-roof"><span>THE OFFICE</span><i /><i /><i /></div>
            <ManagerFloor agent={manager} selected={selectedId === manager.id} onSelect={() => setSelectedId(manager.id)} />
            <div className="floor-divider"><span>03</span><i /></div>
            <OperationsFloor agents={operationsAgents} selectedId={selectedId} onSelect={setSelectedId} />
            <div className="floor-divider"><span>01</span><i /></div>
            <GameFloor
              agents={localAgents}
              selectedId={selectedId}
              realActivityCount={runtimeAgents.filter(agent => agent.observed && agent.status !== 'available').length}
              onSelect={setSelectedId}
            />
            <div className="foundation"><i /><i /><i /><i /><i /></div>
          </div>
        </div>

        <div className="street"><div className="street-line" /><div className="hydrant" /><div className="street-sign">NIGHT<br />SHIFT</div></div>
      </section>

      <aside className="control-panel">
        <div className="panel-kicker"><span>OBSERVADOR AUTOMÁTICO</span><i className={backendConnected ? '' : 'offline'}>● {backendConnected ? 'OBSERVANDO' : 'SIN PUENTE'}</i></div>
        <div className="agent-profile">
          <div className="portrait"><AgentSprite agent={selected} compact /></div>
          <div><span>{selected.specialty}</span><h2>{selected.name}</h2><p>{selected.role}</p><b className={`provider-badge provider-${selected.provider === 'Codex' ? 'codex' : selected.provider === 'VPS' ? 'vps' : 'claude'}`}>{selected.provider}</b></div>
          <button aria-label="Más opciones">•••</button>
        </div>
        <div className={`status-pill tone-${statusTone[selected.status]}`}><i /> {selected.status.toUpperCase()}</div>
        <div className="agent-dialogue"><span>“</span>{selected.mood}</div>

        <section className="current-task">
          <div className="section-title"><span>{isVpsAgent ? 'ÚLTIMO RESULTADO' : 'SEÑAL ACTUAL'}</span><b>{isVpsAgent ? 'VPS' : selectedHasRealSignal ? 'REAL' : 'SIMULADA'}</b></div>
          <h3>{selected.task}</h3>
          <div className="progress-meta"><span>{isVpsAgent ? 'Frescura de evidencia' : 'Pulso de actividad'}</span><strong>{isVpsAgent ? `${selectedRuntime?.health ?? 0}%` : selectedRuntime?.active ? 'EN VIVO' : 'IDLE'}</strong></div>
          <div className={`block-progress ${selectedRuntime?.active ? 'signal-live' : ''}`}><i style={{ width: isVpsAgent ? `${selectedRuntime?.health ?? 0}%` : selectedRuntime?.active ? '100%' : '24%' }} /></div>
          <div className="task-time"><span>FASE · {(selectedRuntime?.phase ?? 'simulated').toUpperCase()}</span><span>{selected.provider.toUpperCase()}</span></div>
        </section>

        <section className="agent-vitals">
          <Meter label={isVpsAgent ? 'SALUD' : 'ENERGÍA'} value={selected.energy} color="#f1c75b" />
          <Meter label={isVpsAgent ? 'CADENCIA' : 'ENFOQUE'} value={selected.focus} color="#63c9b6" />
        </section>

        <section className="observer-panel">
          <div className="section-title"><span>ORIGEN DE ACTIVIDAD</span></div>
          <div className="observer-source">
            <i className={selectedRuntime?.active ? 'source-live' : ''} />
            <div>
              <strong>{selected.provider}</strong>
              <span>{isVpsAgent ? selectedRuntime?.observed ? 'Artefacto producido en el VPS' : 'VPS sin evidencia disponible' : selectedRuntime?.observed ? 'Registro local detectado · sin hooks' : 'Esperando actividad en el workspace'}</span>
            </div>
          </div>
          <div className="observer-facts">
            <span>MODO</span><b>{isVpsAgent ? 'RESULTADOS DEL VPS' : selectedHasRealSignal ? 'ACTIVIDAD REAL' : 'VIDA SIMULADA'}</b>
            <span>WORKSPACE</span><b>{selectedRuntime?.workspace ?? '—'}</b>
            <span>ÚLTIMA SEÑAL</span><b>{selectedRuntime?.lastSeen ? new Date(selectedRuntime.lastSeen).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—'}</b>
          </div>
        </section>

        <section className="activity-log">
          <div className="section-title"><span>BITÁCORA</span><i /></div>
          {selectedRuntime?.events.length ? selectedRuntime.events.slice(-4).reverse().map((event, index) => (
            <div key={`${event.at}-${index}`}>
              <i className={`log-icon ${event.status === 'blocked' ? 'red' : event.status === 'completed' ? 'mint' : 'amber'}`}>{event.status === 'blocked' ? '!' : event.status === 'completed' ? '✓' : '↗'}</i>
              <p><strong>{event.activity}</strong><span>{event.event} · {new Date(event.at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span></p>
            </div>
          )) : <>
            <div><i className="log-icon amber">↗</i><p><strong>Esperando actividad externa</strong><span>{selected.provider}</span></p></div>
            <div><i className="log-icon mint">✓</i><p><strong>Vida simulada activa</strong><span>Sin consumo de modelo</span></p></div>
          </>}
        </section>
      </aside>

      {toast && <div className="toast"><i>✓</i>{toast}</div>}

      {expansionOpen && (
        <div className="modal-backdrop" onMouseDown={() => setExpansionOpen(false)}>
          <section className="expansion-modal" role="dialog" aria-modal="true" aria-labelledby="expansion-title" onMouseDown={event => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setExpansionOpen(false)}>×</button>
            <span className="modal-kicker">PRÓXIMA EXPANSIÓN</span>
            <h2 id="expansion-title">La oficina está creciendo.</h2>
            <p>Desbloquea una nueva planta para añadir espacios y contratar más agentes.</p>
            <div className="room-cards">
              <article><div className="room-preview preview-lounge">☕</div><span>SALA DE DESCANSO</span><strong>Mejora la energía</strong></article>
              <article><div className="room-preview preview-desk">⌘</div><span>NUEVO DEPARTAMENTO</span><strong>+2 agentes</strong></article>
            </div>
            <div className="expansion-cost"><span>COSTE DE CONSTRUCCIÓN</span><strong>¤ 25,000</strong></div>
            <button className="locked-cta" onClick={() => setToast('Aún necesitas 12,520 créditos')}>REUNIR RECURSOS · 50%</button>
          </section>
        </div>
      )}
    </main>
  );
}
