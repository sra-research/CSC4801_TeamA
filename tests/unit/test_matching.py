"""Matching example tests; dashboard tie-breaking remains a student placeholder."""
import pytest
from django.test import RequestFactory
from app import index, match_score


@pytest.mark.parametrize('candidate,required,expected', [
    ('Python, SQL', 'Python, SQL', 100),
    ('Python', 'Python, SQL', 50),
    ('Rust', 'Python, SQL', 0),
    (' python, PYTHON, ', 'Python, SQL, Rust', 33),
])
def test_fp_match_1_examples_normalization_and_floor(candidate, required, expected):
    assert match_score(candidate, required) == expected


def test_view_escapes_user_input():
    response = index(RequestFactory().get('/', {'candidate': '<script>alert(1)</script>', 'required': 'Python'}))
    html = response.content.decode()
    assert response.status_code == 200
    assert '<script>alert(1)</script>' not in html
    assert '&lt;script&gt;alert(1)&lt;/script&gt;' in html


# Implement dashboard ordering and replace this placeholder with assertions.
def test_fp_match_1_both_tie_breakers():
    pass
