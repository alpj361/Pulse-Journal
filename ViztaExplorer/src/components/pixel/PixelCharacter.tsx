import { useState, useEffect, useCallback } from 'react';

export interface PixelAgentData {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  greeting?: string;
  color: string;
  hairColor: string;
  shirtColor: string;
  startX: number;
  startY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  speed?: number;
  facing?: 'down' | 'up' | 'left' | 'right';
  viztaContext?: string; // Context hint for Vizta queries
}

interface Props {
  character: PixelAgentData;
  isSelected?: boolean;
  onCharacterClick: (character: PixelAgentData) => void;
}

const specialtyIcons: Record<string, string> = {
  data: '📊',
  field: '🔎',
  sources: '📰',
  digital: '💻',
  legal: '⚖️',
  finance: '💰',
  strategy: '🧠',
  archives: '📁',
  vizta: '🤖',
  search: '🔍',
  trending: '📈',
  news: '📡',
};

const PixelCharacter = ({ character, isSelected, onCharacterClick }: Props) => {
  const [x, setX] = useState(character.startX);
  const [y, setY] = useState(character.startY);
  const [facing, setFacing] = useState<'down' | 'up' | 'left' | 'right'>(character.facing || 'down');
  const [walkFrame, setWalkFrame] = useState(0);

  useEffect(() => {
    const speed = character.speed || 0.3;
    let dirX = Math.random() > 0.5 ? 1 : -1;
    let dirY = Math.random() > 0.5 ? 1 : -1;
    let changeTimer = 0;
    const changeInterval = 60 + Math.floor(Math.random() * 80);

    const interval = setInterval(() => {
      changeTimer++;
      if (changeTimer > changeInterval) {
        changeTimer = 0;
        const r = Math.random();
        if (r < 0.3) dirX = -dirX;
        else if (r < 0.6) dirY = -dirY;
        else if (r < 0.8) { dirX = 0; dirY = dirY || 1; }
        else { dirY = 0; dirX = dirX || 1; }
      }

      setX((prev) => {
        let next = prev + dirX * speed;
        if (next >= character.maxX) { dirX = -1; next = character.maxX; }
        if (next <= character.minX) { dirX = 1; next = character.minX; }
        return next;
      });
      setY((prev) => {
        let next = prev + dirY * speed;
        if (next >= character.maxY) { dirY = -1; next = character.maxY; }
        if (next <= character.minY) { dirY = 1; next = character.minY; }
        return next;
      });

      if (Math.abs(dirX) > Math.abs(dirY)) {
        setFacing(dirX > 0 ? 'right' : 'left');
      } else if (dirY !== 0) {
        setFacing(dirY > 0 ? 'down' : 'up');
      }

      setWalkFrame((f) => (f + 1) % 4);
    }, 100);

    return () => clearInterval(interval);
  }, [character.minX, character.maxX, character.minY, character.maxY, character.speed]);

  const handleClick = useCallback(() => {
    onCharacterClick(character);
  }, [character, onCharacterClick]);

  const bobY = walkFrame === 1 || walkFrame === 3 ? -1 : 0;
  const isUp = facing === 'up';
  const icon = specialtyIcons[character.specialty || ''] || '🕵️';

  return (
    <div
      className="absolute cursor-pointer group"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        zIndex: Math.round(y + 10),
        transform: `translateY(${bobY}px)`,
      }}
      onClick={handleClick}
    >
      {/* Selection glow */}
      {isSelected && (
        <div
          className="absolute -inset-2 rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(255,200,50,0.35) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Specialty icon badge */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] z-50">
        {icon}
      </div>

      {/* Hover name tag */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/90 text-yellow-400 px-2 py-0.5 text-[5px] font-pixel whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-slate-600">
        {character.name}
        <div className="text-[4px] text-slate-400 text-center">{character.role}</div>
      </div>

      {/* Character sprite */}
      <div className="relative" style={{ width: '24px', height: '32px' }}>
        {/* Head */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: '20px',
            height: '18px',
            backgroundColor: character.color,
            zIndex: isUp ? 1 : 3,
            boxShadow: isSelected ? '0 0 8px rgba(255,200,50,0.6)' : 'none',
          }}
        >
          {/* Hair */}
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full"
            style={{ width: '22px', height: '12px', backgroundColor: character.hairColor }}
          />
          {/* Shine */}
          <div
            className="absolute top-0 left-2 rounded-full opacity-25"
            style={{ width: '6px', height: '4px', backgroundColor: 'white' }}
          />

          {/* Face (front-facing) */}
          {!isUp && (
            <>
              <div className="absolute flex gap-1.5" style={{ top: '8px', left: '4px' }}>
                <div className="relative" style={{ width: '4px', height: '5px', backgroundColor: '#1e293b', borderRadius: '50%' }}>
                  <div className="absolute top-0.5 left-0.5 bg-white rounded-full" style={{ width: '2px', height: '2px' }} />
                </div>
                <div className="relative" style={{ width: '4px', height: '5px', backgroundColor: '#1e293b', borderRadius: '50%' }}>
                  <div className="absolute top-0.5 left-0.5 bg-white rounded-full" style={{ width: '2px', height: '2px' }} />
                </div>
              </div>
              <div
                className="absolute"
                style={{ bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '2px', backgroundColor: 'rgba(30,41,59,0.4)', borderRadius: '50%' }}
              />
            </>
          )}

          {/* Back of head hair */}
          {isUp && (
            <div
              className="absolute rounded-b-full"
              style={{ bottom: '0', left: '50%', transform: 'translateX(-50%)', width: '18px', height: '10px', backgroundColor: character.hairColor }}
            />
          )}
        </div>

        {/* Body */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: '14px',
            width: '16px',
            height: '14px',
            backgroundColor: character.shirtColor,
            borderRadius: '2px',
            zIndex: isUp ? 3 : 1,
          }}
        >
          <div className="absolute top-0 left-0 w-1/3 h-full opacity-15 bg-white rounded" />
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-15 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />
          {/* Left arm */}
          <div
            className="absolute -left-1 top-1 rounded-b"
            style={{ width: '4px', height: '10px', backgroundColor: character.shirtColor }}
          >
            <div className="absolute bottom-0 left-0 rounded-full" style={{ width: '4px', height: '3px', backgroundColor: character.color }} />
          </div>
          {/* Right arm */}
          <div
            className="absolute -right-1 top-1 rounded-b"
            style={{ width: '4px', height: '10px', backgroundColor: character.shirtColor }}
          >
            <div className="absolute bottom-0 left-0 rounded-full" style={{ width: '4px', height: '3px', backgroundColor: character.color }} />
          </div>
        </div>

        {/* Feet */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
          <div
            style={{
              width: '6px',
              height: '4px',
              backgroundColor: 'hsl(25, 40%, 28%)',
              borderRadius: '1px',
              transform: walkFrame === 1 ? 'translateY(-1px)' : 'none',
            }}
          />
          <div
            style={{
              width: '6px',
              height: '4px',
              backgroundColor: 'hsl(25, 40%, 25%)',
              borderRadius: '1px',
              transform: walkFrame === 3 ? 'translateY(-1px)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Ground shadow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          bottom: '-3px',
          width: '20px',
          height: '6px',
          backgroundColor: 'rgba(0,0,0,0.3)',
          filter: 'blur(1px)',
        }}
      />
    </div>
  );
};

export default PixelCharacter;
