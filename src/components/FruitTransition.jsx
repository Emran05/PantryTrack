import { useEffect, useState, useRef } from 'react';
import './FruitTransition.css';

// Custom-drawn shards, not emoji: squares carrying the icon family's clipped
// corner, at four rotations and three accent tints. The transition reads as
// the product's own material breaking apart and reforming.
const SHARDS = ['a', 'b', 'c', 'd'];

export default function FruitTransition({ isVisible, onTransitionCovered }) {
  const [items, setItems] = useState([]);
  const callbackRef = useRef(onTransitionCovered);

  // Keep ref up-to-date
  useEffect(() => {
    callbackRef.current = onTransitionCovered;
  }, [onTransitionCovered]);

  useEffect(() => {
    if (isVisible) {
      const newItems = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        shard: SHARDS[Math.floor(Math.random() * SHARDS.length)],
        top: Math.random() * 100,
        left: -20,
        delay: Math.random() * 0.5,
        duration: 0.8 + Math.random() * 0.6,
        size: 20 + Math.random() * 60,
        rotation: Math.random() * 360,
      }));
      setItems(newItems);

      const timer = setTimeout(() => {
        if (callbackRef.current) callbackRef.current();
      }, 700);

      return () => clearTimeout(timer);
    } else {
      setItems([]);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fruit-transition-overlay">
      {items.map(item => (
        <div
          key={item.id}
          className="fruit-item"
          style={{
            top: `${item.top}%`,
            left: `${item.left}%`,
            fontSize: `${item.size}px`,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
            transform: `rotate(${item.rotation}deg)`
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={
                item.shard === 'a' ? 'M3 3h13l5 5v13H3z'
                : item.shard === 'b' ? 'M3 8l5-5h13v13l-5 5H3z'
                : item.shard === 'c' ? 'M4 4h16v11l-5 5H4z'
                : 'M3 3h18v18H8L3 16z'
              }
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="miter"
              fill="currentColor"
              fillOpacity="0.14"
            />
          </svg>
        </div>
      ))}
      <div className="transition-bg-flash"></div>
    </div>
  );
}

