// Stand-in for the test that keeps the claim true.
const assert = require('node:assert');
const exportCsv = require('../lib/export');
assert.equal(exportCsv(['a', 'b']), 'a\nb');
