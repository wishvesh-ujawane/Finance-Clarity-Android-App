import { useMemo, useState } from 'react';
import { Link } from 'wouter';
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
import { currentMonth, formatINR } from '@/lib/finance-utils';

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

  const eligibleCategories = useMemo(
    () => categories.filter(c => c.type === 'expense' || c.type === 'commitment' || c.type === 'both' || c.type === 'savings'),
    [categories]
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, categoryId: eligibleCategories[0]?.id || '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = () => {
    const amount = parseFloat(form.amount);
    const day = parseInt(form.dayOfMonth, 10);
    if (!form.description.trim() || !amount || amount <= 0 || !form.categoryId || !day || day < 1 || day > 31) return;

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
      updateRecurring(editingId, {
        ...payload,
        lastGeneratedMonth: existing?.lastGeneratedMonth,
      });
    } else {
      addRecurring(payload);
    }
    resetForm();
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
    setShowForm(true);
  };

  useFabAction(beginAdd, 'Add recurring expense', 'fab-add-recurring');

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/settings">
          <button
            type="button"
            data-testid="recurring-back"
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
            aria-label="Back to Settings"
          >
            <ArrowLeft size={16} />
          </button>
        </Link>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Recurring Expenses</h1>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Active recurring items automatically add a transaction every month on the chosen day.
      </p>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-4">
          <p className="text-sm font-bold text-foreground">{editingId ? 'Edit' : 'New'} Recurring Expense</p>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
            <input
              data-testid="recurring-description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Rent, Netflix, SIP"
              className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
              <input
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</label>
            <select
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Day of month</label>
              <input
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Start month</label>
              <input
                data-testid="recurring-start"
                type="month"
                value={form.startMonth}
                onChange={e => setForm(f => ({ ...f, startMonth: e.target.value }))}
                className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              data-testid="recurring-active"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="w-4 h-4 rounded accent-current"
            />
            Active — auto-create transactions each month
          </label>

          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button
              data-testid="recurring-save"
              onClick={handleSave}
              disabled={!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0 || !form.categoryId}
              className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {recurringExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><Plus size={24} /></div>
          <p className="text-sm font-semibold mb-1">No recurring expenses yet</p>
          <p className="text-xs text-center max-w-xs">Add rent, subscriptions, EMIs, SIPs or any monthly fixed expense to track them automatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recurringExpenses.map(r => {
            const cat = categories.find(c => c.id === r.categoryId);
            return (
              <div
                key={r.id}
                className={cn('bg-card border rounded-2xl p-4', r.active ? 'border-border' : 'border-border opacity-60')}
                data-testid={`recurring-${r.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (cat?.color || '#6366F1') + '22' }}>
                    <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#6366F1'} size={18} />
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(r.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-semibold text-foreground truncate">{r.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cat?.name || 'Unknown'} • Day {r.dayOfMonth} • from {r.startMonth}
                    </p>
                  </button>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">{formatINR(r.amount)}</p>
                    <p className={cn('text-[10px] font-semibold uppercase tracking-wider', r.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                      {r.active ? 'Active' : 'Paused'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    data-testid={`recurring-toggle-${r.id}`}
                    onClick={() => toggleRecurringActive(r.id)}
                    className="flex-1 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Power size={12} /> {r.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    data-testid={`recurring-edit-${r.id}`}
                    onClick={() => startEdit(r.id)}
                    className="flex-1 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Check size={12} /> Edit
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        data-testid={`recurring-delete-${r.id}`}
                        className="flex-1 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors inline-flex items-center justify-center gap-1.5"
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
                        <AlertDialogAction onClick={() => deleteRecurring(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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
