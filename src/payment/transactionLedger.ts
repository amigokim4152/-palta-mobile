import type {
  PaymentEvent,
  PaymentStatus,
} from './paymentModel.js';

const terminalStatuses = new Set<PaymentStatus>([
  'paid',
  'failed',
  'cancelled',
  'refunded',
]);

export type LedgerEntry = PaymentEvent & {
  sequence: number;
};

export class InMemoryTransactionLedger {
  private readonly entries: LedgerEntry[] = [];

  append(event: PaymentEvent): LedgerEntry {
    const duplicate = this.entries.find((entry) => entry.id === event.id);
    if (duplicate) return duplicate;

    const entry: LedgerEntry = {
      ...event,
      sequence: this.entries.length + 1,
    };
    this.entries.push(entry);
    return entry;
  }

  listForPayment(paymentIntentId: string): LedgerEntry[] {
    return this.entries
      .filter((entry) => entry.paymentIntentId === paymentIntentId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  hasTerminalEvent(paymentIntentId: string): boolean {
    const statusByType: Partial<Record<PaymentEvent['type'], PaymentStatus>> = {
      payment_paid: 'paid',
      payment_failed: 'failed',
      payment_cancelled: 'cancelled',
      refund_completed: 'refunded',
    };

    return this.listForPayment(paymentIntentId).some((entry) => {
      const status = statusByType[entry.type];
      return status ? terminalStatuses.has(status) : false;
    });
  }
}
