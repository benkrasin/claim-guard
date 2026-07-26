'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { derivePublishable } = require('../lib/derive');
const { check } = require('../lib/check');

const EXAMPLE = path.join(__dirname, '..', 'example');

/** A claim that passes every gate. Tests below break it one field at a time. */
function goodClaim(overrides = {}) {
  return {
    id: 'x',
    proposedClaim: 'Does the thing.',
    surface: 'marketing-site',
    tier: 1,
    state: 'publicly-claimable',
    implementationEvidence: ['lib/export.js'],
    automatedTestEvidence: ['tests/export.test.js'],
    review: 'not-required',
    productionVerification: 'not-started',
    publishable: true,
    approvedWording: 'Does the thing.',
    bannedPhrases: [],
    ...overrides,
  };
}

test('a fully evidenced tier-1 claim is publishable', () => {
  assert.equal(derivePublishable(goodClaim()).publishable, true);
});

test('code without a test is not publishable — nothing keeps it true', () => {
  const r = derivePublishable(goodClaim({ automatedTestEvidence: [] }));
  assert.equal(r.publishable, false);
  assert.match(r.reasons.join(' '), /nothing keeps this true/);
});

test('internal-only is never publishable, however good the evidence', () => {
  const r = derivePublishable(goodClaim({ surface: 'internal-only' }));
  assert.equal(r.publishable, false);
});

test('tier 2 additionally requires production verification', () => {
  assert.equal(derivePublishable(goodClaim({ tier: 2 })).publishable, false);
  assert.equal(
    derivePublishable(goodClaim({ tier: 2, productionVerification: 'verified' })).publishable,
    true,
  );
});

test('an automated pass satisfies tier 2 but NOT tier 3', () => {
  const base = { review: 'automated-complete', productionVerification: 'verified' };
  assert.equal(derivePublishable(goodClaim({ ...base, tier: 2 })).publishable, true);

  // The opinionated core: tier 3 asks who is accountable, and a rule engine
  // does not produce a signature.
  const tier3 = derivePublishable(goodClaim({ ...base, tier: 3 }));
  assert.equal(tier3.publishable, false);
  assert.match(tier3.reasons.join(' '), /human attestation/);

  assert.equal(
    derivePublishable(goodClaim({ ...base, tier: 3, review: 'complete' })).publishable,
    true,
  );
});

test('the bundled example is internally consistent', () => {
  const r = check({
    claimsPath: path.join(EXAMPLE, 'claims.json'),
    root: EXAMPLE,
    copyDirs: ['src'],
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.stats.publishable, 2);
  assert.equal(r.stats.withheld, 2);
});

test('copy containing a banned phrase fails', (t) => {
  const fs = require('node:fs');
  const file = path.join(EXAMPLE, 'src', '__tmp-overstated.html');
  t.after(() => fs.rmSync(file, { force: true }));

  fs.writeFileSync(file, '<p>The fastest reporting tool on the market.</p>');
  const r = check({
    claimsPath: path.join(EXAMPLE, 'claims.json'),
    root: EXAMPLE,
    copyDirs: ['src'],
  });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /fastest reporting/);
});

test('evidence that does not exist on disk fails', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-'));
  const claims = { claims: [goodClaim({ implementationEvidence: ['lib/deleted.js'] })] };
  fs.writeFileSync(path.join(dir, 'claims.json'), JSON.stringify(claims));

  const r = check({ claimsPath: path.join(dir, 'claims.json'), root: dir });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /quietly lost its support/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the stored flag is checked, never trusted — both directions fail', () => {
  const fs = require('node:fs');
  const os = require('node:os');

  // Over-claiming.
  const over = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-'));
  fs.mkdirSync(path.join(over, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(over, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(over, 'lib', 'export.js'), '');
  fs.writeFileSync(path.join(over, 'tests', 'export.test.js'), '');
  fs.writeFileSync(
    path.join(over, 'claims.json'),
    JSON.stringify({ claims: [goodClaim({ tier: 3, review: 'not-started', publishable: true })] }),
  );
  const rOver = check({ claimsPath: path.join(over, 'claims.json'), root: over });
  assert.equal(rOver.ok, false);
  assert.match(rOver.errors.join('\n'), /evidence does not support it/);

  // Stale under-claiming: the matrix has fallen behind reality.
  fs.writeFileSync(
    path.join(over, 'claims.json'),
    JSON.stringify({ claims: [goodClaim({ publishable: false, bannedPhrases: ['nope'] })] }),
  );
  const rUnder = check({ claimsPath: path.join(over, 'claims.json'), root: over });
  assert.equal(rUnder.ok, false);
  assert.match(rUnder.errors.join('\n'), /every gate now passes/);

  fs.rmSync(over, { recursive: true, force: true });
});
