'use strict';

/**
 * The vocabulary of a claim.
 *
 * Every value here is deliberately a closed set. The whole tool rests on
 * publishability being *computed*, and you cannot compute over free text — the
 * moment `clinicalReview` can be the string "basically done", the gate becomes
 * a judgement call again and the tool is decoration.
 */

/** Where a claim would appear. `internal-only` is never publishable. */
const SURFACES = ['marketing-site', 'in-app', 'sales-collateral', 'internal-only'];

/**
 * Evidence tiers, in ascending order of what a reader risks by believing you.
 *
 *   1 — descriptive. "Has a patient chart." Wrong is embarrassing.
 *   2 — comparative or quantified. "Cuts documentation time." Wrong is costly.
 *   3 — consequential. Safety, efficacy, compliance, regulatory. Wrong hurts
 *       someone. Tier 3 is the reason this tool distinguishes an automated
 *       check from a signature (see REVIEWS).
 */
const TIERS = [1, 2, 3];

/** Lifecycle. Note that `implemented` is the *start*, not the finish. */
const STATES = ['implemented', 'internally-verified', 'publicly-claimable'];

/**
 * Review status.
 *
 * `automated-complete` means a deterministic rule engine passed with zero
 * blocking findings. That is real evidence and it satisfies tiers 1 and 2.
 *
 * It is deliberately NOT accepted for tier 3. A tier-3 claim needs a
 * qualified human to attest to it, because at that tier you are not asking
 * "is this correct?" but "who is accountable if it is wrong?" — and no rule
 * engine produces a signature. This distinction is the most opinionated thing
 * in the tool and the one most worth keeping.
 */
const REVIEWS = ['not-required', 'not-started', 'in-review', 'automated-complete', 'complete'];
const TIER_12_REVIEW_OK = ['not-required', 'automated-complete', 'complete'];
const TIER_3_REVIEW_OK = ['not-required', 'complete'];

const VERIFICATIONS = ['not-started', 'verified'];

const REQUIRED_FIELDS = [
  'id',
  'proposedClaim',
  'surface',
  'tier',
  'state',
  'implementationEvidence',
  'automatedTestEvidence',
  'review',
  'productionVerification',
  'publishable',
  'approvedWording',
  'bannedPhrases',
];

const ARRAY_FIELDS = ['implementationEvidence', 'automatedTestEvidence', 'bannedPhrases'];

module.exports = {
  SURFACES,
  TIERS,
  STATES,
  REVIEWS,
  TIER_12_REVIEW_OK,
  TIER_3_REVIEW_OK,
  VERIFICATIONS,
  REQUIRED_FIELDS,
  ARRAY_FIELDS,
};
