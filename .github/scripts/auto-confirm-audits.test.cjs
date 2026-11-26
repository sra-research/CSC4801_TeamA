const {test} = require('node:test');
const assert = require('node:assert/strict');
const run = require('./auto-confirm-audits.cjs');
const now = Date.parse('2026-11-25T12:00:00Z');
const hour = 60 * 60 * 1000;

function fixture({age = 25, comments = [], fresh = {}, laterComments = comments, issue = {}} = {}) {
  const report = {
    number: 2, state: 'open', created_at: new Date(now - age * hour).toISOString(),
    user: {login: 'reporter'},
    labels: ['audit:report', 'status:needs-triage', 'type:functional', 'team-label'].map(name => ({name})),
    ...issue,
  };
  const writes = [];
  let commentReads = 0;
  const api = {
    listForRepo: 'reports', listComments: 'comments',
    get: async () => ({data: {...report, ...fresh}}),
    createComment: async data => writes.push(['comment', data]),
    update: async data => writes.push(['update', data]),
  };
  const github = {
    rest: {issues: api},
    paginate: async method => method === 'reports' ? [report] : (++commentReads === 1 ? comments : laterComments),
  };
  return {writes, args: {github, context: {repo: {owner: 'example', repo: 'team'}}, core: {info() {}}, now}};
}
const reply = (login = 'developer', association = 'COLLABORATOR', type = 'User') => ({
  user: {login, type}, author_association: association, body: 'Checking this report.',
});

test('confirms at 25 hours, explains timeout, preserves other labels and open state', async () => {
  const {args, writes} = fixture();
  assert.equal(await run(args), 1);
  assert.match(writes[0][1].body, /not evidence that the bug was reproduced/);
  assert.deepEqual(writes[1], ['update', {
    owner: 'example', repo: 'team', issue_number: 2,
    labels: ['audit:report', 'type:functional', 'team-label', 'status:confirmed'],
  }]);
});

test('does not confirm before the 25-hour deadline', async () => {
  const {args, writes} = fixture({age: 25 - 1 / 3600});
  assert.equal(await run(args), 0);
  assert.equal(writes.length, 0);
});

for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
  test(`a human ${association} response prevents confirmation`, async () => {
    const {args, writes} = fixture({comments: [reply('developer', association)]});
    assert.equal(await run(args), 0);
    assert.equal(writes.length, 0);
  });
}

for (const comment of [reply('reporter'), reply('helper', 'CONTRIBUTOR'), reply('bot', 'MEMBER', 'Bot')]) {
  test(`${comment.user.login} comments do not count as a developer response`, async () => {
    const {args} = fixture({comments: [comment]});
    assert.equal(await run(args), 1);
  });
}

for (const issue of [
  {state: 'closed'}, {pull_request: {url: 'example'}},
  {labels: ['audit:report', 'status:confirmed']},
  {labels: ['audit:report', 'status:needs-triage', 'status:rejected']},
  {labels: ['status:needs-triage']},
]) {
  test(`skips ineligible issue ${JSON.stringify(issue)}`, async () => {
    const {args, writes} = fixture({issue});
    assert.equal(await run(args), 0);
    assert.equal(writes.length, 0);
  });
}

test('rechecks a report closed since listing', async () => {
  const {args, writes} = fixture({fresh: {state: 'closed'}});
  assert.equal(await run(args), 0);
  assert.equal(writes.length, 0);
});

test('rechecks developer replies arriving during the run', async () => {
  const {args, writes} = fixture({laterComments: [reply()]});
  assert.equal(await run(args), 0);
  assert.equal(writes.length, 0);
});

test('dry run makes no changes', async () => {
  const {args, writes} = fixture();
  await run({...args, dryRun: true});
  assert.equal(writes.length, 0);
});

test('retry after label update failure does not duplicate the bot notice', async () => {
  const notice = {...reply('github-actions[bot]', 'NONE', 'Bot'), body: '<!-- audit-auto-confirm-25h -->'};
  const {args, writes} = fixture({comments: [notice]});
  assert.equal(await run(args), 1);
  assert.deepEqual(writes.map(write => write[0]), ['update']);
});
