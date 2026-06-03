import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Trash2, X } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { useFabAction } from '@/context/FabContext';
import { CategoryIcon, ICON_OPTIONS } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';

const COLOR_SWATCHES = [
  '#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444',
  '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4',
  '#84CC16', '#D946EF', '#0EA5E9', '#F43F5E',
];

export default function Categories() {
  const [, setLocation] = useLocation();
  const { categories, addCategory, updateCategory, deleteCategory } = useFinance();

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('DollarSign');
  const [editCatColor, setEditCatColor] = useState('#10B981');
  const [editCatType, setEditCatType] = useState<'income' | 'expense' | 'commitment'>('expense');

  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('DollarSign');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newCatType, setNewCatType] = useState<'income' | 'expense' | 'commitment'>('expense');

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

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    addCategory({
      name: newCatName.trim(),
      icon: newCatIcon,
      color: newCatColor,
      type: newCatType,
    });
    setNewCatName('');
    setNewCatIcon('DollarSign');
    setNewCatColor('#10B981');
    setNewCatType('expense');
    setShowAddCat(false);
  };

  useFabAction(() => setShowAddCat(true), 'Add category', 'fab-add-category');

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          data-testid="categories-back"
          onClick={() => setLocation('/settings')}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Manage Categories
          </h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 space-y-2">
          {categories.map(cat => (
            <div key={cat.id}>
              {editingCatId === cat.id ? (
                <div className="border border-accent/30 rounded-xl p-3 space-y-2 bg-muted/30">
                  <input
                    value={editCatName}
                    onChange={e => setEditCatName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-card rounded-lg border border-border outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Name"
                  />
                  <div className="flex gap-1.5">
                    {(['expense', 'commitment', 'income'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setEditCatType(t)}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-xs font-medium capitalize',
                          editCatType === t ? 'bg-accent text-white' : 'bg-white dark:bg-card text-muted-foreground border border-border'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    <span className="font-semibold text-foreground">Commitment</span> = fixed monthly bill (rent, EMI, SIP, subscriptions). Commitments are excluded from discretionary spend on Analysis.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_SWATCHES.map(c => (
                      <button key={c} onClick={() => setEditCatColor(c)} className="w-6 h-6 rounded-full relative" style={{ backgroundColor: c }}>
                        {editCatColor === c && <Check size={11} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {ICON_OPTIONS.slice(0, 16).map(ico => (
                      <button
                        key={ico}
                        onClick={() => setEditCatIcon(ico)}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          editCatIcon === ico ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground'
                        )}
                      >
                        <CategoryIcon icon={ico} size={13} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEditCat} className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold">
                      <Check size={12} className="inline mr-1" />Save
                    </button>
                    <button onClick={() => setEditingCatId(null)} className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold">
                      <X size={12} className="inline mr-1" />Cancel
                    </button>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="w-full py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold">
                        <Trash2 size={12} className="inline mr-1" />Delete Category
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
              ) : (
                <button
                  type="button"
                  onClick={() => startEditCat(cat.id)}
                  className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors text-left"
                  data-testid={`category-item-${cat.id}`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.color + '22' }}>
                    <CategoryIcon icon={cat.icon} color={cat.color} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{cat.type}</p>
                  </div>
                </button>
              )}
            </div>
          ))}

          <AnimatePresence>
            {showAddCat && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-border rounded-xl p-3 space-y-2 mt-2 bg-muted/20">
                  <p className="text-xs font-bold text-foreground">New Category</p>
                  <input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-card rounded-lg border border-border outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Category name"
                  />
                  <div className="flex gap-1.5">
                    {(['expense', 'commitment', 'income'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNewCatType(t)}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-xs font-medium capitalize',
                          newCatType === t ? 'bg-accent text-white' : 'bg-white dark:bg-card text-muted-foreground border border-border'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    <span className="font-semibold text-foreground">Commitment</span> = fixed monthly bill (rent, EMI, SIP, subscriptions). Commitments are excluded from discretionary spend on Analysis.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_SWATCHES.map(c => (
                      <button key={c} onClick={() => setNewCatColor(c)} className="w-6 h-6 rounded-full relative" style={{ backgroundColor: c }}>
                        {newCatColor === c && <Check size={11} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {ICON_OPTIONS.slice(0, 16).map(ico => (
                      <button
                        key={ico}
                        onClick={() => setNewCatIcon(ico)}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          newCatIcon === ico ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground'
                        )}
                      >
                        <CategoryIcon icon={ico} size={13} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddCategory} className="flex-1 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold">Create</button>
                    <button onClick={() => setShowAddCat(false)} className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold">Cancel</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
