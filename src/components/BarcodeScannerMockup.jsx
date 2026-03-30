import React, { useState, useEffect } from 'react';

export default function BarcodeScannerMockup() {
  const [status, setStatus] = useState('idle'); // idle | scanning | success
  const [productName, setProductName] = useState('');

  const handleScan = () => {
    if (status !== 'idle') return;
    
    setStatus('scanning');
    
    // Simulate API fetch delay
    setTimeout(() => {
      setStatus('success');
      setProductName('Gala Apple');
      
      // Auto-reset after a few seconds
      setTimeout(() => {
        setStatus('idle');
        setProductName('');
      }, 3000);
    }, 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      
      {/* Viewfinder Window */}
      <div style={{ 
        flex: 1, 
        background: '#111', 
        borderRadius: '12px', 
        border: '1px solid #333', 
        overflow: 'hidden', 
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        
        {/* The target reticle */}
        <div style={{ 
          position: 'absolute', 
          top: '50%', left: '50%', 
          transform: 'translate(-50%, -50%)', 
          border: `2px ${status === 'success' ? 'solid #22c55e' : 'dashed #a855f7'}`, 
          width: '70%', height: '60%', 
          borderRadius: '12px',
          transition: 'all 0.3s'
        }} />

        {/* Simulated Barcode */}
        <div style={{
          display: 'flex',
          gap: '4px',
          height: '40%',
          opacity: status !== 'idle' ? 0.8 : 0.2,
          transition: 'opacity 0.5s'
        }}>
          {[2, 4, 2, 6, 3, 2, 5, 2, 8, 3, 2, 4, 3, 5].map((w, i) => (
            <div key={i} style={{ width: `${w}px`, background: '#fff', height: '100%' }} />
          ))}
        </div>

        {/* Laser Beam */}
        {status === 'scanning' && (
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '2px',
            background: 'rgba(239, 68, 68, 0.9)',
            boxShadow: '0 0 10px rgba(239, 68, 68, 1), 0 0 20px rgba(239, 68, 68, 0.5)',
            animation: 'scanBeam 1s ease-in-out infinite alternate',
            zIndex: 10
          }} />
        )}

        {/* Success Overlay Flash */}
        {status === 'success' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(34, 197, 94, 0.2)',
            animation: 'flash 0.5s ease-out'
          }} />
        )}
      </div>

      {/* Action Button */}
      <button 
        onClick={handleScan}
        style={{ 
          background: status === 'success' ? '#22c55e' : '#fff', 
          color: status === 'success' ? '#fff' : '#000', 
          padding: '12px', 
          border: 'none', 
          borderRadius: '8px', 
          fontWeight: 'bold',
          cursor: status === 'idle' ? 'pointer' : 'default',
          transition: 'all 0.2s',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '44px'
        }}
        disabled={status !== 'idle'}
      >
        {status === 'idle' && 'Scan Barcode'}
        {status === 'scanning' && 'Scanning...'}
        {status === 'success' && `Found: ${productName}`}
      </button>

      <style>{`
        @keyframes scanBeam {
          0% { top: 15%; }
          100% { top: 85%; }
        }
        @keyframes flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
