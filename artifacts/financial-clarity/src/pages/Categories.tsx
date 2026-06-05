import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Info, Trash2, X } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useFinance } from '@/context/FinanceContext';
import { useFabAction } from '@/context/FabContext';
import { CategoryIcon, ICON_OPTIONS } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';

const COLOR_SWATCHES = [
  '#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444',
  '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4',
  '#84CC16', '#D946EF', '#0EA5E9', '#F43F5E',
];

type CategoryType = 'income' | 'expense' | 'commitment';

const TYPE_GROUPS: { key: CategoryType; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'commitment', label: 'Commitment' },
  { key: 'income', label: 'Income' },
];

const TYPE_BADGE: Record<CategoryType, { dot: string; text: string }> = {
  expense: { dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  commitment: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  income: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
};

function CommitmentHint() {
  return (
    <div className="flex gap-2 rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <Info size={14} className="mt-0.5 flex-shrink-0" />
      <p className="text-[12px] leading-relaxed">
        <span className="font-semibold">Commitment</span> = fixed monthly bill (rent, EMI, SIP, subscriptions). Commitments are excluded from discretionary spend on Analysis.
      </p>
    </div>
  );
}

export default function Categories() {
  const [, setLocation] = useLocation();
  const { categories, addCategory, updateCategory, deleteCategory } = useFinance();

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('DollarSign');
  const [editCatColor, setEditCatColor] = useState('#10B981');
  const [editCatType, setEditCatType] = useState<CategoryType>('expense');

  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('DollarSign');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newCatType, setNewCatType] = useState<CategoryType>('expense');

  const startEditCat = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    setEditingCatId(catId);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon);
    setEditCatColor(cat.color);
    setEditCatType(cat.type === 'both' || cat.type === 'savings' ? 'expense' : cat.type);
  };

  const saveEditCat = () => {
    if (!editingCatId || !editCatName.trim()) return;
    updateCategory(editingCatId, {
      name: editCatName.trim(),
      icon: editCatIcon,
      color: editCatColor,
      type: editCatType,
    });
    setEditingCatId(null);
  };

  const resetNewCat = () => {
    setNewCatName('');
    setNewCatIcon('DollarSign');
    setNewCatColor('#10B981');
    setNewCatType('expense');
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    addCategory({
      name: newCatName.trim(),
      icon: newCatIcon,
      color: newCatColor,
      type: newCatType,
    });
    resetNewCat();
    setShowAddCat(false);
  };

  useFabAction(
    () => setShowAddCat(true),
    'Add category',
    'fab-add-category',
    { className: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  );

  const groupedCategories = useMemo(() => {
    const buckets: Record<CategoryType, typeof categories> = {
      expense: [], commitment: [], income: [],
    };
    for (const cat of categories) {
      const key: CategoryType =
        cat.type === 'both' || cat.type === 'savings' ? 'expense' : cat.type;
      buckets[key].push(cat);
    }
    return buckets;
  }, [categories]);

  return (
    <div className="p-4 md:p-6 pb-32">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          data-testid="categories-back"
          onClick={() => setLocation('/settings')}
          className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Manage Categories
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} · tap any row to edit
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-3 md:p-4 space-y-1">
          {TYPE_GROUPS.map(group => {
            const rows = groupedCategories[group.key];
            if (rows.length === 0) return null;
            return (
              <div key={group.key} className="space-y-1">
                <div className="flex items-center gap-2 px-2 pt-3 pb-1">
                  <span className={cn('w-1.5 h-1.5 rounded-full', TYPE_BADGE[group.key].dot)} />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <span className="text-[11px] text-muted-foreground/70">· {rows.length}</span>
                </div>
                {rows.map(cat => (
                  <motion.div key={cat.id} layout="position" transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.85 }}>
                    <AnimatePresence mode="wait" initial={false}>
                      {editingCatId === cat.id ? (
                        <motion.div
                          key="edit"
                          initial={{ opacity: 0, height: 0, y: -4 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -4 }}
                          transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.85 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="border border-accent/30 rounded-xl p-4 space-y-3 bg-muted/30">
                            <input
                              value={editCatName}
                              onChange={e => setEditCatName(e.target.value)}
                              className="w-full px-3 py-2.5 text-[15px] font-medium bg-white dark:bg-card rounded-lg border border-border outline-none focus:ring-2 focus:ring-accent"
                              placeholder="Name"
                            />
                            <div className="flex gap-1.5">
                              {(['expense', 'commitment', 'income'] as const).map(t => (
                                <button
                                  key={t}
                                  onClick={() => setEditCatType(t)}
                                  className={cn(
                                    'flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
                                    editCatType === t
                                      ? 'bg-accent text-white'
                                      : 'bg-white dark:bg-card text-muted-foreground border border-border hover:text-foreground',
                                  )}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                            <AnimatePresence initial={false}>
                              {editCatType === 'commitment' && (
                                <motion.div
                                  key="commit-hint"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2, ease: 'easeOut' }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <CommitmentHint />
                                </motion.div>
                              )}
                            </AnimatePresence>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Color</p>
                              <div className="flex flex-wrap gap-2">
                                {COLOR_SWATCHES.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => setEditCatColor(c)}
                                    className="w-8 h-8 rounded-full relative ring-offset-2 ring-offset-background"
                                    style={{ backgroundColor: c }}
                                    aria-label={`Pick color ${c}`}
                                  >
                                    {editCatColor === c && <Check size={14} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Icon</p>
                              <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                                {ICON_OPTIONS.map(ico => (
                                  <button
                                    key={ico}
                                    onClick={() => setEditCatIcon(ico)}
                                    className={cn(
                                      'aspect-square rounded-lg flex items-center justify-center transition-colors',
                                      editCatIcon === ico
                                        ? 'bg-accent text-white'
                                        : 'bg-white dark:bg-card border border-border text-muted-foreground hover:text-foreground',
                                    )}
                                    aria-label={`Pick icon ${ico}`}
                                  >
                                    <CategoryIcon icon={ico} size={16} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={saveEditCat} className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                                <Check size={14} className="inline mr-1" />Save
                              </button>
                              <button onClick={() => setEditingCatId(null)} className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors">
                                <X size={14} className="inline mr-1" />Cancel
                              </button>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="w-full py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/15 text-sm font-semibold transition-colors">
                                  <Trash2 size={14} className="inline mr-1" />Delete Category
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you really want to delete "{cat.name}"? Its associated budget will also be removed. Existing transactions will show as Unknown.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      deleteCategory(cat.id);
                                      setEditingCatId(null);
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="row"
                          type="button"
                          onClick={() => startEditCat(cat.id)}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full group flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors text-left"
                          data-testid={`category-item-${cat.id}`}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: cat.color + '22' }}
                          >
                            <CategoryIcon icon={cat.icon} color={cat.color} size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-semibold text-foreground truncate">{cat.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={cn('w-1.5 h-1.5 rounded-full', TYPE_BADGE[group.key].dot)} />
                              <p className={cn('text-[11px] font-medium uppercase tracking-wide', TYPE_BADGE[group.key].text)}>
                                {group.label}
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-muted-foreground/70 group-hover:text-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* New Category Sheet */}
      <Sheet
        open={showAddCat}
        onOpenChange={(open) => {
          setShowAddCat(open);
          if (!open) resetNewCat();
        }}
      >
        <SheetContent side="bottom" className="h-[82vh] rounded-t-2xl flex flex-col p-5">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg">New Category</SheetTitle>
            <SheetDescription>Create a new category to organise your transactions.</SheetDescription>
          </SheetHeader>
          <AnimatePresence mode="wait">
            {showAddCat && (
              <motion.div
                key="new-cat-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut', delay: 0.05 }}
                className="space-y-4 mt-4 flex-1 overflow-y-auto pr-1"
              >
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Name
                  </label>
                  <input
                    data-testid="new-category-name"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    className="w-full px-4 py-3 text-[15px] font-medium bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                    placeholder="e.g. Groceries"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Type
                  </label>
                  <div className="flex gap-1.5">
                    {(['expense', 'commitment', 'income'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNewCatType(t)}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-colors',
                          newCatType === t
                            ? 'bg-accent text-white'
                            : 'bg-muted text-muted-foreground hover:text-foreground',
                        )}
                        data-testid={`new-category-type-${t}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {newCatType === 'commitment' && <CommitmentHint />}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_SWATCHES.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewCatColor(c)}
                        className="w-9 h-9 rounded-full relative"
                        style={{ backgroundColor: c }}
                        aria-label={`Pick color ${c}`}
                      >
                        {newCatColor === c && <Check size={16} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Icon
                  </label>
                  <div className="grid grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
                    {ICON_OPTIONS.map(ico => (
                      <button
                        key={ico}
                        onClick={() => setNewCatIcon(ico)}
                        className={cn(
                          'aspect-square rounded-xl flex items-center justify-center transition-colors',
                          newCatIcon === ico
                            ? 'bg-accent text-white'
                            : 'bg-muted text-muted-foreground hover:text-foreground',
                        )}
                        aria-label={`Pick icon ${ico}`}
                      >
                        <CategoryIcon icon={ico} size={18} />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-2 pt-4 border-t border-border">
            <button
              onClick={() => { setShowAddCat(false); resetNewCat(); }}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="new-category-create"
              onClick={handleAddCategory}
              disabled={!newCatName.trim()}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
