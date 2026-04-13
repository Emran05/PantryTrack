import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FruitTransition from '../components/FruitTransition';

const TransitionContext = createContext();

export const useTransition = () => useContext(TransitionContext);

export function TransitionProvider({ children }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const targetPathRef = useRef('');
  const navigate = useNavigate();

  const startTransition = useCallback((path) => {
    targetPathRef.current = path;
    setIsTransitioning(true);
  }, []);

  const handleTransitionCovered = useCallback(() => {
    navigate(targetPathRef.current);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 2000);
  }, [navigate]);

  return (
    <TransitionContext.Provider value={startTransition}>
      {children}
      <FruitTransition 
        isVisible={isTransitioning} 
        onTransitionCovered={handleTransitionCovered} 
      />
    </TransitionContext.Provider>
  );
}

