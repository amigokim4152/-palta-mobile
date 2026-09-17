import {
  evaluateBusinessReviewEligibility,
  projectPublicBusinessReviews,
  summarizeBusinessReviews,
  validateBusinessReview,
  type BusinessReview,
} from '../src/business/businessReview.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const validReview: BusinessReview = {
  id: 'review-1',
  businessId: 'business-1',
  authorUserId: 'user-1',
  authorLabel: 'María',
  rating: 5,
  body: 'Llegaron a la hora y explicaron bien el trabajo.',
  evidence: {
    kind: 'palta_service_completed',
    referenceId: 'service-1',
  },
  status: 'published',
  createdAt: '2026-09-17T12:00:00-03:00',
};

assert(validateBusinessReview(validReview).length === 0, 'valid review should pass');

assert(
  validateBusinessReview({
    ...validReview,
    evidence: { ...validReview.evidence, referenceId: '' },
  }).includes('interaction_evidence_required'),
  'published review must have interaction evidence',
);

assert(
  validateBusinessReview({ ...validReview, rating: 6 }).includes('rating_must_be_integer_1_to_5'),
  'rating outside 1-5 should fail',
);

assert(
  validateBusinessReview({
    ...validReview,
    businessReply: {
      body: 'x'.repeat(2001),
      repliedAt: '2026-09-17T13:00:00-03:00',
    },
  }).includes('business_reply_body_too_long'),
  'business reply must remain bounded',
);

const eligible = evaluateBusinessReviewEligibility({
  businessId: 'business-1',
  userId: 'user-2',
  interactions: [
    {
      businessId: 'business-1',
      userId: 'user-2',
      evidence: { kind: 'palta_booking_completed', referenceId: 'booking-2' },
      completedAt: '2026-09-18T09:00:00-03:00',
    },
  ],
  reviews: [validReview],
});
assert(eligible.eligible, 'completed verified interaction should enable review writing');
assert(
  eligible.eligible && eligible.evidence.referenceId === 'booking-2',
  'eligibility must return the verified interaction evidence to use',
);

const duplicate = evaluateBusinessReviewEligibility({
  businessId: 'business-1',
  userId: 'user-1',
  interactions: [
    {
      businessId: 'business-1',
      userId: 'user-1',
      evidence: { kind: 'palta_service_completed', referenceId: 'service-1' },
      completedAt: '2026-09-17T11:00:00-03:00',
    },
  ],
  reviews: [validReview],
});
assert(!duplicate.eligible && duplicate.reason === 'already_reviewed', 'same interaction must not create duplicate review');

const noInteraction = evaluateBusinessReviewEligibility({
  businessId: 'business-1',
  userId: 'user-3',
  interactions: [],
  reviews: [validReview],
});
assert(
  !noInteraction.eligible && noInteraction.reason === 'no_verified_interaction',
  'review writing must not open without verified interaction evidence',
);

const publicReviews = projectPublicBusinessReviews([
  validReview,
  {
    ...validReview,
    id: 'review-held',
    status: 'held',
  },
  {
    ...validReview,
    id: 'review-2',
    authorUserId: 'user-2',
    authorLabel: 'Tomás',
    rating: 4,
    createdAt: '2026-09-18T09:00:00-03:00',
    evidence: {
      kind: 'palta_booking_completed',
      referenceId: 'booking-2',
    },
    businessReply: {
      body: 'Gracias por venir.',
      repliedAt: '2026-09-18T10:00:00-03:00',
    },
  },
]);

assert(publicReviews.length === 2, 'only valid published reviews should be public');
assert(publicReviews[0]?.id === 'review-2', 'newest public review should come first');
assert(publicReviews.every((review) => review.verifiedInteraction), 'public reviews must be verified-interaction reviews');
assert(
  !('authorUserId' in (publicReviews[0] as unknown as Record<string, unknown>)),
  'public review projection must not expose canonical user id',
);

const summary = summarizeBusinessReviews(publicReviews);
assert(summary.count === 2, 'summary should count public reviews');
assert(summary.averageRating === 4.5, 'summary should compute one-decimal average');

console.log('PASS: Local Business verified-interaction review contract');
