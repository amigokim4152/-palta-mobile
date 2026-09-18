import { randomUUID } from 'node:crypto';

const reviewerUserId = 'mock-user';
const reviewerLabel = 'Usuario Palta';

const evidenceLabels = {
  palta_booking_completed: 'Reserva realizada',
  palta_order_completed: 'Pedido realizado',
  palta_quote_completed: 'Servicio cotizado y realizado',
  palta_service_completed: 'Servicio realizado',
  mutual_service_confirmation: 'Atención confirmada',
};

const verifiedInteractionsByBusiness = new Map([
  ['biz-taller-1', [
    {
      user_id: reviewerUserId,
      kind: 'palta_service_completed',
      reference_id: 'service-taller-mock-user-1',
      completed_at: '2026-09-17T10:00:00-03:00',
    },
  ]],
  ['biz-farmacia-1', [
    {
      user_id: reviewerUserId,
      kind: 'mutual_service_confirmation',
      reference_id: 'visit-farmacia-mock-user-1',
      completed_at: '2026-09-17T11:00:00-03:00',
    },
  ]],
  ['biz-cafe-siete-granos', [
    {
      user_id: reviewerUserId,
      kind: 'palta_booking_completed',
      reference_id: 'booking-cafe-mock-user-1',
      completed_at: '2026-09-17T09:30:00-03:00',
    },
  ]],
  ['biz-patitas-en-casa', [
    {
      user_id: reviewerUserId,
      kind: 'palta_service_completed',
      reference_id: 'service-patitas-mock-user-1',
      completed_at: '2026-09-16T16:00:00-03:00',
    },
  ]],
]);

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
      _author_user_id: 'sample-user-maria',
      _evidence_kind: 'palta_service_completed',
      _evidence_reference_id: 'service-taller-sample-1',
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
      _author_user_id: 'sample-user-tomas',
      _evidence_kind: 'palta_quote_completed',
      _evidence_reference_id: 'quote-taller-sample-2',
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
      _author_user_id: 'sample-user-carolina',
      _evidence_kind: 'mutual_service_confirmation',
      _evidence_reference_id: 'visit-farmacia-sample-1',
    },
  ]],
  ['biz-cafe-siete-granos', [
    {
      id: 'review-cafe-siete-1',
      author_label: 'Daniela',
      rating: 5,
      body: 'Buen café, atención rápida y la terraza estaba tranquila para conversar.',
      verified_interaction: true,
      evidence_label: 'Reserva realizada',
      created_at: '2026-09-17T12:20:00-03:00',
      _author_user_id: 'sample-user-daniela',
      _evidence_kind: 'palta_booking_completed',
      _evidence_reference_id: 'booking-cafe-sample-1',
      business_reply: {
        body: 'Gracias Daniela. Nos alegra que hayas disfrutado la terraza.',
        replied_at: '2026-09-17T15:10:00-03:00',
      },
    },
    {
      id: 'review-cafe-siete-2',
      author_label: 'Ignacio',
      rating: 4,
      body: 'El desayuno llegó rápido y el pan estaba muy bueno.',
      verified_interaction: true,
      evidence_label: 'Atención confirmada',
      created_at: '2026-09-12T10:15:00-03:00',
      _author_user_id: 'sample-user-ignacio',
      _evidence_kind: 'mutual_service_confirmation',
      _evidence_reference_id: 'visit-cafe-sample-2',
    },
  ]],
  ['biz-patitas-en-casa', [
    {
      id: 'review-patitas-1',
      author_label: 'Francisca',
      rating: 5,
      body: 'Vinieron a la hora acordada y mi perro quedó tranquilo durante todo el baño.',
      verified_interaction: true,
      evidence_label: 'Servicio realizado',
      created_at: '2026-09-16T18:10:00-03:00',
      _author_user_id: 'sample-user-francisca',
      _evidence_kind: 'palta_service_completed',
      _evidence_reference_id: 'service-patitas-sample-1',
    },
    {
      id: 'review-patitas-2',
      author_label: 'Rodrigo',
      rating: 5,
      body: 'Cómodo porque vienen a domicilio y explicaron bien qué incluía el servicio.',
      verified_interaction: true,
      evidence_label: 'Servicio cotizado y realizado',
      created_at: '2026-09-09T17:00:00-03:00',
      _author_user_id: 'sample-user-rodrigo',
      _evidence_kind: 'palta_quote_completed',
      _evidence_reference_id: 'quote-patitas-sample-2',
    },
  ]],
  ['biz-panaderia-trigal', [
    {
      id: 'review-trigal-1',
      author_label: 'Paula',
      rating: 5,
      body: 'El pan estaba recién hecho y la atención fue muy rápida.',
      verified_interaction: true,
      evidence_label: 'Pedido realizado',
      created_at: '2026-09-17T08:40:00-03:00',
      _author_user_id: 'sample-user-paula',
      _evidence_kind: 'palta_order_completed',
      _evidence_reference_id: 'order-trigal-sample-1',
    },
  ]],
  ['biz-estudio-menta', [
    {
      id: 'review-menta-1',
      author_label: 'Josefa',
      rating: 5,
      body: 'Reservé con anticipación y respetaron el horario. Muy buena atención.',
      verified_interaction: true,
      evidence_label: 'Reserva realizada',
      created_at: '2026-09-10T19:30:00-03:00',
      _author_user_id: 'sample-user-josefa',
      _evidence_kind: 'palta_booking_completed',
      _evidence_reference_id: 'booking-menta-sample-1',
    },
  ]],
  ['biz-clases-faro', [
    {
      id: 'review-faro-1',
      author_label: 'Marcela',
      rating: 5,
      body: 'La explicación fue clara y después enviaron ejercicios para seguir practicando.',
      verified_interaction: true,
      evidence_label: 'Servicio realizado',
      created_at: '2026-09-13T18:20:00-03:00',
      _author_user_id: 'sample-user-marcela',
      _evidence_kind: 'palta_service_completed',
      _evidence_reference_id: 'service-faro-sample-1',
    },
  ]],
]);

async function readRequestJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function summarize(items) {
  if (!items.length) return { count: 0 };
  const average = items.reduce((sum, item) => sum + item.rating, 0) / items.length;
  return {
    count: items.length,
    average_rating: Math.round(average * 10) / 10,
  };
}

function publicReview(review) {
  return {
    id: review.id,
    author_label: review.author_label,
    rating: review.rating,
    ...(review.body ? { body: review.body } : {}),
    verified_interaction: true,
    evidence_label: review.evidence_label,
    created_at: review.created_at,
    ...(review.business_reply ? { business_reply: review.business_reply } : {}),
  };
}

function sortedPublicReviews(businessId) {
  return [...(reviewsByBusiness.get(businessId) ?? [])]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map(publicReview);
}

function eligibleInteraction(businessId) {
  const reviews = reviewsByBusiness.get(businessId) ?? [];
  const interactions = [...(verifiedInteractionsByBusiness.get(businessId) ?? [])]
    .filter((item) => item.user_id === reviewerUserId)
    .sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at));

  for (const interaction of interactions) {
    const existing = reviews.find(
      (review) =>
        review._author_user_id === reviewerUserId &&
        review._evidence_kind === interaction.kind &&
        review._evidence_reference_id === interaction.reference_id,
    );
    if (!existing) return { eligible: true, interaction };
  }

  if (!interactions.length) {
    return { eligible: false, reason: 'no_verified_interaction' };
  }

  const latest = interactions[0];
  const existing = latest
    ? reviews.find(
        (review) =>
          review._author_user_id === reviewerUserId &&
          review._evidence_kind === latest.kind &&
          review._evidence_reference_id === latest.reference_id,
      )
    : undefined;
  return {
    eligible: false,
    reason: 'already_reviewed',
    ...(existing ? { existing_review_id: existing.id } : {}),
  };
}

function businessExists(businesses, businessId) {
  return businesses.some((business) => business.id === businessId);
}

export function handleBusinessReviewsRequest({ req, res, url, businesses, json }) {
  const eligibilityMatch = url.pathname.match(
    /^\/v1\/business\/([^/]+)\/my-review-eligibility$/,
  );
  if (eligibilityMatch && req.method === 'GET') {
    const businessId = decodeURIComponent(eligibilityMatch[1]);
    if (!businessExists(businesses, businessId)) {
      json(res, 404, { error: 'business_not_found' });
      return true;
    }
    const eligibility = eligibleInteraction(businessId);
    if (!eligibility.eligible) {
      json(res, 200, {
        business_id: businessId,
        eligible: false,
        reason: eligibility.reason,
        ...(eligibility.existing_review_id
          ? { existing_review_id: eligibility.existing_review_id }
          : {}),
      });
      return true;
    }
    const interaction = eligibility.interaction;
    json(res, 200, {
      business_id: businessId,
      eligible: true,
      evidence: {
        kind: interaction.kind,
        reference_id: interaction.reference_id,
        label: evidenceLabels[interaction.kind],
      },
      completed_at: interaction.completed_at,
    });
    return true;
  }

  const replyMatch = url.pathname.match(
    /^\/v1\/business\/([^/]+)\/reviews\/([^/]+)\/reply$/,
  );
  if (replyMatch && req.method === 'PUT') {
    const businessId = decodeURIComponent(replyMatch[1]);
    const reviewId = decodeURIComponent(replyMatch[2]);
    const business = businesses.find((item) => item.id === businessId);
    if (!business) {
      json(res, 404, { error: 'business_not_found' });
      return true;
    }
    if (business.verification_status !== 'verified') {
      json(res, 403, { error: 'verified_owner_required' });
      return true;
    }
    const reviews = reviewsByBusiness.get(businessId) ?? [];
    const review = reviews.find((item) => item.id === reviewId);
    if (!review) {
      json(res, 404, { error: 'review_not_found' });
      return true;
    }
    return readRequestJson(req).then((body) => {
      if (typeof body.body !== 'string' || !body.body.trim()) {
        json(res, 400, { error: 'review_reply_body_required' });
        return true;
      }
      if (body.body.trim().length > 2000) {
        json(res, 400, { error: 'review_reply_body_too_long' });
        return true;
      }
      review.business_reply = {
        body: body.body.trim(),
        replied_at: new Date().toISOString(),
      };
      json(res, 200, publicReview(review));
      return true;
    });
  }

  const reviewsMatch = url.pathname.match(/^\/v1\/business\/([^/]+)\/reviews$/);
  if (!reviewsMatch) return false;

  const businessId = decodeURIComponent(reviewsMatch[1]);
  if (!businessExists(businesses, businessId)) {
    json(res, 404, { error: 'business_not_found' });
    return true;
  }

  if (req.method === 'GET') {
    const items = sortedPublicReviews(businessId);
    json(res, 200, {
      business_id: businessId,
      summary: summarize(items),
      items,
    });
    return true;
  }

  if (req.method === 'POST') {
    return readRequestJson(req).then((body) => {
      if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
        json(res, 400, { error: 'review_rating_invalid' });
        return true;
      }
      if (body.body !== undefined && typeof body.body !== 'string') {
        json(res, 400, { error: 'review_body_must_be_string' });
        return true;
      }
      if (typeof body.body === 'string' && body.body.trim().length > 2000) {
        json(res, 400, { error: 'review_body_too_long' });
        return true;
      }

      const eligibility = eligibleInteraction(businessId);
      if (!eligibility.eligible) {
        json(res, 409, {
          error: eligibility.reason === 'already_reviewed'
            ? 'interaction_already_reviewed'
            : 'verified_interaction_required',
        });
        return true;
      }
      const interaction = eligibility.interaction;
      if (
        body.evidence_kind !== interaction.kind ||
        body.evidence_reference_id !== interaction.reference_id
      ) {
        json(res, 403, { error: 'verified_interaction_mismatch' });
        return true;
      }

      const review = {
        id: `review-${randomUUID()}`,
        author_label: reviewerLabel,
        rating: body.rating,
        ...(typeof body.body === 'string' && body.body.trim()
          ? { body: body.body.trim() }
          : {}),
        verified_interaction: true,
        evidence_label: evidenceLabels[interaction.kind],
        created_at: new Date().toISOString(),
        _author_user_id: reviewerUserId,
        _evidence_kind: interaction.kind,
        _evidence_reference_id: interaction.reference_id,
      };
      const current = reviewsByBusiness.get(businessId) ?? [];
      reviewsByBusiness.set(businessId, [review, ...current]);
      json(res, 201, publicReview(review));
      return true;
    });
  }

  return false;
}
