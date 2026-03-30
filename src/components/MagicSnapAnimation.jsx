import React, { useEffect, useState } from 'react';

export default function MagicSnapAnimation({ isTriggered }) {
  const [scanProgress, setScanProgress] = useState(0); // 0 to 100
  const [parsedItems, setParsedItems] = useState([]);

  const RECEIPT_ITEMS = [
    { top: 30, name: 'APPLES - 4.99' },
    { top: 60, name: 'MILK 1G - 3.50' }
  ];

  useEffect(() => {
    if (!isTriggered) return;

    let scanInterval;

    setScanProgress(0);
    setParsedItems([]);
    
    scanInterval = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) {
          clearInterval(scanInterval);
          return 100;
        }
        
        const newP = p + 1.5; // Speed of scanner (1.5% per frame)
        
        // Check if scanner passed an item
        RECEIPT_ITEMS.forEach((item, index) => {
          if (p < item.top && newP >= item.top) {
            setParsedItems(curr => [...curr, item]);
          }
        });
        
        return newP;
      });
    }, 30);

    return () => {
      clearInterval(scanInterval);
    };
  }, [isTriggered]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', perspective: '1000px' }}>
      
      {/* Receipt Side */}
      <div style={{ 
        width: '260px', 
        height: '380px', 
        background: '#fdfdfd', 
        borderRadius: '4px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        padding: '24px',
        color: '#111',
        position: 'relative',
        transform: 'rotateY(10deg) rotateZ(-2deg)',
        fontFamily: 'monospace'
      }}>
        <h3 style={{ borderBottom: '2px dashed #ccc', paddingBottom: '8px', marginBottom: '16px', textAlign: 'center' }}>GROCERY CO.</h3>
        
        {/* Receipt Lines */}
        <div style={{ position: 'relative', height: '240px' }}>
          {RECEIPT_ITEMS.map((item, idx) => (
            <div key={idx} style={{ 
              position: 'absolute', 
              top: `${item.top}%`, 
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              // Fade out the line once scanner has passed it
              opacity: scanProgress > item.top ? 0.2 : 1,
              transition: 'opacity 0.3s'
            }}>
              <div style={{ height: '8px', background: '#ccc', width: '60%', borderRadius: '4px' }} />
              <div style={{ height: '8px', background: '#ccc', width: '20%', borderRadius: '4px' }} />
            </div>
          ))}
        </div>

        {/* Scanner Laser */}
        {scanProgress < 100 && (
          <div style={{
            position: 'absolute',
            top: `calc(70px + (240px * ${scanProgress / 100}))`,
            left: '-10px',
            right: '-10px',
            height: '3px',
            background: '#a855f7',
            boxShadow: '0 0 15px 5px rgba(168, 85, 247, 0.4)',
            zIndex: 10
          }} />
        )}
      </div>

      {/* AI Parsing Connection */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#a855f7' }}>
         <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: scanProgress < 100 ? 'pulse 1s infinite' : 'none' }}>
           <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
         </svg>
         <span style={{ fontSize: '12px', fontWeight: 'bold', opacity: scanProgress < 100 ? 1 : 0.4 }}>VISION AI</span>
      </div>

      {/* App / UI Side */}
      <div style={{ 
        width: '280px', 
        height: '420px', 
        background: '#151515', 
        borderRadius: '24px',
        border: '1px solid #333',
        boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
        padding: '24px',
        color: '#fff',
        transform: 'rotateY(-10deg) rotateZ(2deg)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h4 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#a855f7' }}>Pantry Database</h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {parsedItems.map((item, idx) => (
            <div key={idx} style={{
              background: '#222',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: 'slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
              <span style={{ fontWeight: 600 }}>{item.name.split(' ')[0]}</span>
              <span style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', color: '#d8b4fe' }}>+1 Added</span>
            </div>
          ))}
          
          {parsedItems.length === 0 && (
            <div style={{ textAlign: 'center', color: '#555', marginTop: '40px', fontSize: '14px' }}>
              Awaiting Scan Data...
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 10px #a855f7); }
          100% { transform: scale(1); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
