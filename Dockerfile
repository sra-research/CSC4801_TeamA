# Local teaching example; Django's development server is used for the demo.
FROM python:3.12.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.lock requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home --uid 10001 student
COPY --chown=student:student . .
USER student
EXPOSE 8080
CMD ["python", "app.py", "runserver", "0.0.0.0:8080", "--noreload"]
