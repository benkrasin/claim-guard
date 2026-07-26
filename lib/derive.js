'use strict';

const {
  TIER_12_REVIEW_OK,
  TIER_3_REVIEW_OK,
} = require('./schema');

/**
 * Decide whether a claim may be published, from its evidence alone.
 *
 * This function is the point of the whole tool. Note what it does NOT read:
 * `claim.publishable`. The stored flag is treated as an *assertion to be
 * checked*, never as an input. Anything else and you have a boolean somebody
 * can flip in a hurry before a launch.
 *
 * Returns { publishable, reasons } where `reasons` lists every unmet gate, so
 * the failure message can say what to go and do rather than just "no".
 */
function derivePublishable(claim) {
  const reasons = [];

  // Internal notes are not public copy. This is a surface rule, not an
  // evidence rule, so it short-circuits: an internal row with perfect evidence
  // is still not something to print on a website.
  if (claim.surface === 'internal-only') {
    return { publishable: false, reasons: ['surface is internal-only'] };
  }

  if (claim.state !== 'publicly-claimable') {
    reasons.push(`state is "${claim.state}", needs "publicly-claimable"`);
  }

  if (!claim.implementationEvidence || claim.implementationEvidence.length === 0) {
    reasons.push('no implementationEvidence — nothing builds this');
  }

  // A claim with code but no test is a claim with an expiry date nobody has
  // written down: it is true until an unrelated refactor quietly breaks it.
  if (!claim.automatedTestEvidence || claim.automatedTestEvidence.length === 0) {
    reasons.push('no automatedTestEvidence — nothing keeps this true');
  }

  const reviewOk = claim.tier === 3 ? TIER_3_REVIEW_OK : TIER_12_REVIEW_OK;
  if (!reviewOk.includes(claim.review)) {
    reasons.push(
      claim.tier === 3
        ? `tier 3 review is "${claim.review}"; tier 3 requires "complete" — a human `
          + 'attestation, not an automated pass'
        : `review is "${claim.review}", needs one of: ${reviewOk.join(', ')}`,
    );
  }

  // Tiers 2 and 3 assert something about the world, not just about the code.
  // Passing tests in CI do not establish that the feature works in production.
  if (claim.tier >= 2 && claim.productionVerification !== 'verified') {
    reasons.push(
      `tier ${claim.tier} needs productionVerification "verified", `
        + `found "${claim.productionVerification}"`,
    );
  }

  return { publishable: reasons.length === 0, reasons };
}

module.exports = { derivePublishable };
