import { useState, useCallback, useMemo } from 'react';
import { Users, Gamepad2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import PixelBuildingFloor from '../components/pixel/PixelBuildingFloor';
import PixelAgentChat from '../components/pixel/PixelAgentChat';
import type { PixelAgentData } from '../components/pixel/PixelCharacter';
import { floor1Agents, floor2Agents, floor3Agents, floorConfigs } from '../components/pixel/pixelAgentData';

const allAgents = [...floor1Agents, ...floor2Agents, ...floor3Agents];

export function PixelNewsroom() {
  const [currentFloor, setCurrentFloor] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<PixelAgentData | null>(null);
  const [queryCount, setQueryCount] = useState(0);

  const handleAgentClick = useCallback((agent: PixelAgentData) => {
    setSelectedAgent(agent);
  }, []);

  const handleQueryComplete = useCallback(() => {
    setQueryCount(prev => prev + 1);
  }, []);

  const activeFloor = useMemo(
    () => floorConfigs.find(f => f.floorNumber === currentFloor)!,
    [currentFloor]
  );

  const floorButtons = [
    { floor: 1, label: 'Central' },
    { floor: 2, label: 'Digital' },
    { floor: 3, label: 'Dirección' },
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-950">
      {/* Pixel HUD - Top */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          backgroundColor: '#0a0f1e',
          borderBottom: '3px solid #1e3a5f',
          boxShadow: 'inset 0 -1px 0 rgba(59,130,246,0.15)',
        }}
      >
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-4 h-4 text-yellow-400" />
          <span className="font-pixel text-yellow-400" style={{ fontSize: '8px', letterSpacing: '0.05em' }}>
            VIZTA PIXEL MODE
          </span>
          <span className="font-pixel text-slate-500" style={{ fontSize: '6px' }}>
            SALA DE INVESTIGACIÓN IA
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: '#1e293b' }}>
            <Users className="w-3 h-3 text-yellow-400" />
            <span className="font-pixel text-yellow-400" style={{ fontSize: '6px' }}>
              {allAgents.length} agentes
            </span>
          </div>

          {queryCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: '#1e3a1e' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="font-pixel text-green-400" style={{ fontSize: '6px' }}>
                {queryCount} {queryCount === 1 ? 'consulta' : 'consultas'}
              </span>
            </div>
          )}

          {selectedAgent && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: '#1e293b', border: '1px solid #3b82f6' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="font-pixel text-blue-400" style={{ fontSize: '6px' }}>
                Hablando con {selectedAgent.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Building / Game area */}
        <div
          className={`flex flex-col transition-all duration-300 ${
            selectedAgent ? 'flex-1' : 'w-full'
          }`}
          style={{ minWidth: selectedAgent ? '55%' : '100%' }}
        >
          {/* Hint text */}
          {!selectedAgent && (
            <div className="text-center py-2 flex-shrink-0">
              <span className="font-pixel text-slate-500" style={{ fontSize: '7px' }}>
                👆 Haz click en un agente para chatear con Vizta IA
              </span>
            </div>
          )}

          {/* Floor view */}
          <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
            <div className="w-full max-w-3xl">
              <PixelBuildingFloor
                floorNumber={activeFloor.floorNumber}
                label={activeFloor.label}
                wallColor={activeFloor.wallColor}
                floorColor={activeFloor.floorColor}
                floorType={activeFloor.floorType}
                agents={activeFloor.agents}
                selectedAgentId={selectedAgent?.id}
                onAgentClick={handleAgentClick}
              />
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {selectedAgent && (
          <div
            className="flex-shrink-0 flex flex-col"
            style={{ width: '380px', borderLeft: '2px solid #1e293b' }}
          >
            <PixelAgentChat
              key={selectedAgent.id}
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
              onQueryComplete={handleQueryComplete}
            />
          </div>
        )}
      </div>

      {/* Pixel HUD - Bottom (floor selector) */}
      <div
        className="flex items-center justify-center gap-2 px-4 py-2 flex-shrink-0"
        style={{
          backgroundColor: '#0a0f1e',
          borderTop: '3px solid #1e3a5f',
          boxShadow: 'inset 0 1px 0 rgba(59,130,246,0.15)',
        }}
      >
        <span className="font-pixel text-slate-500 mr-2" style={{ fontSize: '6px' }}>PISO:</span>
        {floorButtons.map(({ floor, label }) => (
          <button
            key={floor}
            onClick={() => setCurrentFloor(floor)}
            className="font-pixel px-3 py-1.5 rounded cursor-pointer transition-all"
            style={{
              fontSize: '7px',
              backgroundColor: currentFloor === floor ? '#3b82f6' : '#1e293b',
              color: currentFloor === floor ? 'white' : '#94a3b8',
              border: currentFloor === floor ? '1px solid #60a5fa' : '1px solid #334155',
              boxShadow: currentFloor === floor ? '0 0 8px rgba(59,130,246,0.4)' : 'none',
            }}
          >
            P{floor} {label}
          </button>
        ))}

        <div className="ml-4 border-l border-slate-700 pl-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 font-pixel text-slate-400 hover:text-white transition-colors"
            style={{ fontSize: '6px' }}
          >
            <ArrowLeft className="w-3 h-3" />
            Explorer
          </Link>
        </div>
      </div>
    </div>
  );
}
