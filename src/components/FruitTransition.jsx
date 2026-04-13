import { useEffect, useState, useRef } from 'react';
import './FruitTransition.css';

const FRUITS = [
  '🍎', '🍌', '🍇', '🍓', '🍊', '🍍', '🍒', '🍑', '🍐', '🥭', '🍋', '🥝'
];

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
        fruit: FRUITS[Math.floor(Math.random() * FRUITS.length)],
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
          {item.fruit}
        </div>
      ))}
      <div className="transition-bg-flash"></div>
    </div>
  );
}

