import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

export interface FabAction {
  onClick: () => void;
  label: string;
  testId?: string;
}

interface FabContextValue {
  fabAction: FabAction | null;
  setFabAction: (action: FabAction | null) => void;
}

const FabContext = createContext<FabContextValue | undefined>(undefined);

export function FabProvider({ children }: { children: ReactNode }) {
  const [fabAction, setFabAction] = useState<FabAction | null>(null);
  return (
    <FabContext.Provider value={{ fabAction, setFabAction }}>
      {children}
    </FabContext.Provider>
  );
}

export function useFabContext() {
  const ctx = useContext(FabContext);
  if (!ctx) throw new Error('useFabContext must be used within FabProvider');
  return ctx;
}

/**
 * Register a FAB action for the current screen. Automatically clears
 * the action when the component unmounts. Re-registers when `onClick`
 * or `label` change.
 */
export function useFabAction(onClick: () => void, label: string, testId?: string) {
  const { setFabAction } = useFabContext();
  const stableClick = useCallback(onClick, [onClick]);
  useEffect(() => {
    setFabAction({ onClick: stableClick, label, testId });
    return () => setFabAction(null);
  }, [setFabAction, stableClick, label, testId]);
}
