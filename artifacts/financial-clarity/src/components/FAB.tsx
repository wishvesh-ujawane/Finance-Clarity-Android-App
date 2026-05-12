import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';

export function FAB() {
  const { openSheet } = useFinance();

  return (
    <motion.button
      data-testid="fab-add-transaction"
      onClick={openSheet}
      className="fixed bottom-20 right-5 md:bottom-8 md:right-8 z-50 w-14 h-14 rounded-full bg-accent text-white shadow-2xl flex items-center justify-center"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      aria-label="Add transaction"
    >
      <Plus size={26} strokeWidth={2.5} />
    </motion.button>
  );
}
