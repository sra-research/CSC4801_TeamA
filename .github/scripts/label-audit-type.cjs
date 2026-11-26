// Issue forms render each field as "### <label>" followed by the selected value.
function selectedType(body) {
  const value = /^### Type[ \t]*\r?\n\s*(\w+)/m.exec(body ?? '')?.[1];
  return ['security', 'functional', 'performance', 'environment'].includes(value) ? value : null;
}

module.exports = async function run({github, context}) {
  const issue = context.payload.issue;
  const labels = issue.labels.map(label => typeof label === 'string' ? label : label.name);
  if (!labels.includes('audit:report') || labels.some(label => label.startsWith('type:'))) return null;
  const type = selectedType(issue.body);
  if (type) {
    await github.rest.issues.addLabels({...context.repo, issue_number: issue.number, labels: [`type:${type}`]});
  }
  return type;
};
