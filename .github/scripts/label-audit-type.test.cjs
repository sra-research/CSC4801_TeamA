const {test} = require('node:test');
const assert = require('node:assert/strict');
const run = require('./label-audit-type.cjs');

const formBody = type => `### Reporting team\n\nTeam B\n\n### Type\n\n${type}\n\n### Minimal test case\n\n1. Run ...`;

function fixture({body = formBody('security'), labels = ['audit:report', 'status:needs-triage']} = {}) {
  const writes = [];
  const github = {rest: {issues: {addLabels: async data => writes.push(data)}}};
  const context = {repo: {owner: 'example', repo: 'team'}, payload: {issue: {number: 7, body, labels: labels.map(name => ({name}))}}};
  return {writes, args: {github, context}};
}

for (const type of ['security', 'functional', 'performance', 'environment']) {
  test(`adds type:${type} from the form`, async () => {
    const {args, writes} = fixture({body: formBody(type)});
    assert.equal(await run(args), type);
    assert.deepEqual(writes, [{owner: 'example', repo: 'team', issue_number: 7, labels: [`type:${type}`]}]);
  });
}

test('skips issues that are not audit reports', async () => {
  const {args, writes} = fixture({labels: ['bug']});
  assert.equal(await run(args), null);
  assert.equal(writes.length, 0);
});

test('skips reports that already have a type label', async () => {
  const {args, writes} = fixture({labels: ['audit:report', 'type:functional']});
  assert.equal(await run(args), null);
  assert.equal(writes.length, 0);
});

test('skips a missing or unknown type', async () => {
  for (const body of ['', null, formBody('critical')]) {
    const {args, writes} = fixture({body});
    assert.equal(await run(args), null);
    assert.equal(writes.length, 0);
  }
});
