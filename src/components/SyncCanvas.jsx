import React, { useEffect, useRef } from 'react';

export default function SyncCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const resizeInfo = { width: 0, height: 0 };
    
    // Fit to container
    const resize = () => {
      const parent = canvas.parentElement;
      const dpi = window.devicePixelRatio || 1;
      resizeInfo.width = parent.clientWidth;
      resizeInfo.height = parent.clientHeight;
      canvas.width = resizeInfo.width * dpi;
      canvas.height = resizeInfo.height * dpi;
      ctx.scale(dpi, dpi);
    };
    
    resize();
    window.addEventListener('resize', resize);

    // Emojis representing grocery items being synced
    // Custom-drawn packet glyphs — the icon language's clipped-corner motif in
// canvas form. No emoji, no font dependency, no glyph-coverage surprises
// across platforms.
const GLYPHS = ['box', 'bar', 'ring', 'notch'];
    
    class Packet {
      constructor() {
        this.reset(true);
      }
      
      reset(randomX = false) {
        this.isRightToLeft = Math.random() > 0.5;
        this.x = randomX 
          ? Math.random() * resizeInfo.width 
          : (this.isRightToLeft ? resizeInfo.width + 20 : -20);
        
        // Target vertical center with slight scattering
        this.y = resizeInfo.height / 2 + (Math.random() - 0.5) * 60;
        this.speed = 1.5 + Math.random() * 2;
        this.glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        this.waveOffset = Math.random() * Math.PI * 2;
        this.waveSpeed = 0.02 + Math.random() * 0.03;
        this.amplitude = 10 + Math.random() * 15;
      }
      
      update() {
        if (this.isRightToLeft) {
          this.x -= this.speed;
          if (this.x < -30) this.reset();
        } else {
          this.x += this.speed;
          if (this.x > resizeInfo.width + 30) this.reset();
        }
      }
      
      draw() {
        ctx.save();
        const currentY = this.y + Math.sin(this.waveOffset) * this.amplitude;
        this.waveOffset += this.waveSpeed;

        ctx.translate(this.x, currentY);
        ctx.strokeStyle = 'rgba(200, 180, 255, 0.95)';
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'miter';
        ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
        ctx.shadowBlur = 10;

        const r = 8;
        ctx.beginPath();
        if (this.glyph === 'box') {
          // Square with a clipped top-right corner — the family signature.
          ctx.moveTo(-r, -r); ctx.lineTo(r - 4, -r); ctx.lineTo(r, -r + 4);
          ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath();
        } else if (this.glyph === 'bar') {
          ctx.moveTo(-r, -3); ctx.lineTo(r, -3);
          ctx.moveTo(-r, 3); ctx.lineTo(r - 5, 3);
        } else if (this.glyph === 'ring') {
          ctx.arc(0, 0, r - 1, 0.35, Math.PI * 2);
        } else {
          // Notch: two strokes meeting at a square corner.
          ctx.moveTo(-r, r); ctx.lineTo(-r, -r); ctx.lineTo(r, -r);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    const packets = Array.from({ length: 12 }, () => new Packet());
    let animationId;

    const render = () => {
      // Background fade for motion trails (matching #1a1a1a)
      ctx.fillStyle = 'rgba(26, 26, 26, 0.2)'; 
      ctx.fillRect(0, 0, resizeInfo.width, resizeInfo.height);
      
      // Draw connection wave representing the "network"
      ctx.beginPath();
      for(let x = 0; x < resizeInfo.width; x += 5) {
         const y = resizeInfo.height / 2 + Math.sin(x * 0.015 + Date.now() * 0.003) * 20;
         if(x === 0) ctx.moveTo(x, y);
         else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)'; // Subtle purple
      ctx.lineWidth = 2;
      ctx.stroke();

      packets.forEach(p => {
        p.update();
        p.draw();
      });
      
      // Draw end nodes (Phones)
      ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
      
      // Left node
      ctx.beginPath();
      ctx.arc(0, resizeInfo.height / 2, 8 + Math.sin(Date.now() * 0.005) * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Right node
      ctx.beginPath();
      ctx.arc(resizeInfo.width, resizeInfo.height / 2, 8 + Math.cos(Date.now() * 0.005) * 2, 0, Math.PI * 2);
      ctx.fill();

      animationId = requestAnimationFrame(render);
    };
    
    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        borderRadius: 'inherit' 
      }} 
    />
  );
}
