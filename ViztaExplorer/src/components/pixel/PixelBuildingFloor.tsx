import PixelCharacter, { type PixelAgentData } from './PixelCharacter';

interface FloorConfig {
  floorNumber: number;
  label: string;
  wallColor: string;
  floorColor: string;
  floorType: 'wood' | 'tile' | 'carpet';
  agents: PixelAgentData[];
  selectedAgentId?: string;
  onAgentClick: (agent: PixelAgentData) => void;
}

// Simple pixel furniture pieces
const Desk = ({ x, y }: { x: number; y: number }) => (
  <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, zIndex: 5 }}>
    <div style={{ width: '40px', height: '20px', backgroundColor: 'hsl(25, 45%, 38%)', borderRadius: '2px', boxShadow: '0 3px 0 hsl(20, 40%, 28%)' }}>
      <div style={{ width: '100%', height: '4px', backgroundColor: 'hsl(28, 40%, 52%)', borderRadius: '2px 2px 0 0' }} />
    </div>
  </div>
);

const Computer = ({ x, y }: { x: number; y: number }) => (
  <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, zIndex: 6 }}>
    <div style={{ width: '20px', height: '14px', backgroundColor: '#1e293b', borderRadius: '2px', border: '1px solid #334155' }}>
      <div className="animate-screen-flicker" style={{ margin: '2px', width: '16px', height: '10px', backgroundColor: '#0ea5e9', borderRadius: '1px', opacity: 0.85 }}>
        <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(255,255,255,0.3)', marginTop: '2px' }} />
        <div style={{ width: '70%', height: '1px', backgroundColor: 'rgba(255,255,255,0.2)', marginTop: '1px', marginLeft: '2px' }} />
      </div>
    </div>
    <div style={{ width: '4px', height: '3px', backgroundColor: '#334155', margin: '0 auto' }} />
    <div style={{ width: '10px', height: '2px', backgroundColor: '#475569', margin: '0 auto', borderRadius: '1px' }} />
  </div>
);

const Plant = ({ x, y }: { x: number; y: number }) => (
  <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, zIndex: 6 }}>
    <div style={{ width: '12px', height: '14px', backgroundColor: 'hsl(130, 45%, 35%)', borderRadius: '50% 50% 20% 20%' }}>
      <div style={{ position: 'absolute', top: '2px', left: '3px', width: '6px', height: '8px', backgroundColor: 'hsl(120, 40%, 48%)', borderRadius: '50%' }} />
    </div>
    <div style={{ width: '8px', height: '6px', backgroundColor: 'hsl(25, 50%, 35%)', margin: '0 auto', borderRadius: '0 0 3px 3px' }} />
  </div>
);

const Bookshelf = ({ x, y }: { x: number; y: number }) => (
  <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, zIndex: 6 }}>
    <div style={{ width: '36px', height: '28px', backgroundColor: 'hsl(25, 40%, 32%)', borderRadius: '2px', padding: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {[['#3b82f6', '#ef4444', '#22c55e'], ['#f59e0b', '#8b5cf6', '#06b6d4']].map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: '1px', height: '10px' }}>
          {row.map((c, j) => (
            <div key={j} style={{ flex: 1, backgroundColor: c, borderRadius: '1px', opacity: 0.8 }} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const ServerRack = ({ x, y }: { x: number; y: number }) => (
  <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, zIndex: 6 }}>
    <div style={{ width: '24px', height: '36px', backgroundColor: '#1e293b', borderRadius: '2px', border: '1px solid #334155', padding: '2px' }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ height: '7px', backgroundColor: '#0f172a', borderRadius: '1px', marginBottom: '1px', display: 'flex', alignItems: 'center', paddingLeft: '2px', gap: '2px' }}>
          <div style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: i % 2 === 0 ? '#22c55e' : '#3b82f6' }} className={i === 0 ? 'animate-pulse' : ''} />
          <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
        </div>
      ))}
    </div>
  </div>
);

const renderFloorFurniture = (floorNumber: number) => {
  switch (floorNumber) {
    case 1:
      return (
        <>
          <Desk x={12} y={22} />
          <Computer x={13} y={18} />
          <Desk x={52} y={22} />
          <Computer x={53} y={18} />
          <Plant x={3} y={12} />
          <Plant x={88} y={72} />
          <Bookshelf x={78} y={15} />
        </>
      );
    case 2:
      return (
        <>
          <Desk x={8} y={26} />
          <Computer x={9} y={22} />
          <Desk x={30} y={26} />
          <Computer x={31} y={22} />
          <Desk x={52} y={26} />
          <Computer x={53} y={22} />
          <ServerRack x={74} y={12} />
          <Plant x={3} y={12} />
        </>
      );
    case 3:
      return (
        <>
          <Desk x={16} y={26} />
          <Computer x={17} y={22} />
          <Bookshelf x={5} y={10} />
          <Bookshelf x={38} y={10} />
          <ServerRack x={82} y={18} />
          <Plant x={3} y={14} />
        </>
      );
    default:
      return null;
  }
};

const PixelBuildingFloor = ({
  floorNumber,
  label,
  wallColor,
  floorColor,
  floorType,
  agents,
  selectedAgentId,
  onAgentClick,
}: FloorConfig) => {
  const floorPatternClass = {
    wood: 'floor-wood-pattern',
    tile: 'floor-tile-pattern',
    carpet: '',
  }[floorType];

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '380px' }}>
      {/* Floor surface */}
      <div
        className={`absolute inset-0 ${floorPatternClass}`}
        style={{ backgroundColor: floorColor }}
      />

      {/* Top wall */}
      <div
        className="absolute top-0 left-0 right-0 wall-texture"
        style={{ height: '10%', backgroundColor: wallColor }}
      >
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '6px', backgroundColor: 'rgba(0,0,0,0.15)' }} />
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '2px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
      </div>

      {/* Left wall */}
      <div
        className="absolute top-0 left-0 bottom-0 wall-texture"
        style={{ width: '3%', backgroundColor: wallColor }}
      >
        <div className="absolute top-0 right-0 bottom-0" style={{ width: '3px', backgroundColor: 'rgba(0,0,0,0.1)' }} />
      </div>

      {/* Right wall */}
      <div
        className="absolute top-0 right-0 bottom-0"
        style={{ width: '2%', backgroundColor: wallColor }}
      >
        <div className="absolute top-0 left-0 bottom-0" style={{ width: '2px', backgroundColor: 'rgba(0,0,0,0.08)' }} />
      </div>

      {/* Bottom wall */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '3%', backgroundColor: wallColor }}
      >
        <div className="absolute top-0 left-0 right-0" style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.2)' }} />
      </div>

      {/* Floor label */}
      <div className="absolute top-2 left-5 font-pixel text-slate-600/60 z-30 bg-white/20 px-2 py-0.5 rounded" style={{ fontSize: '5px' }}>
        {label}
      </div>

      {/* Furniture */}
      {renderFloorFurniture(floorNumber)}

      {/* Agent characters */}
      {agents.map((agent) => (
        <PixelCharacter
          key={agent.id}
          character={agent}
          isSelected={selectedAgentId === agent.id}
          onCharacterClick={onAgentClick}
        />
      ))}
    </div>
  );
};

export default PixelBuildingFloor;
