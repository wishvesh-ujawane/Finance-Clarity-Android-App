import { createContext, useContext, useEffect, useRef, useState, ReactNode, type ReactElement } from 'react';

/**
 * One item in a FAB speed-dial menu. Rendered as a mini-button that fans
 * out above the main FAB when it's tapped.
 */
export interface FabMenuItem {
  onClick: () => void;
  label: string;
  icon: ReactElement;
  testId?: string;
  /** Tailwind classes for the mini-button background/text (defaults to accent). */
  className?: string;
}

export interface FabActionOptions {
  /** Tailwind classes appended/overriding the FAB button's default classes. */
  className?: string;
  /** Optional icon override (defaults to a Plus glyph). */
  icon?: ReactElement;
  /**
   * When set, the FAB behaves as a speed-dial: tapping the plus opens a
   * fan-out of these mini-buttons instead of directly running `onClick`.
   */
  menuItems?: FabMenuItem[];
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
 * the action when the component unmounts.
 *
 * The `onClick` reference is held in a ref so callers can pass an
 * inline arrow function on every render without re-registering the FAB.
 * The registration effect only fires when the visible identity of the
 * action changes (`label`, `testId`, `className`, `icon`, or `menuItems`).
 *
 * `options.className` overrides the FAB's default background/text classes
 * (e.g. `'bg-orange-500 hover:bg-orange-600 text-white'`).
 * `options.icon` swaps the default Plus glyph for a custom node.
 * `options.menuItems` turns the FAB into a speed-dial (see `useFabMenu`).
 */
export function useFabAction(
  onClick: () => void,
  label: string,
  testId?: string,
  options?: FabActionOptions,
) {
  const { setFabAction } = useFabContext();
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const className = options?.className;
  const icon = options?.icon;
  const menuItems = options?.menuItems;

  useEffect(() => {
    setFabAction({
      onClick: () => onClickRef.current(),
      label,
      testId,
      className,
      icon,
      menuItems,
    });
    return () => setFabAction(null);
  }, [setFabAction, label, testId, className, icon, menuItems]);
}

/**
 * Register a FAB speed-dial menu for the current screen. The main FAB
 * button opens a fan-out of mini-buttons (one per `items` entry).
 * Automatically clears when the component unmounts.
 */
export function useFabMenu(items: FabMenuItem[], testId?: string) {
  useFabAction(
    () => {
      /* menu open/close is handled by the FAB component itself */
    },
    'Open actions menu',
    testId ?? 'fab-add',
    { menuItems: items },
  );
}
