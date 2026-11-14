import { isCardPurchase } from '@/lib/domain/finance-metrics';
import type { Transaction } from '@/lib/types';

/** "Card" badge for a transaction row that was paid with the credit card (DESIGN §5.10 badge). */
export function CardPurchaseBadge({ tx }: { tx: Pick<Transaction, 'type' | 'paymentMethod'> }) {
  if (!isCardPurchase(tx)) return null;
  return (
    <span className="ml-1.5 rounded-lg bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground align-middle" data-testid="card-purchase-badge">
      Card
    </span>
  );
}
