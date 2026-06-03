import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useFabContext } from '@/context/FabContext';

export function FAB() {
  const { fabAction } = useFabContext();

  if (!fabAction) return null;

  return (
    <motion.button
      key={fabAction.label}
      data-testid={fabAction.testId ?? 'fab-add'}
      onClick={fabAction.onClick}
      className="fixed bottom-20 right-5 md:bottom-8 md:right-8 z-50 w-14 h-14 rounded-full bg-accent text-white shadow-2xl flex items-center justify-center"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      aria-label={fabAction.label}
    >
      <Plus size={26} strokeWidth={2.5} />
    </motion.button>
  );
}
