import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { CalendarClock, ChevronLeft, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { formatINR, localDateStr } from '@/lib/finance-utils';
import type { RecurringEntry } from '@/lib/types';

function daySuffix(day: number) {
  if (day % 10 === 1 && day % 100 !== 11) return 'st';
  if (day % 10 === 2 && day % 100 !== 12) return 'nd';
  if (day % 10 === 3 && day % 100 !== 13) return 'rd';
  return 'th';
}

function recurringDayLabel(startDate: string) {
  const day = Number.parseInt(startDate.slice(8, 10), 10);
  if (!Number.isFinite(day) || day <= 0) return 'month-end';
  return `${day}${daySuffix(day)}`;
}

function recurringStartLabel(startDate: string) {
  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return startDate;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface EditorState {
  mode: 'add' | 'edit';
  id: string | null;
  type: 'income' | 'expense';
  categoryId: string;
  amount: string;
  startDate: string;
  description: string;
  enabled: boolean;
}

function createDefaultEditorState(): EditorState {
  return {
    mode: 'add',
    id: null,
    type: 'expense',
    categoryId: '',
    amount: '',
    startDate: localDateStr(new Date()),
    description: '',
    enabled: true,
  };
}

export default function Recurring() {
  const [, navigate] = useLocation();
  const {
    recurringEntries,
    categories,
    addRecurringEntry,
    updateRecurringEntry,
    deleteRecurringEntry,
    toggleRecurringEntry,
  } = useFinance();

  const [editor, setEditor] = useState<EditorState | null>(null);

  const recurringWithCategory = useMemo(
    () => recurringEntries
      .map(entry => ({ entry, category: categories.find(category => category.id === entry.categoryId) }))
      .sort((a, b) => Number(b.entry.enabled) - Number(a.entry.enabled)),
    [recurringEntries, categories]
  );

  const categoryOptions = useMemo(
    () => categories.filter(category => category.type === editor?.type || category.type === 'both'),
    [categories, editor?.type]
  );

  const openCreate = () => {
    setEditor(createDefaultEditorState());
  };

  const openEdit = (entry: RecurringEntry) => {
    setEditor({
      mode: 'edit',
      id: entry.id,
      type: entry.type,
      categoryId: entry.categoryId,
      amount: String(entry.amount),
      startDate: entry.startDate,
      description: entry.description || '',
      enabled: entry.enabled,
    });
  };

  const closeEditor = () => {
    setEditor(null);
  };

  const saveEditor = () => {
    if (!editor || !editor.categoryId || !editor.startDate) return;
    const parsedAmount = Number.parseFloat(editor.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    const payload = {
      type: editor.type,
      categoryId: editor.categoryId,
      amount: parsedAmount,
      startDate: editor.startDate,
      description: editor.description.trim(),
      enabled: editor.enabled,
      frequency: 'monthly' as const,
    };

    if (editor.mode === 'add') {
      addRecurringEntry(payload);
    } else if (editor.id) {
      updateRecurringEntry(editor.id, payload);
    }

    closeEditor();
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 rounded-xl border border-border text-muted-foreground hover:bg-muted/40 transition-colors flex items-center justify-center"
          aria-label="Back to settings"
        >
          <ChevronLeft size={16} />
        </button>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Automation</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Recurring Transactions</h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <CalendarClock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Monthly Schedule</p>
            <p className="text-xs text-muted-foreground">Create salary, EMI, SIP, and bill entries with optional description notes.</p>
          </div>
          <button
            onClick={openCreate}
            className="px-3 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            <Plus size={13} className="inline mr-1" />
            Add
          </button>
        </div>

        <div className="p-5 space-y-3">
          {editor && (
            <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
              <p className="text-xs font-bold text-foreground">{editor.mode === 'add' ? 'New Recurring Transaction' : 'Edit Recurring Transaction'}</p>

              <div className="flex gap-1.5">
                {(['expense', 'income'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setEditor(current => current ? { ...current, type, categoryId: '' } : current)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-semibold capitalize',
                      editor.type === type ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <select
                value={editor.categoryId}
                onChange={event => setEditor(current => current ? { ...current, categoryId: event.target.value } : current)}
                className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select category</option>
                {categoryOptions.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>

              <input
                type="number"
                min="0"
                step="0.01"
                value={editor.amount}
                onChange={event => setEditor(current => current ? { ...current, amount: event.target.value } : current)}
                className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
                placeholder="Amount"
              />

              <input
                type="date"
                value={editor.startDate}
                onChange={event => setEditor(current => current ? { ...current, startDate: event.target.value } : current)}
                className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
              />

              <input
                type="text"
                value={editor.description}
                onChange={event => setEditor(current => current ? { ...current, description: event.target.value } : current)}
                className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
                placeholder="Description (optional)"
              />

              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 bg-white dark:bg-card">
                <span className="text-sm font-medium text-foreground">Enabled</span>
                <Switch checked={editor.enabled} onCheckedChange={enabled => setEditor(current => current ? { ...current, enabled } : current)} />
              </div>

              <div className="flex gap-2">
                <button onClick={saveEditor} className="flex-1 py-2 rounded-xl bg-accent text-white text-xs font-semibold">Save</button>
                <button onClick={closeEditor} className="flex-1 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold">Cancel</button>
              </div>
            </div>
          )}

          {recurringWithCategory.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <p className="text-sm font-medium">No recurring transactions yet</p>
              <p className="text-xs mt-1">Add monthly entries for salary, rent, subscriptions, and bills.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recurringWithCategory.map(({ entry, category }) => (
                <div key={entry.id} className="rounded-xl border border-border px-3 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (category?.color || '#6366F1') + '22' }}>
                        <CategoryIcon icon={category?.icon || 'DollarSign'} color={category?.color || '#6366F1'} size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{category?.name || 'Missing category'}</p>
                        <p className="text-xs text-muted-foreground">
                          Monthly on {recurringDayLabel(entry.startDate)} • Starts {recurringStartLabel(entry.startDate)}
                        </p>
                        {entry.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{entry.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatINR(entry.amount)}</p>
                      <span className={cn(
                        'inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize',
                        entry.type === 'income' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      )}
                      >
                        {entry.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(entry)}
                        className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/40 transition-colors flex items-center justify-center"
                        aria-label="Edit recurring transaction"
                      >
                        <RefreshCw size={13} />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="w-8 h-8 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center"
                            aria-label="Delete recurring transaction"
                          >
                            <Trash2 size={13} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Recurring Transaction?</AlertDialogTitle>
                            <AlertDialogDescription>This will stop future auto-created transactions for this recurring entry.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteRecurringEntry(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{entry.enabled ? 'Enabled' : 'Disabled'}</span>
                      <Switch checked={entry.enabled} onCheckedChange={checked => toggleRecurringEntry(entry.id, checked)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

