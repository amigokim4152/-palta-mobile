import { assertMinorAmount } from './transaction.js';

export type POSRegisterStatus = 'active' | 'inactive';
export type CashControlMode = 'none' | 'tracked';

export type POSRegister = {
  id: string;
  businessId: string;
  name: string;
  status: POSRegisterStatus;
  cashControl: CashControlMode;
  revision: number;
  outletId?: string;
  deviceLabel?: string;
};

export type POSSessionStatus = 'open' | 'closed';

export type CashDrawerEntryType =
  | 'cash_sale'
  | 'cash_refund'
  | 'cash_in'
  | 'cash_out'
  | 'adjustment';

export type CashDrawerEntry = {
  id: string;
  sessionId: string;
  businessId: string;
  type: CashDrawerEntryType;
  amountDeltaMinor: number;
  occurredAt: string;
  idempotencyKey: string;
  referenceId?: string;
  note?: string;
};

export type POSSession = {
  id: string;
  businessId: string;
  registerId: string;
  operatorId: string;
  cashControl: CashControlMode;
  status: POSSessionStatus;
  revision: number;
  openedAt: string;
  openingCashMinor: number;
  cashEntries: CashDrawerEntry[];
  closedAt?: string;
  closedBy?: string;
  expectedCashMinor?: number;
  countedCashMinor?: number;
  cashDifferenceMinor?: number;
};

export function createPOSRegister(input: {
  id: string;
  businessId: string;
  name: string;
  cashControl?: CashControlMode;
  outletId?: string;
  deviceLabel?: string;
}): POSRegister {
  if (!input.id.trim() || !input.businessId.trim() || !input.name.trim()) {
    throw new Error('POS register id, businessId and name are required.');
  }
  const register: POSRegister = {
    id: input.id,
    businessId: input.businessId,
    name: input.name,
    status: 'active',
    cashControl: input.cashControl ?? 'none',
    revision: 0,
  };
  if (input.outletId !== undefined) register.outletId = input.outletId;
  if (input.deviceLabel !== undefined) register.deviceLabel = input.deviceLabel;
  return register;
}

export function openPOSSession(input: {
  id: string;
  register: POSRegister;
  operatorId: string;
  openedAt: string;
  openingCashMinor?: number;
}): POSSession {
  if (!input.id.trim() || !input.operatorId.trim()) {
    throw new Error('POS session id and operatorId are required.');
  }
  if (input.register.status !== 'active') {
    throw new Error('Cannot open a session on an inactive register.');
  }
  const openingCashMinor = input.openingCashMinor ?? 0;
  assertMinorAmount(openingCashMinor, 'openingCashMinor');
  if (input.register.cashControl === 'none' && openingCashMinor !== 0) {
    throw new Error('Cash-untracked register cannot declare opening cash.');
  }
  return {
    id: input.id,
    businessId: input.register.businessId,
    registerId: input.register.id,
    operatorId: input.operatorId,
    cashControl: input.register.cashControl,
    status: 'open',
    revision: 0,
    openedAt: input.openedAt,
    openingCashMinor,
    cashEntries: [],
  };
}

export function createCashDrawerEntry(input: {
  id: string;
  session: POSSession;
  type: CashDrawerEntryType;
  amountMinor: number;
  occurredAt: string;
  idempotencyKey: string;
  referenceId?: string;
  note?: string;
}): CashDrawerEntry {
  if (input.session.status !== 'open') {
    throw new Error('Cash movement requires an open POS session.');
  }
  if (input.session.cashControl !== 'tracked') {
    throw new Error('Cash movement cannot be recorded on an untracked cash session.');
  }
  if (!input.id.trim() || !input.idempotencyKey.trim()) {
    throw new Error('Cash movement id and idempotencyKey are required.');
  }
  assertMinorAmount(input.amountMinor, 'cash movement amount');

  const negative = input.type === 'cash_refund' || input.type === 'cash_out';
  const amountDeltaMinor = negative ? -input.amountMinor : input.amountMinor;
  const entry: CashDrawerEntry = {
    id: input.id,
    sessionId: input.session.id,
    businessId: input.session.businessId,
    type: input.type,
    amountDeltaMinor,
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
  };
  if (input.referenceId !== undefined) entry.referenceId = input.referenceId;
  if (input.note !== undefined) entry.note = input.note;
  return entry;
}

export function appendCashDrawerEntry(
  session: POSSession,
  entry: CashDrawerEntry,
): POSSession {
  if (session.status !== 'open') throw new Error('Cannot change a closed POS session.');
  if (entry.sessionId !== session.id || entry.businessId !== session.businessId) {
    throw new Error('Cash movement belongs to another POS session.');
  }
  if (session.cashEntries.some((existing) => existing.idempotencyKey === entry.idempotencyKey)) {
    return session;
  }
  return {
    ...session,
    revision: session.revision + 1,
    cashEntries: [...session.cashEntries, { ...entry }],
  };
}

export function expectedCashMinor(session: POSSession): number {
  if (session.cashControl !== 'tracked') return 0;
  const expected = session.cashEntries.reduce(
    (sum, entry) => sum + entry.amountDeltaMinor,
    session.openingCashMinor,
  );
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw new Error('Expected cash cannot be negative or exceed safe integer precision.');
  }
  return expected;
}

export function closePOSSession(input: {
  session: POSSession;
  closedAt: string;
  closedBy: string;
  countedCashMinor?: number;
}): POSSession {
  if (input.session.status !== 'open') throw new Error('POS session is already closed.');
  if (!input.closedBy.trim()) throw new Error('closedBy is required.');

  if (input.session.cashControl === 'none') {
    if (input.countedCashMinor !== undefined) {
      throw new Error('Untracked cash session does not accept a cash count.');
    }
    return {
      ...input.session,
      status: 'closed',
      revision: input.session.revision + 1,
      closedAt: input.closedAt,
      closedBy: input.closedBy,
    };
  }

  if (input.countedCashMinor === undefined) {
    throw new Error('Tracked cash session requires counted cash to close.');
  }
  assertMinorAmount(input.countedCashMinor, 'countedCashMinor');
  const expected = expectedCashMinor(input.session);
  return {
    ...input.session,
    status: 'closed',
    revision: input.session.revision + 1,
    closedAt: input.closedAt,
    closedBy: input.closedBy,
    expectedCashMinor: expected,
    countedCashMinor: input.countedCashMinor,
    cashDifferenceMinor: input.countedCashMinor - expected,
  };
}
