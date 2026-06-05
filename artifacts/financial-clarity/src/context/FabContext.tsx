import { createContext, useContext, useEffect, useState, ReactNode, useCallback, type ReactElement } from 'react';

export interface FabActionOptions {
  /** Tailwind classes appended/overriding the FAB button's default classes. */
  className?: string;
  /** Optional icon override (defaults to a Plus glyph). */
  icon?: ReactElement;
}

export interface FabAction extends FabActionOptions {
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
 * the action when the component unmounts. Re-registers when `onClick`,
 * `label`, or style options change.
 *
 * `options.className` overrides the FAB's default background/text classes
 * (e.g. `'bg-orange-500 hover:bg-orange-600 text-white'`).
 * `options.icon` swaps the default Plus glyph for a custom node.
 */
export function useFabAction(
  onClick: () => void,
  label: string,
  testId?: string,
  options?: FabActionOptions,
) {
  const { setFabAction } = useFabContext();
  const stableClick = useCallback(onClick, [onClick]);
  const className = options?.className;
  const icon = options?.icon;
  useEffect(() => {
    setFabAction({ onClick: stableClick, label, testId, className, icon });
    return () => setFabAction(null);
  }, [setFabAction, stableClick, label, testId, className, icon]);
}
