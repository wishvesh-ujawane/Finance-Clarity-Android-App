import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useFabContext } from '@/context/FabContext';
import { cn } from '@/lib/utils';

export function FAB() {
  const { fabAction } = useFabContext();

  if (!fabAction) return null;

  return (
    <motion.button
      key={fabAction.label}
      data-testid={fabAction.testId ?? 'fab-add'}
      onClick={fabAction.onClick}
      className={cn(
        'fixed bottom-20 right-5 md:bottom-8 md:right-8 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-accent text-white',
        fabAction.className,
      )}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9, rotate: 90 }}
      initial={{ scale: 0, opacity: 0, rotate: -45 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 22 }}
      aria-label={fabAction.label}
    >
      {fabAction.icon ?? <Plus size={26} strokeWidth={2.5} />}
    </motion.button>
  );
}
