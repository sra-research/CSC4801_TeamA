const DEADLINE_MS = 25 * 60 * 60 * 1000;
const RESPONDER_ROLES = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const MARKER = '<!-- audit-auto-confirm-25h -->';

function eligible(issue, now) {
  const labels = issue.labels.map(label => typeof label === 'string' ? label : label.name);
  return !issue.pull_request && issue.state === 'open'
    && labels.includes('audit:report') && labels.includes('status:needs-triage')
    && !labels.some(label => label.startsWith('status:') && label !== 'status:needs-triage')
    && now - Date.parse(issue.created_at) >= DEADLINE_MS;
}

function isResponse(comment, reporter) {
  return comment.user?.type === 'User'
    && comment.user.login !== reporter
    && RESPONDER_ROLES.has(comment.author_association);
}

module.exports = async function run({github, context, core, now = Date.now(), dryRun = false}) {
  const api = github.rest.issues;
  const reports = await github.paginate(api.listForRepo, {
    ...context.repo, state: 'open', labels: 'audit:report,status:needs-triage', per_page: 100,
  });
  let confirmed = 0;
  for (const candidate of reports) {
    if (!eligible(candidate, now)) continue;
    const target = {...context.repo, issue_number: candidate.number};
    const comments = await github.paginate(api.listComments, {...target, per_page: 100});
    if (comments.some(comment => isResponse(comment, candidate.user.login))) continue;
    // Refresh status after reading comments so a newly closed or triaged report is skipped.
    const {data: issue} = await api.get(target);
    if (!eligible(issue, now)) continue;
    if (dryRun) {
      core.info(`Would auto-confirm #${issue.number}: no developer response after 25 hours.`);
      continue;
    }
    // Check comments again immediately before writing, including responses posted during this run.
    const latestComments = await github.paginate(api.listComments, {...target, per_page: 100});
    if (latestComments.some(comment => isResponse(comment, issue.user.login))) continue;
    const hasNotice = latestComments.some(comment =>
      comment.user?.type === 'Bot' && comment.user.login === 'github-actions[bot]'
      && comment.body?.includes(MARKER));
    if (!hasNotice) {
      await api.createComment({
        ...target,
        body: `${MARKER}\nAuto-confirmed under the 25-hour no-response rule: this report has been open for at least 25 hours without a human response from a repository owner, organization member, or collaborator other than the reporter.\n\nThis is a timeout-based status change, not evidence that the bug was reproduced. The issue remains open for the target team to add a regression test and fix it. The instructor may revise its status after review.`,
      });
    }
    // One request replaces only the status in the refreshed label list and keeps the issue open.
    const labels = issue.labels.map(label => typeof label === 'string' ? label : label.name)
      .filter(label => label !== 'status:needs-triage');
    await api.update({...target, labels: [...labels, 'status:confirmed']});
    core.info(`Auto-confirmed #${issue.number}.`);
    confirmed += 1;
  }
  return confirmed;
};
