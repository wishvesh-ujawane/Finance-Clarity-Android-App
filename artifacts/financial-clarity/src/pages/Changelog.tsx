import { Link } from 'wouter';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { getChangelog, type ChangeKind, type ChangelogEntry } from '@/lib/changelog';
import { formatDateLabel } from '@/lib/format';

const KIND_LABEL: Record<ChangeKind, string> = { new: 'New', fixed: 'Fixed' };
const KIND_CLASS: Record<ChangeKind, string> = {
  new: 'bg-accent/10 text-accent',
  fixed: 'bg-secondary text-secondary-foreground',
};

export default function Changelog() {
  return <ChangelogView entries={getChangelog()} />;
}

export function ChangelogView({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          data-testid="changelog-back"
          className="tap-target w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>What&rsquo;s New</h1>
        </div>
      </div>

      {entries.length === 0 ? (
        <div
          data-testid="changelog-empty"
          className="bg-card border border-border rounded-2xl px-5 py-8 flex flex-col items-center text-center gap-2"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} />
          </div>
          <p className="text-sm font-bold text-foreground">No updates yet</p>
          <p className="text-xs text-muted-foreground">Changes from each new version will appear here.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4" data-testid="changelog-list">
          {entries.map((entry, index) => (
            <li
              key={`${entry.date}-${entry.version}-${index}`}
              className="bg-card border border-border rounded-2xl p-5"
              data-testid="changelog-entry"
            >
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  {formatDateLabel(entry.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">v{entry.version}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${KIND_CLASS[change.kind]}`}
                    >
                      {KIND_LABEL[change.kind]}
                    </span>
                    <span className="text-sm text-foreground">{change.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
