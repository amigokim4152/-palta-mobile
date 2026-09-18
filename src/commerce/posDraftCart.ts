import {
  calculateLineAmountMinor,
  type CommerceLine,
  type CommerceLineKind,
} from './transaction.js';

export type POSCatalogItem = {
  id: string;
  title: string;
  unitAmountMinor: number;
  kind?: Exclude<CommerceLineKind, 'custom'>;
  productId?: string;
  variantId?: string;
  serviceId?: string;
};

export type POSDraftCartSummary = {
  lineCount: number;
  itemCount: number;
  totalAmountMinor: number;
};

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function requirePositiveMinorAmount(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive safe integer in minor units.`);
  }
  return value;
}

function catalogLineId(item: POSCatalogItem): string {
  return `catalog:${requireText(item.id, 'catalog item id')}`;
}

export function createPOSCustomLine(input: {
  id: string;
  title?: string;
  amountMinor: number;
}): CommerceLine {
  const id = requireText(input.id, 'line id');
  const unitAmountMinor = requirePositiveMinorAmount(input.amountMinor, 'amountMinor');
  return {
    id,
    kind: 'custom',
    title: input.title?.trim() || 'Venta rápida',
    quantity: 1,
    unitAmountMinor,
    lineAmountMinor: unitAmountMinor,
  };
}

export function addPOSCatalogItem(
  lines: readonly CommerceLine[],
  item: POSCatalogItem,
): CommerceLine[] {
  const title = requireText(item.title, 'catalog item title');
  const unitAmountMinor = requirePositiveMinorAmount(
    item.unitAmountMinor,
    'unitAmountMinor',
  );
  const id = catalogLineId(item);
  const index = lines.findIndex((line) => line.id === id);

  if (index >= 0) {
    return lines.map((line, lineIndex) => {
      if (lineIndex !== index) return { ...line };
      const quantity = line.quantity + 1;
      return {
        ...line,
        quantity,
        lineAmountMinor: calculateLineAmountMinor(quantity, line.unitAmountMinor),
      };
    });
  }

  const line: CommerceLine = {
    id,
    kind: item.kind ?? 'product',
    title,
    quantity: 1,
    unitAmountMinor,
    lineAmountMinor: unitAmountMinor,
  };
  if (item.productId !== undefined) line.productId = item.productId;
  if (item.variantId !== undefined) line.variantId = item.variantId;
  if (item.serviceId !== undefined) line.serviceId = item.serviceId;

  return [...lines.map((existing) => ({ ...existing })), line];
}

export function appendPOSCustomLine(
  lines: readonly CommerceLine[],
  line: CommerceLine,
): CommerceLine[] {
  if (line.kind !== 'custom') {
    throw new Error('appendPOSCustomLine only accepts custom lines.');
  }
  if (lines.some((existing) => existing.id === line.id)) {
    throw new Error(`Duplicate POS line id: ${line.id}`);
  }
  return [...lines.map((existing) => ({ ...existing })), { ...line }];
}

export function decrementPOSLine(
  lines: readonly CommerceLine[],
  lineId: string,
): CommerceLine[] {
  const normalizedId = requireText(lineId, 'line id');
  const existing = lines.find((line) => line.id === normalizedId);
  if (!existing) return lines.map((line) => ({ ...line }));

  if (existing.quantity <= 1) {
    return lines.filter((line) => line.id !== normalizedId).map((line) => ({ ...line }));
  }

  return lines.map((line) => {
    if (line.id !== normalizedId) return { ...line };
    const quantity = line.quantity - 1;
    return {
      ...line,
      quantity,
      lineAmountMinor: calculateLineAmountMinor(quantity, line.unitAmountMinor),
    };
  });
}

export function summarizePOSDraftCart(
  lines: readonly CommerceLine[],
): POSDraftCartSummary {
  let itemCount = 0;
  let totalAmountMinor = 0;

  for (const line of lines) {
    const expected = calculateLineAmountMinor(line.quantity, line.unitAmountMinor);
    if (expected !== line.lineAmountMinor) {
      throw new Error(`Line ${line.id} has an inconsistent amount.`);
    }
    itemCount += line.quantity;
    totalAmountMinor += line.lineAmountMinor;
  }

  if (!Number.isSafeInteger(itemCount) || !Number.isSafeInteger(totalAmountMinor)) {
    throw new Error('POS draft cart total exceeds safe integer range.');
  }

  return {
    lineCount: lines.length,
    itemCount,
    totalAmountMinor,
  };
}
