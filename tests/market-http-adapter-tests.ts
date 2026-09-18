import {
  createMarketHttpPorts,
  type MarketHttpRequest,
  type MarketHttpTransport,
} from '../src/market/marketHttpAdapter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const requests: MarketHttpRequest[] = [];

function listingWire(input?: {
  tradeMode?: 'sale' | 'free';
  priceClp?: number;
}) {
  return {
    id: 'listing-1',
    seller_user_id: 'seller-1',
    title: 'Bicicleta urbana',
    description: 'Buen estado',
    category: 'sports',
    trade_mode: input?.tradeMode ?? 'sale',
    ...(typeof input?.priceClp === 'number'
      ? { price_clp: input.priceClp }
      : input?.tradeMode === 'free'
        ? {}
        : { price_clp: 120000 }),
    status: 'active',
    location: {
      comuna_code: '13132',
      comuna_name: 'Vitacura',
    },
    media: [
      {
        media_asset_id: 'media-1',
        sort_order: 0,
        alt_text: 'Bicicleta urbana',
      },
    ],
    created_at: '2026-09-18T12:00:00Z',
    updated_at: '2026-09-18T12:10:00Z',
    published_at: '2026-09-18T12:00:00Z',
    version: 2,
  };
}

const transport: MarketHttpTransport = {
  async request(input) {
    requests.push(input);

    if (
      input.method === 'PATCH' &&
      input.path === '/v1/market/listings/listing-1'
    ) {
      return {
        status: 200,
        payload: listingWire({ tradeMode: 'free' }),
      };
    }

    if (
      input.method === 'GET' &&
      input.path === '/v1/market/listings/listing-1/favorite'
    ) {
      return { status: 200, payload: { favorite: true } };
    }

    if (input.method === 'GET' && input.path === '/v1/market/me/transactions') {
      return {
        status: 200,
        payload: {
          items: [
            {
              id: 'transaction-1',
              listing_id: 'listing-1',
              seller_user_id: 'seller-1',
              buyer_user_id: 'buyer-1',
              status: 'completed',
              listing_snapshot: {
                listing_id: 'listing-1',
                title: 'Bicicleta urbana',
                category: 'sports',
                trade_mode: 'sale',
                price_clp: 120000,
                comuna_name: 'Vitacura',
                media_asset_id: 'media-1',
              },
              conversation_id: 'conversation-1',
              created_at: '2026-09-18T12:05:00Z',
              updated_at: '2026-09-18T13:00:00Z',
              completed_at: '2026-09-18T13:00:00Z',
            },
          ],
          next_cursor: 'next-1',
        },
      };
    }

    return { status: 404, payload: { code: 'NOT_FOUND', message: 'Not found.' } };
  },
};

const ports = createMarketHttpPorts(transport);

const updated = await ports.mutation.updateListing({
  listingId: 'listing-1',
  expectedVersion: 1,
  patch: {
    tradeMode: 'free',
    priceClp: null,
  },
});

const patchRequest = requests[0];
assert(patchRequest, 'PATCH request must be emitted.');
assert(patchRequest.auth === 'required', 'Listing edits must require Palta authentication.');
assert(patchRequest.method === 'PATCH', 'Listing edits must use PATCH.');
const patchBody = patchRequest.body as {
  expected_version?: unknown;
  patch?: Record<string, unknown>;
};
assert(patchBody.expected_version === 1, 'Optimistic version must use expected_version wire key.');
assert(patchBody.patch?.trade_mode === 'free', 'tradeMode must serialize as trade_mode.');
assert(
  Object.prototype.hasOwnProperty.call(patchBody.patch, 'price_clp'),
  'Price-clear PATCH must explicitly send price_clp.',
);
assert(patchBody.patch?.price_clp === null, 'priceClp: null must serialize as price_clp: null.');
assert(updated.tradeMode === 'free', 'Wire response must parse trade_mode back to canonical tradeMode.');
assert(updated.priceClp === undefined, 'Cleared wire price must remain absent in canonical listing.');

const favorite = await ports.read.getMyFavoriteState('listing-1');
assert(favorite, 'Favorite state must parse boolean wire payload.');
const favoriteRequest = requests[1];
assert(favoriteRequest?.auth === 'required', 'Favorite-state read must require authentication.');

const transactions = await ports.read.listMyTransactions({ limit: 10 });
assert(transactions.items.length === 1, 'Transaction page must parse items.');
assert(transactions.nextCursor === 'next-1', 'next_cursor must parse to nextCursor.');
const transaction = transactions.items[0];
assert(transaction?.listingSnapshot.title === 'Bicicleta urbana', 'Transaction snapshot must parse.');
assert(transaction?.conversationId === 'conversation-1', 'conversation_id must parse to conversationId.');
const transactionsRequest = requests[2];
assert(transactionsRequest?.auth === 'required', 'My transactions must require authentication.');
assert(transactionsRequest?.query?.limit === 10, 'Cursor query values must be preserved.');

console.log('PASS: Mercado HTTP adapter auth, snake_case parsing and explicit price clearing');
