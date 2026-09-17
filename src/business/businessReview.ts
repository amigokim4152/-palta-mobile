export type BusinessReviewEvidenceKind =
  | 'palta_booking_completed'
  | 'palta_order_completed'
  | 'palta_quote_completed'
  | 'palta_service_completed'
  | 'mutual_service_confirmation';

export type BusinessReviewEvidence = {
  kind: BusinessReviewEvidenceKind;
  referenceId: string;
};

export type BusinessReview = {
  id: string;
  businessId: string;
  authorUserId: string;
  authorLabel: string;
  rating: number;
  body?: string;
  evidence: BusinessReviewEvidence;
  status: 'published' | 'held' | 'removed';
  createdAt: string;
  businessReply?: {
    body: string;
    repliedAt: string;
  };
};

export type BusinessReviewInteraction = {
  businessId: string;
  userId: string;
  evidence: BusinessReviewEvidence;
  completedAt: string;
};

export type BusinessReviewEligibility =
  | {
      eligible: true;
      evidence: BusinessReviewEvidence;
      completedAt: string;
    }
  | {
      eligible: false;
      reason: 'no_verified_interaction' | 'already_reviewed';
      existingReviewId?: string;
    };

export type PublicBusinessReview = {
  id: string;
  authorLabel: string;
  rating: number;
  body?: string;
  verifiedInteraction: true;
  evidenceLabel: string;
  createdAt: string;
  businessReply?: {
    body: string;
    repliedAt: string;
  };
};

export type BusinessReviewSummary = {
  count: number;
  averageRating?: number;
};

const evidenceLabels: Record<BusinessReviewEvidenceKind, string> = {
  palta_booking_completed: 'Reserva realizada',
  palta_order_completed: 'Pedido realizado',
  palta_quote_completed: 'Servicio cotizado y realizado',
  palta_service_completed: 'Servicio realizado',
  mutual_service_confirmation: 'Atención confirmada',
};

export function businessReviewEvidenceLabel(kind: BusinessReviewEvidenceKind): string {
  return evidenceLabels[kind];
}

export function evaluateBusinessReviewEligibility(input: {
  businessId: string;
  userId: string;
  interactions: readonly BusinessReviewInteraction[];
  reviews: readonly BusinessReview[];
}): BusinessReviewEligibility {
  const completed = input.interactions
    .filter(
      (interaction) =>
        interaction.businessId === input.businessId &&
        interaction.userId === input.userId &&
        interaction.evidence.referenceId.trim() &&
        Number.isFinite(Date.parse(interaction.completedAt)),
    )
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));

  if (!completed.length) {
    return { eligible: false, reason: 'no_verified_interaction' };
  }

  for (const interaction of completed) {
    const existing = input.reviews.find(
      (review) =>
        review.businessId === input.businessId &&
        review.authorUserId === input.userId &&
        review.evidence.kind === interaction.evidence.kind &&
        review.evidence.referenceId === interaction.evidence.referenceId &&
        review.status !== 'removed',
    );
    if (!existing) {
      return {
        eligible: true,
        evidence: interaction.evidence,
        completedAt: interaction.completedAt,
      };
    }
  }

  const latest = completed[0];
  const existingReview = latest
    ? input.reviews.find(
        (review) =>
          review.businessId === input.businessId &&
          review.authorUserId === input.userId &&
          review.evidence.kind === latest.evidence.kind &&
          review.evidence.referenceId === latest.evidence.referenceId &&
          review.status !== 'removed',
      )
    : undefined;

  return {
    eligible: false,
    reason: 'already_reviewed',
    ...(existingReview ? { existingReviewId: existingReview.id } : {}),
  };
}

export function validateBusinessReview(review: BusinessReview): readonly string[] {
  const issues: string[] = [];
  if (!review.id.trim()) issues.push('review_id_required');
  if (!review.businessId.trim()) issues.push('business_id_required');
  if (!review.authorUserId.trim()) issues.push('author_user_id_required');
  if (!review.authorLabel.trim()) issues.push('author_label_required');
  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
    issues.push('rating_must_be_integer_1_to_5');
  }
  if (review.body && review.body.trim().length > 2000) {
    issues.push('review_body_too_long');
  }
  if (!review.evidence.referenceId.trim()) {
    issues.push('interaction_evidence_required');
  }
  if (!Number.isFinite(Date.parse(review.createdAt))) {
    issues.push('valid_created_at_required');
  }
  if (review.businessReply) {
    if (!review.businessReply.body.trim()) issues.push('business_reply_body_required');
    if (review.businessReply.body.trim().length > 2000) issues.push('business_reply_body_too_long');
    if (!Number.isFinite(Date.parse(review.businessReply.repliedAt))) {
      issues.push('valid_business_reply_time_required');
    }
  }
  return issues;
}

export function projectPublicBusinessReviews(
  reviews: readonly BusinessReview[],
): PublicBusinessReview[] {
  return reviews
    .filter((review) => review.status === 'published')
    .filter((review) => validateBusinessReview(review).length === 0)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((review) => ({
      id: review.id,
      authorLabel: review.authorLabel,
      rating: review.rating,
      ...(review.body ? { body: review.body } : {}),
      verifiedInteraction: true as const,
      evidenceLabel: evidenceLabels[review.evidence.kind],
      createdAt: review.createdAt,
      ...(review.businessReply ? { businessReply: review.businessReply } : {}),
    }));
}

export function summarizeBusinessReviews(
  reviews: readonly PublicBusinessReview[],
): BusinessReviewSummary {
  if (!reviews.length) return { count: 0 };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return {
    count: reviews.length,
    averageRating: Math.round((total / reviews.length) * 10) / 10,
  };
}
