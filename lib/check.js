'use strict';

const fs = require('fs');
const path = require('path');

const {
  SURFACES, TIERS, STATES, REVIEWS, VERIFICATIONS,
  REQUIRED_FIELDS, ARRAY_FIELDS,
} = require('./schema');
const { derivePublishable } = require('./derive');

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.md', '.mdx', '.txt',
  '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.astro',
  '.json', '.yml', '.yaml',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage']);

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), acc);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

function validateSchema(claim, index, seenIds, errors) {
  const label = claim.id ? `claim "${claim.id}"` : `claim #${index}`;

  for (const field of REQUIRED_FIELDS) {
    if (claim[field] === undefined) errors.push(`${label}: missing required field "${field}"`);
  }
  for (const field of ARRAY_FIELDS) {
    if (claim[field] !== undefined && !Array.isArray(claim[field])) {
      errors.push(`${label}: "${field}" must be an array`);
    }
  }
  if (claim.id) {
    if (seenIds.has(claim.id)) errors.push(`duplicate claim id "${claim.id}"`);
    seenIds.add(claim.id);
  }
  if (claim.surface && !SURFACES.includes(claim.surface)) {
    errors.push(`${label}: surface "${claim.surface}" not one of ${SURFACES.join(', ')}`);
  }
  if (claim.tier !== undefined && !TIERS.includes(claim.tier)) {
    errors.push(`${label}: tier ${claim.tier} not one of ${TIERS.join(', ')}`);
  }
  if (claim.state && !STATES.includes(claim.state)) {
    errors.push(`${label}: state "${claim.state}" not one of ${STATES.join(', ')}`);
  }
  if (claim.review && !REVIEWS.includes(claim.review)) {
    errors.push(`${label}: review "${claim.review}" not one of ${REVIEWS.join(', ')}`);
  }
  if (claim.productionVerification && !VERIFICATIONS.includes(claim.productionVerification)) {
    errors.push(
      `${label}: productionVerification "${claim.productionVerification}" not one of `
        + VERIFICATIONS.join(', '),
    );
  }
  // An unpublishable claim with no banned phrases enforces nothing. This is
  // the difference between a document that records a decision and a mechanism
  // that keeps it.
  if (Array.isArray(claim.bannedPhrases) && claim.bannedPhrases.length === 0
      && claim.publishable === false && claim.surface !== 'internal-only') {
    errors.push(
      `${label}: not publishable but declares no bannedPhrases, so nothing stops the copy `
        + 'being written anyway. List the wording you are ruling out.',
    );
  }
}

/**
 * Run every check. Pure with respect to the filesystem in, results out — the
 * CLI does the printing.
 *
 * @param {object} opts
 * @param {string} opts.claimsPath  path to the claims JSON
 * @param {string} [opts.root]      base for resolving evidence paths
 * @param {string[]} [opts.copyDirs] directories of public copy to scan
 */
function check(opts) {
  const { claimsPath } = opts;
  const root = opts.root || path.dirname(claimsPath);
  const copyDirs = opts.copyDirs || [];

  const errors = [];
  const warnings = [];

  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`could not read ${claimsPath}: ${e.message}`], warnings, stats: null };
  }

  const claims = Array.isArray(doc) ? doc : doc.claims;
  if (!Array.isArray(claims)) {
    return {
      ok: false,
      errors: ['claims file must be an array, or an object with a "claims" array'],
      warnings,
      stats: null,
    };
  }

  const seenIds = new Set();
  for (let i = 0; i < claims.length; i += 1) validateSchema(claims[i], i, seenIds, errors);

  // Evidence must exist on disk. A row citing a test file that was deleted in
  // an unrelated cleanup is the exact failure this catches: the claim silently
  // loses its support while still reading as verified.
  for (const claim of claims) {
    for (const field of ['implementationEvidence', 'automatedTestEvidence']) {
      if (!Array.isArray(claim[field])) continue;
      for (const rel of claim[field]) {
        if (!fs.existsSync(path.resolve(root, rel))) {
          errors.push(
            `claim "${claim.id}": ${field} cites "${rel}", which does not exist. `
              + 'Either the evidence moved, or this claim quietly lost its support.',
          );
        }
      }
    }
  }

  // Publishability is recomputed and compared. Failing in BOTH directions is
  // deliberate: over-claiming is the dangerous one, but stale under-claiming
  // means the tool is drifting out of sync with reality and will stop being
  // trusted, which ends the same way.
  const derived = new Map();
  for (const claim of claims) {
    const result = derivePublishable(claim);
    derived.set(claim.id, result);
    if (claim.publishable === true && !result.publishable) {
      errors.push(
        `claim "${claim.id}": marked publishable, but the evidence does not support it — `
          + result.reasons.join('; '),
      );
    }
    if (claim.publishable === false && result.publishable) {
      errors.push(
        `claim "${claim.id}": marked NOT publishable, but every gate now passes. `
          + 'Update the flag — an out-of-date matrix stops being believed.',
      );
    }
  }

  // Banned phrases of unpublishable claims are enforced against real copy.
  // Adding a claim therefore extends enforcement automatically; nobody has to
  // remember to also update a separate blocklist.
  let filesScanned = 0;
  const bannedHits = [];
  if (copyDirs.length > 0) {
    const files = copyDirs.flatMap((d) => walk(path.resolve(root, d)));
    filesScanned = files.length;
    const banned = [];
    for (const claim of claims) {
      const isPublishable = derived.get(claim.id)?.publishable;
      if (isPublishable) continue;
      for (const phrase of claim.bannedPhrases || []) {
        banned.push({ id: claim.id, phrase, needle: phrase.toLowerCase() });
      }
    }
    for (const file of files) {
      const haystack = fs.readFileSync(file, 'utf8').toLowerCase();
      for (const b of banned) {
        if (haystack.includes(b.needle)) {
          bannedHits.push({ file: path.relative(root, file), phrase: b.phrase, id: b.id });
        }
      }
    }
    for (const hit of bannedHits) {
      errors.push(
        `${hit.file}: contains "${hit.phrase}", a phrase banned by unpublishable claim `
          + `"${hit.id}". Either the copy is overstating, or the claim has earned its evidence.`,
      );
    }
  } else {
    warnings.push('no copy directories given (--copy), so banned phrases were not enforced');
  }

  const publishableCount = claims.filter((c) => derived.get(c.id)?.publishable).length;

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      total: claims.length,
      publishable: publishableCount,
      withheld: claims.length - publishableCount,
      filesScanned,
    },
  };
}

module.exports = { check, walk };
