import React, { useEffect, useState } from 'react';

const PixelIcon = ({ gridStr, style }) => {
  const colors = {
    R: '#ef4444', // Red
    G: '#22c55e', // Green
    O: '#f97316', // Orange
    Y: '#facc15', // Yellow
    D: '#ea580c', // Dark Orange
    W: '#f8fafc', // White
    B: '#3b82f6', // Blue
    C: '#94a3b8', // Gray
  };

  const rects = [];
  const rows = gridStr.trim().split('\n').map(r => r.trim());
  
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const char = row[x];
      if (colors[char]) {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colors[char]} />);
      }
    }
  });

  return (
    <svg viewBox="0 0 8 8" style={{ width: '1em', height: '1em', display: 'inline-block', ...style }}>
      {rects}
    </svg>
  );
};

const GRID_APPLE = `
..G.....
...G....
.RRRR...
RRRRRR..
RRRRRR..
RRRRRR..
.RRRR...
..RR....
`;

const GRID_CARROT = `
......GG
.....GG.
...DO...
..DOO...
.OOO....
OO......
O.......
........
`;

const GRID_CHEESE = `
........
..YYYY..
.YYYYYY.
.Y.YYYY.
.YYY.YY.
.YYYYY..
..YYYY..
........
`;

const GRID_MILK = `
...CC...
..C..C..
.CCCCCC.
CWWWWWWC
CWBBBWWC
CWBBBWWC
CWWWWWWC
CCCCCCCC
`;

const ITEMS = [
  { grid: GRID_APPLE, name: 'Apple' },
  { grid: GRID_CARROT, name: 'Carrot' },
  { grid: GRID_CHEESE, name: 'Cheese' },
  { grid: GRID_MILK, name: 'Milk' }
];

export default function MagicBoxDashboard() {
  const [inventory, setInventory] = useState([]);
  const [fallingItem, setFallingItem] = useState(null);

  useEffect(() => {
    let count = 0;
    
    // Initial dummy data
    setInventory([
      { grid: GRID_CHEESE, name: 'Cheese', qty: 1 },
      { grid: GRID_APPLE, name: 'Apple', qty: 2 }
    ]);

    const interval = setInterval(() => {
      // Pick random item
      const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      
      // Add a slight randomization to horizontal drop origin
      const offset = (Math.random() - 0.5) * 40; 
      
      setFallingItem({ ...item, id: count++, offset });
      
      // Match the CSS animation duration for 'dropIntoBox'
      setTimeout(() => {
        setInventory(prev => {
          const exists = prev.find(i => i.name === item.name);
          let next;
          if (exists) {
            next = [
              { ...exists, qty: exists.qty + 1 },
              ...prev.filter(i => i.name !== item.name)
            ];
          } else {
            next = [{ ...item, qty: 1 }, ...prev];
          }
          return next.slice(0, 4); // Keep top 4 recently updated
        });
        setFallingItem(null);
      }, 800); 
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <h4 style={{ color: '#fff', zIndex: 3, margin: 0, paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Pantry List</h4>
      
      {/* Scanner Visual (The Source) */}
      <div style={{ 
        height: '4px', width: '60px', background: '#a855f7', 
        boxShadow: '0 0 10px #a855f7', borderRadius: '4px',
        margin: '0 auto', position: 'absolute', top: '-2px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 3
      }} />

      {/* Falling Item */}
      {fallingItem && (
        <div 
          key={fallingItem.id} 
          style={{ 
            position: 'absolute', 
            left: `calc(50% + ${fallingItem.offset}px)`, 
            transform: 'translateX(-50%)', 
            fontSize: '32px',
            animation: 'dropIntoBox 0.8s cubic-bezier(0.5, 0, 0.75, 0) forwards',
            zIndex: 1,
            filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))'
          }}
        >
          <PixelIcon gridStr={fallingItem.grid} />
        </div>
      )}

      {/* The Dashboard List that receives the items */}
      <div 
        style={{ 
          flex: 1, 
          marginTop: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'flex-end',
          gap: '8px', 
          zIndex: 2,
          paddingTop: '60px', // Space for emojis to fall
          background: 'linear-gradient(to bottom, transparent, rgba(16, 16, 16, 0.9) 20%)'
        }}
      >
        {inventory.map((inv) => (
          <div key={inv.name} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '10px 12px', fontSize: '14px',
            animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <span style={{ fontSize: '18px', display: 'flex' }}><PixelIcon gridStr={inv.grid} /></span>
               <span style={{ color: '#eee', fontWeight: '500' }}>{inv.name}</span>
            </div>
            <span style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }}>
               x{inv.qty}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes dropIntoBox {
          0% { top: -10px; opacity: 0; transform: translateX(-50%) scale(1.5); }
          20% { opacity: 1; }
          70% { top: 40%; opacity: 1; transform: translateX(-50%) scale(1) rotate(15deg); }
          100% { top: 60%; opacity: 0; transform: translateX(-50%) scale(0.5) rotate(-10deg); }
        }
        @keyframes popIn {
          0% { transform: scale(0.9) translateY(10px); background: rgba(168, 85, 247, 0.3); }
          100% { transform: scale(1) translateY(0); background: rgba(255,255,255,0.05); }
        }
      `}</style>
    </div>
  );
}
