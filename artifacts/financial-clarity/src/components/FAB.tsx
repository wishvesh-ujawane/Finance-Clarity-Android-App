import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useFabContext } from '@/context/FabContext';
import { cn } from '@/lib/utils';

export function FAB() {
  const { fabAction } = useFabContext();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the menu whenever the registered action changes (route change,
  // unmount, etc.) so a stale open state can't strand the backdrop.
  useEffect(() => {
    setMenuOpen(false);
  }, [fabAction]);

  if (!fabAction) return null;

  const isMenuMode = !!fabAction.menuItems && fabAction.menuItems.length > 0;
  const menuItems = fabAction.menuItems ?? [];

  const handleMainClick = () => {
    if (isMenuMode) {
      setMenuOpen(open => !open);
    } else {
      fabAction.onClick();
    }
  };

  const runMenuItem = (onClick: () => void) => {
    // Close first so the sheet doesn't animate in behind an open fan.
    setMenuOpen(false);
    // Defer the onClick so the exit animation gets a frame to start.
    window.setTimeout(onClick, 0);
  };

  return (
    <>
      {/* Backdrop (menu mode only) */}
      <AnimatePresence>
        {isMenuMode && menuOpen && (
          <motion.div
            key="fab-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            data-testid="fab-backdrop"
          />
        )}
      </AnimatePresence>

      {/* Fan-out mini-buttons (menu mode only) */}
      <AnimatePresence>
        {isMenuMode && menuOpen && (
          <motion.div
            key="fab-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-36 right-5 md:bottom-24 md:right-8 z-50 flex flex-col-reverse gap-3 items-end"
          >
            {menuItems.map((item, i) => (
              <motion.button
                key={item.testId ?? item.label}
                data-testid={item.testId}
                onClick={() => runMenuItem(item.onClick)}
                initial={{ opacity: 0, y: 12, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24, delay: i * 0.04 }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.93 }}
                className="flex items-center gap-3"
                aria-label={item.label}
              >
                <span className="rounded-lg bg-white dark:bg-[hsl(222,65%,15%)] shadow-md px-2.5 py-1 text-xs font-semibold text-foreground border border-border">
                  {item.label}
                </span>
                <span
                  className={cn(
                    'w-11 h-11 rounded-full shadow-lg flex items-center justify-center',
                    item.className ?? 'bg-accent text-white',
                  )}
                >
                  {item.icon}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        key={fabAction.label}
        data-testid={fabAction.testId ?? 'fab-add'}
        onClick={handleMainClick}
        className={cn(
          'fixed bottom-20 right-5 md:bottom-8 md:right-8 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-accent text-white',
          fabAction.className,
        )}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9, rotate: isMenuMode ? 0 : 90 }}
        initial={{ scale: 0, opacity: 0, rotate: -45 }}
        animate={{ scale: 1, opacity: 1, rotate: isMenuMode && menuOpen ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        aria-label={isMenuMode ? (menuOpen ? 'Close actions menu' : 'Open actions menu') : fabAction.label}
        aria-expanded={isMenuMode ? menuOpen : undefined}
      >
        {isMenuMode && menuOpen
          ? <X size={26} strokeWidth={2.5} />
          : (fabAction.icon ?? <Plus size={26} strokeWidth={2.5} />)}
      </motion.button>
    </>
  );
}
