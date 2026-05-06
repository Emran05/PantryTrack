import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  // showToast(message, type, options?)
  // options: { action: { label, onClick }, duration }
  // Action toasts default to a longer duration so the user has time to react.
  const showToast = useCallback((message, type = 'success', options = {}) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const action = options.action || null;
    const duration = options.duration ?? (action ? 5000 : 2500);
    setToast({ message, type, action, id: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <ToastMessage toast={toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  );
}

function ToastMessage({ toast, onDismiss }) {
  const handleAction = (e) => {
    e.stopPropagation();
    try {
      toast.action.onClick();
    } finally {
      onDismiss();
    }
  };

  return (
    <div className={`toast toast-${toast.type} animate-slide-up`} key={toast.id} onClick={onDismiss}>
      <span className="toast-icon">
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
      </span>
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button className="toast-action" onClick={handleAction}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
