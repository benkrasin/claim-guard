#!/usr/bin/env node
'use strict';

const path = require('path');
const { check } = require('../lib/check');

const USAGE = `claim-guard — fail the build when marketing copy outruns the evidence

Usage:
  claim-guard <claims.json> [--root DIR] [--copy DIR]... [--quiet]

Options:
  --root DIR    Base directory for resolving evidence paths.
                Defaults to the directory containing claims.json.
  --copy DIR    A directory of public-facing copy to scan for banned phrases.
                Repeatable. Without it, banned phrases are not enforced.
  --quiet       Print nothing on success.
  -h, --help    Show this help.

Exit codes:
  0  every claim is supported by its evidence, and no copy overstates
  1  at least one violation
  2  bad usage
`;

function parseArgs(argv) {
  const opts = { copyDirs: [], quiet: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { help: true };
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg === '--root') { i += 1; opts.root = argv[i]; }
    else if (arg === '--copy') { i += 1; opts.copyDirs.push(argv[i]); }
    else if (arg.startsWith('-')) return { badArg: arg };
    else rest.push(arg);
  }
  opts.claimsPath = rest[0];
  return opts;
}

function main(argv) {
  const opts = parseArgs(argv);

  if (opts.help) { process.stdout.write(USAGE); return 0; }
  if (opts.badArg) {
    process.stderr.write(`claim-guard: unknown option ${opts.badArg}\n\n${USAGE}`);
    return 2;
  }
  if (!opts.claimsPath) {
    process.stderr.write(`claim-guard: missing <claims.json>\n\n${USAGE}`);
    return 2;
  }
  if (opts.root === undefined && opts.copyDirs.includes(undefined)) {
    process.stderr.write('claim-guard: --copy needs a directory\n');
    return 2;
  }

  const result = check({
    claimsPath: path.resolve(opts.claimsPath),
    root: opts.root ? path.resolve(opts.root) : undefined,
    copyDirs: opts.copyDirs,
  });

  for (const w of result.warnings) process.stderr.write(`claim-guard: warning: ${w}\n`);

  if (!result.ok) {
    process.stderr.write(`\nclaim-guard: ${result.errors.length} violation(s)\n\n`);
    for (const e of result.errors) process.stderr.write(`  - ${e}\n`);
    process.stderr.write('\n');
    return 1;
  }

  if (!opts.quiet) {
    const s = result.stats;
    process.stdout.write(
      `claim-guard: OK — ${s.publishable} of ${s.total} claims publishable, `
        + `${s.withheld} withheld`
        + (s.filesScanned ? `, ${s.filesScanned} copy file(s) clean` : '')
        + '\n',
    );
  }
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main };
