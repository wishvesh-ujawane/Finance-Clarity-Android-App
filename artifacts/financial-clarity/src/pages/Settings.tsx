import { useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Check, ChevronDown, ChevronRight, LockKeyhole, Plus, Settings as SettingsIcon, ShieldCheck, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon, ICON_OPTIONS } from '@/components/CategoryIcon';
import { formatINR } from '@/lib/finance-utils';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS = [
  '#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444',
  '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4',
  '#84CC16', '#D946EF', '#0EA5E9', '#F43F5E',
];

export default function Settings() {
  const [, navigate] = useLocation();
  const {
    transactions,
    categories,
    securitySettings,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useFinance();

  const [showCategorySection, setShowCategorySection] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('DollarSign');
  const [editCatColor, setEditCatColor] = useState('#10B981');
  const [editCatType, setEditCatType] = useState<'income' | 'expense'>('expense');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('DollarSign');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');

  const startCategoryEdit = (categoryId: string) => {
    const category = categories.find(item => item.id === categoryId);
    if (!category) return;
    setEditingCatId(categoryId);
    setEditCatName(category.name);
    setEditCatIcon(category.icon);
    setEditCatColor(category.color);
    setEditCatType(category.type === 'both' ? 'expense' : category.type);
  };

  const saveCategoryEdit = () => {
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
    setShowAddCategory(false);
  };

  const currentMonthBalance = formatINR(
    transactions.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0) -
    transactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  );

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowCategorySection(value => !value)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <SettingsIcon size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Categories</p>
              <p className="text-xs text-muted-foreground">Modify category names, icons, colors, and type.</p>
            </div>
          </div>
          <ChevronDown size={16} className={cn('text-muted-foreground transition-transform', showCategorySection ? 'rotate-180' : '')} />
        </button>

        <AnimatePresence>
          {showCategorySection && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
              <div className="p-5 space-y-2">
                {categories.map(category => (
                  <div key={category.id}>
                    {editingCatId === category.id ? (
                      <div className="border border-accent/30 rounded-xl p-3 space-y-2 bg-muted/30">
                        <input
                          value={editCatName}
                          onChange={event => setEditCatName(event.target.value)}
                          className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Category name"
                        />
                        <div className="flex gap-1.5">
                          {(['expense', 'income'] as const).map(type => (
                            <button
                              key={type}
                              onClick={() => setEditCatType(type)}
                              className={cn(
                                'flex-1 py-2 rounded-xl text-xs font-semibold capitalize',
                                editCatType === type ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground'
                              )}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORY_COLORS.map(color => (
                            <button key={color} onClick={() => setEditCatColor(color)} className="w-6 h-6 rounded-full relative" style={{ backgroundColor: color }}>
                              {editCatColor === color && <Check size={11} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-8 gap-1">
                          {ICON_OPTIONS.slice(0, 16).map(icon => (
                            <button
                              key={icon}
                              onClick={() => setEditCatIcon(icon)}
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                editCatIcon === icon ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground'
                              )}
                            >
                              <CategoryIcon icon={icon} size={13} />
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveCategoryEdit} className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold">Save</button>
                          <button onClick={() => setEditingCatId(null)} className="flex-1 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold">Cancel</button>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="w-full py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold">
                              <Trash2 size={12} className="inline mr-1" />Delete Category
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                              <AlertDialogDescription>Remove "{category.name}" from categories. Existing transactions will retain amounts but may show an unknown category.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => { deleteCategory(category.id); setEditingCatId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCategoryEdit(category.id)}
                        className="w-full rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors text-left flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: category.color + '22' }}>
                          <CategoryIcon icon={category.icon} color={category.color} size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{category.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{category.type}</p>
                        </div>
                      </button>
                    )}
                  </div>
                ))}

                <AnimatePresence>
                  {showAddCategory && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/20 mt-2">
                        <p className="text-xs font-bold text-foreground">New Category</p>
                        <input
                          value={newCatName}
                          onChange={event => setNewCatName(event.target.value)}
                          className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Category name"
                        />
                        <div className="flex gap-1.5">
                          {(['expense', 'income'] as const).map(type => (
                            <button
                              key={type}
                              onClick={() => setNewCatType(type)}
                              className={cn(
                                'flex-1 py-2 rounded-xl text-xs font-semibold capitalize',
                                newCatType === type ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground'
                              )}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORY_COLORS.map(color => (
                            <button key={color} onClick={() => setNewCatColor(color)} className="w-6 h-6 rounded-full relative" style={{ backgroundColor: color }}>
                              {newCatColor === color && <Check size={11} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-8 gap-1">
                          {ICON_OPTIONS.slice(0, 16).map(icon => (
                            <button
                              key={icon}
                              onClick={() => setNewCatIcon(icon)}
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                newCatIcon === icon ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground'
                              )}
                            >
                              <CategoryIcon icon={icon} size={13} />
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleAddCategory} className="flex-1 py-2 rounded-xl bg-accent text-white text-xs font-semibold">Create</button>
                          <button onClick={() => setShowAddCategory(false)} className="flex-1 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={() => setShowAddCategory(value => !value)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-accent/40 hover:text-accent transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  Add Category
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => navigate('/recurring')}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <CalendarClock size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Recurring Transactions</p>
              <p className="text-xs text-muted-foreground">Schedule repeating income and expenses.</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => navigate('/security')}
          className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <LockKeyhole size={18} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">Security</p>
                <p className="text-xs text-muted-foreground">Manage app lock, biometric unlock and PIN settings.</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <p>{securitySettings.appLockEnabled ? 'App lock is enabled' : 'App lock is disabled'}</p>
              <p>{securitySettings.biometricEnabled ? 'Biometric login is enabled' : 'Biometric login is disabled'}</p>
              <p>{securitySettings.pinHash ? 'PIN is set' : 'PIN is not set'}</p>
            </div>
          </div>
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => navigate('/backup')}
          className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">Backup & Restore</p>
                <p className="text-xs text-muted-foreground">Keep your data safe with Google Drive and CSV backups.</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <p>Encrypted Drive backup available.</p>
              <p>CSV export/import available in backup screen.</p>
            </div>
          </div>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Current month balance: <span className="font-semibold text-foreground">{currentMonthBalance}</span>
      </p>
    </div>
  );
}

