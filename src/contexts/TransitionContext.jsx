import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FruitTransition from '../components/FruitTransition';

const TransitionContext = createContext();

export const useTransition = () => useContext(TransitionContext);

export function TransitionProvider({ children }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetPath, setTargetPath] = useState('');
  const navigate = useNavigate();

  const startTransition = useCallback((path) => {
    setTargetPath(path);
    setIsTransitioning(true);
  }, []);

  const handleTransitionCovered = useCallback(() => {
    navigate(targetPath);
    // After navigation, the transition continue to fly off
    // We'll reset the transitioning state after the animation is presumably done
    setTimeout(() => {
      setIsTransitioning(false);
    }, 2000); // Wait for the rest of flyAcross animation
  }, [navigate, targetPath]);

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
