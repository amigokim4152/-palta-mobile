const reviewsByBusiness = new Map([
  ['biz-taller-1', [
    {
      id: 'review-taller-1',
      author_label: 'María',
      rating: 5,
      body: 'Explicaron el trabajo con claridad y cumplieron el horario acordado.',
      verified_interaction: true,
      evidence_label: 'Servicio realizado',
      created_at: '2026-09-15T16:30:00-03:00',
      business_reply: {
        body: 'Gracias por confiar en nosotros.',
        replied_at: '2026-09-15T18:10:00-03:00',
      },
    },
    {
      id: 'review-taller-2',
      author_label: 'Tomás',
      rating: 4,
      body: 'Buena atención y explicación antes de hacer la reparación.',
      verified_interaction: true,
      evidence_label: 'Servicio cotizado y realizado',
      created_at: '2026-09-10T11:20:00-03:00',
    },
  ]],
  ['biz-farmacia-1', [
    {
      id: 'review-farmacia-1',
      author_label: 'Carolina',
      rating: 5,
      body: 'Me orientaron bien y la atención fue rápida.',
      verified_interaction: true,
      evidence_label: 'Atención confirmada',
      created_at: '2026-09-14T13:05:00-03:00',
    },
  ]],
]);

function summarize(items) {
  if (!items.length) return { count: 0 };
  const average = items.reduce((sum, item) => sum + item.rating, 0) / items.length;
  return {
    count: items.length,
    average_rating: Math.round(average * 10) / 10,
  };
}

export function handleBusinessReviewsRequest({ req, res, url, businesses, json }) {
  if (req.method !== 'GET') return false;
  const match = url.pathname.match(/^\/v1\/business\/([^/]+)\/reviews$/);
  if (!match) return false;

  const businessId = decodeURIComponent(match[1]);
  if (!businesses.some((business) => business.id === businessId)) {
    json(res, 404, { error: 'business_not_found' });
    return true;
  }

  const items = [...(reviewsByBusiness.get(businessId) ?? [])]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  json(res, 200, {
    business_id: businessId,
    summary: summarize(items),
    items,
  });
  return true;
}
