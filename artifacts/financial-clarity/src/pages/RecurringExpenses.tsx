import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Check, X, Power } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { useFabAction } from '@/context/FabContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { currentMonth, formatAmount } from '@/lib/finance-utils';
import { parseCurrencyInput } from '@/lib/currency-utils';
import { SYSTEM_ADJUSTMENT_CATEGORY_IDS } from '@/lib/types';
import { selectableCategories } from '@/lib/category-rules';

const SYSTEM_ADJUSTMENT_ID_SET: ReadonlySet<string> = new Set(SYSTEM_ADJUSTMENT_CATEGORY_IDS);

interface FormState {
  description: string;
  amount: string;
  categoryId: string;
  dayOfMonth: string;
  active: boolean;
  startMonth: string;
}

const EMPTY_FORM: FormState = {
  description: '',
  amount: '',
  categoryId: '',
  dayOfMonth: '1',
  active: true,
  startMonth: currentMonth(),
};

export default function RecurringExpenses() {
  const {
    categories,
    recurringExpenses,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    toggleRecurringActive,
  } = useFinance();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saveError, setSaveError] = useState('');

  // Only active categories are offered. A rule being edited still shows its
  // current category so the form is readable; saving then asks for an active one.
  const eligibleCategories = useMemo(
    () => selectableCategories(categories, form.categoryId)
      .filter(c =>
        !SYSTEM_ADJUSTMENT_ID_SET.has(c.id) &&
        (c.type === 'expense' || c.type === 'commitment' || c.type === 'both' || c.type === 'savings')
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, form.categoryId]
  );

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, categoryId: eligibleCategories[0]?.id || '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = () => {
    const amount = parseCurrencyInput(form.amount);
    const day = parseInt(form.dayOfMonth, 10);
    if (!form.description.trim() || amount <= 0 || !form.categoryId || !day || day < 1 || day > 31) return;

    const payload = {
      description: form.description.trim(),
      amount,
      categoryId: form.categoryId,
      dayOfMonth: day,
      active: form.active,
      startMonth: form.startMonth,
    };

    if (editingId) {
      const existing = recurringExpenses.find(r => r.id === editingId);
      const result = updateRecurring(editingId, {
        ...payload,
        lastGeneratedMonth: existing?.lastGeneratedMonth,
      });
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
    } else {
      const result = addRecurring(payload);
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
    }
    resetForm();
    setSaveError('');
  };

  const startEdit = (id: string) => {
    const r = recurringExpenses.find(x => x.id === id);
    if (!r) return;
    setEditingId(id);
    setShowForm(true);
    setForm({
      description: r.description,
      amount: String(r.amount),
      categoryId: r.categoryId,
      dayOfMonth: String(r.dayOfMonth),
      active: r.active,
      startMonth: r.startMonth,
    });
  };

  const beginAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: eligibleCategories[0]?.id || '' });
    setSaveError('');
    setShowForm(true);
  };

  useFabAction(beginAdd, 'Add recurring expense', 'fab-add-recurring', {
    className: 'bg-accent hover:bg-accent/90 text-accent-foreground',
  });

  return (
    <div className="p-4 md:p-6 pb-40 md:pb-8">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/settings"
          data-testid="recurring-back"
          className="tap-target w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          aria-label="Back to Settings"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Recurring Expenses</h1>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Active recurring items automatically add a transaction every month on the chosen day.
      </p>
      {saveError && <p className="mb-4 text-sm text-destructive" role="alert" data-testid="recurring-save-error">{saveError}</p>}

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.section
            key="recurring-form"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.85 }}
            style={{ overflow: 'hidden' }}
            className="mb-4"
          >
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{editingId ? 'Edit' : 'New'} Recurring Expense</p>

              <div>
                <label htmlFor="recurring-description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Description</label>
                <input id="recurring-description"
                  data-testid="recurring-description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Rent, Netflix, SIP"
                  className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                />
              </div>

              <div>
                <label htmlFor="recurring-amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input id="recurring-amount"
                    data-testid="recurring-amount"
                    type="number"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="recurring-category" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Category</label>
                <select id="recurring-category"
                  data-testid="recurring-category"
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                >
                  <option value="">Select a category</option>
                  {eligibleCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recurring-day" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Day of month</label>
                  <input id="recurring-day"
                    data-testid="recurring-day"
                    type="number"
                    min={1}
                    max={31}
                    value={form.dayOfMonth}
                    onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))}
                    className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="recurring-start" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Start month</label>
                  <input id="recurring-start"
                    data-testid="recurring-start"
                    type="month"
                    value={form.startMonth}
                    onChange={e => setForm(f => ({ ...f, startMonth: e.target.value }))}
                    className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>

              <label className="flex min-h-12 items-center gap-3 text-sm text-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="recurring-active"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="h-5 w-5 rounded accent-current"
                />
                Active — auto-create transactions each month
              </label>

              <div className="flex gap-2">
                <button onClick={resetForm} className="flex-1 min-h-12 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button
                  data-testid="recurring-save"
                  onClick={handleSave}
                  disabled={!form.description.trim() || !form.amount || parseCurrencyInput(form.amount) <= 0 || !form.categoryId}
                  className="flex-1 min-h-12 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {recurringExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <motion.button
            type="button"
            data-testid="empty-add-recurring"
            onClick={beginAdd}
            aria-label="Add your first recurring expense"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="w-16 h-16 rounded-2xl bg-muted hover:bg-muted/80 flex items-center justify-center mb-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={24} />
          </motion.button>
          <p className="text-sm font-semibold mb-1">No recurring expenses yet</p>
          <p className="text-xs text-center max-w-xs">Add rent, subscriptions, EMIs, SIPs or any monthly fixed expense to track them automatically.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recurringExpenses.map(r => {
            const cat = categories.find(c => c.id === r.categoryId);
            return (
              <div
                key={r.id}
                className={cn('bg-card border rounded-2xl p-5', r.active ? 'border-border' : 'border-border opacity-60')}
                data-testid={`recurring-${r.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (cat?.color || '#6366F1') + '22' }}>
                    <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#6366F1'} size={18} />
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(r.id)}
                    className="flex-1 min-w-0 min-h-12 text-left -m-1 p-1 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <p className="text-sm font-semibold text-foreground truncate">{r.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cat?.name || 'Unknown'} • Day {r.dayOfMonth} • from {r.startMonth}
                    </p>
                  </button>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground amount whitespace-nowrap">{formatAmount(r.amount)}</p>
                    <p className={cn('text-[11px] font-semibold uppercase tracking-wider', r.active ? 'text-success' : 'text-muted-foreground')}>
                      {r.active ? 'Active' : 'Paused'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    data-testid={`recurring-toggle-${r.id}`}
                    onClick={() => {
                      const result = toggleRecurringActive(r.id);
                      setSaveError(result.ok ? '' : result.message);
                    }}
                    className="tap-target flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Power size={12} /> {r.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    data-testid={`recurring-edit-${r.id}`}
                    onClick={() => startEdit(r.id)}
                    className="tap-target flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Check size={12} /> Edit
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        data-testid={`recurring-delete-${r.id}`}
                        className="tap-target flex-1 py-2 rounded-lg bg-danger-tint text-danger text-xs font-semibold hover:bg-danger-tint/80 transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete recurring expense?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Existing auto-generated transactions for "{r.description}" will not be removed. Future months will no longer be auto-created.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel><X size={12} className="inline mr-1" />Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                          const result = deleteRecurring(r.id);
                          setSaveError(result.ok ? '' : result.message);
                        }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
