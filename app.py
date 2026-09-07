"""Single-file Django skill-matching demo. Run: python app.py runserver 127.0.0.1:8080"""
import secrets
import sys

import django
from django.conf import settings

if not settings.configured:
    settings.configure(
        DEBUG=False,
        SECRET_KEY=secrets.token_hex(32),
        ROOT_URLCONF=__name__,
        ALLOWED_HOSTS=['localhost', '127.0.0.1', '[::1]', 'testserver'],
        INSTALLED_APPS=[],
        MIDDLEWARE=['django.middleware.security.SecurityMiddleware'],
        TEMPLATES=[{'BACKEND': 'django.template.backends.django.DjangoTemplates'}],
    )
    django.setup()

from django.core.management import execute_from_command_line
from django.http import HttpResponse
from django.template import engines
from django.urls import path
from django.views.decorators.http import require_GET


def match_score(candidate_skills, required_skills):
    """FP-MATCH-1 baseline; inputs are comma-separated skill strings."""
    candidate = {s.strip().lower() for s in candidate_skills.split(',') if s.strip()}
    required = {s.strip().lower() for s in required_skills.split(',') if s.strip()}
    if not required:
        return 100
    return 100 * len(candidate & required) // len(required)


PAGE = '''<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skill Match · Peer Review Demo</title>
<style>
body {font: 17px/1.6 system-ui, sans-serif; color: #18353b; background: #f4f7f7; margin: 0;}
main {max-width: 620px; margin: 4rem auto; padding: 2rem; background: white; border-radius: 12px;}
label {display: block; margin: 1rem 0;} input {box-sizing: border-box; display: block; width: 100%; padding: .7rem; font: inherit;}
button {padding: .7rem 1.2rem; font: inherit; color: white; background: #176475; border: none; border-radius: 5px;}
output {display: block; font-size: 2.5rem; font-weight: bold; margin-top: 1rem;}
small {color: #4b646a;} h1 {line-height: 1.2;}
</style></head>
<body><main>
<small>CSC4801 · Local peer-review teaching example</small>
<h1>Skill match calculator</h1>
<p>Enter comma-separated skills. A job with no required skills should score 100%.</p>
<form method="get">
<label>Candidate skills<input name="candidate" value="{{ candidate }}" placeholder="Python, SQL"></label>
<label>Required skills<input name="required" value="{{ required }}" placeholder="Python, SQL (or leave empty)"></label>
<button type="submit">Calculate match</button>
</form>
<output aria-label="Match score">{{ score }}%</output>
<p>This is a small matching demonstration, not the complete recruiting platform.</p>
</main></body></html>'''


@require_GET
def index(request):
    candidate = request.GET.get('candidate', 'Python')
    required = request.GET.get('required', 'Python, SQL')
    context = {'candidate': candidate, 'required': required, 'score': match_score(candidate, required)}
    return HttpResponse(engines['django'].from_string(PAGE).render(context))


urlpatterns = [path('', index, name='index')]

if __name__ == '__main__':
    execute_from_command_line(sys.argv)
