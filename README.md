# claim-guard

**Fail your build when your marketing copy outruns your evidence.**

Zero dependencies. One Node file you can read in ten minutes.

```bash
npx claim-guard claims.json --copy src
```

```
claim-guard: OK — 2 of 4 claims publishable, 2 withheld, 1 copy file(s) clean
```

---

## The problem

Nobody decides to overstate. It happens one reasonable step at a time.

You ship a dermatology tab. Someone writing the feature page calls it *lesion
tracking* — fair enough, it tracks lesions. A quarter later the comparison page
says *longitudinal lesion surveillance*, because that's the category name. Then
a deck says *best-in-class dermatology workflows*, because every competitor
deck says best-in-class.

At no point did anyone lie. There was never a meeting where the claim was
approved. The copy just drifted, because **nothing was checking it against the
product** — and the people writing it were further from the code at each step.

This is why "we should be careful about claims" doesn't work as a policy. It
relies on the person with the least context and the most pressure to be the one
who says no.

## The approach

Write down each public claim with the evidence behind it. Then let a program —
not a person, not a policy — decide which ones you're allowed to publish, and
fail the build when your actual copy exceeds that.

Three rules do most of the work:

**1. Publishability is derived, never asserted.**
The `publishable` field in your file is an *assertion that gets checked*, not an
input. `claim-guard` recomputes it from the evidence and fails if the two
disagree — **in both directions**. Over-claiming is the dangerous one. But stale
under-claiming matters too: a matrix that has fallen behind reality stops being
believed, and an unbelieved control is a deleted control with extra steps.

**2. Evidence has to exist on disk.**
Every path a claim cites is checked. Someone deleting a test file in an
unrelated cleanup silently removes a claim's support while it still *reads* as
verified. That's the failure this catches, and it's invisible to code review
because the two changes live in different files.

**3. Banned phrases are enforced against real copy.**
Each unpublishable claim lists wording it rules out. Those phrases are grepped
from your actual site source. Adding a claim therefore extends enforcement
automatically — nobody has to remember to also update a blocklist somewhere
else, which is the step that never happens.

## Tiers, and the one opinionated bit

Claims are tiered by what a reader risks if you're wrong:

| Tier | Kind of claim | Wrong means | Needs |
|---|---|---|---|
| 1 | Descriptive — "has a patient chart" | Embarrassing | Code + test |
| 2 | Comparative or quantified — "cuts documentation time" | Costly | + production verification |
| 3 | Consequential — safety, efficacy, compliance, regulatory | Someone gets hurt | + human sign-off |

A `review` value of `automated-complete` — a deterministic rule engine passing
with zero blocking findings — is real evidence, and it satisfies tiers 1 and 2.

**It is deliberately rejected for tier 3.** At tier 3 you're no longer asking
*is this correct?* but *who is accountable if it isn't?*, and no rule engine
produces a signature. This is the most opinionated line in the tool and the one
most worth keeping. If you disagree, it's four lines in `lib/derive.js`.

## Usage

```
claim-guard <claims.json> [--root DIR] [--copy DIR]... [--quiet]

  --root DIR    Base for resolving evidence paths (default: claims.json's dir)
  --copy DIR    Directory of public copy to scan. Repeatable.
                Without it, banned phrases are not enforced.
  --quiet       Print nothing on success.

Exit 0 = clean.  1 = violation.  2 = bad usage.
```

A claim looks like this:

```json
{
  "id": "soc2-compliant",
  "proposedClaim": "SOC 2 Type II compliant.",
  "surface": "marketing-site",
  "tier": 3,
  "state": "implemented",
  "implementationEvidence": ["lib/audit-log.js"],
  "automatedTestEvidence": ["tests/audit-log.test.js"],
  "review": "automated-complete",
  "productionVerification": "verified",
  "publishable": false,
  "approvedWording": "We follow SOC 2 practices. We have not completed a Type II audit and do not claim certification.",
  "bannedPhrases": ["SOC 2 Type II compliant", "SOC 2 certified", "fully compliant"]
}
```

That claim has code, tests, production verification, and a clean automated
review — and is still withheld, because tier 3 wants a human. Put "SOC 2
certified" on your pricing page and the build goes red.

`approvedWording` is the sentence you *may* say instead. It's the useful half:
teams don't overstate because they want to, they overstate because nobody gave
them accurate words that still sound like something.

Try it:

```bash
git clone https://github.com/benkrasin/claim-guard && cd claim-guard
npm test
npm run example
```

### In CI

```yaml
- run: npx claim-guard docs/claims.json --copy src --copy content
```

## What this is not

- **Not a compliance product.** It checks that you wrote evidence down and that
  your copy matches it. It cannot tell whether the evidence is any good.
- **Not a legal review.** Tier 3 exists precisely to route claims to a human.
- **Not an SEO or readability tool.** It only ever says no.
- **Not magic.** A claim file nobody maintains produces a guard that enforces
  nothing. The tool makes drift *loud*; it can't make you care.

## Where it came from

We were building [an EMR](https://krasyn.com), which is a category where
overstatement is normal and consequential — every vendor site is an
undifferentiated wall of checkmarks, and clinicians have learned to disbelieve
all of it. We wanted to be able to say true things and be believed, which turns
out to be a mechanism problem rather than an intentions problem.

So the guard came first, and then the interesting thing happened: once you have
a machine-readable list of what you *can't* claim, you can publish it. Ours is
at **[krasyn.com/what-we-dont-do](https://krasyn.com/what-we-dont-do)** — a page
listing our own gaps by name, generated from the same file that blocks our
marketing copy. Not a promise to be honest, which is worth nothing. The same
mechanism, pointed outward.

This repo is that guard, extracted and made generic. MIT — take it.

## Contributing

Issues and PRs welcome. The tool is intentionally small; if you're adding a
dependency, that's worth discussing first.

## License

[MIT](LICENSE)
