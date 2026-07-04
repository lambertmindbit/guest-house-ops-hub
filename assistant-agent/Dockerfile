# Container for the OTA guest assistant (ADK sidecar). Used by any host that
# builds from a Dockerfile — e.g. `gcloud run deploy --source .` picks this up.
FROM python:3.12-slim

WORKDIR /app

# Install deps first so they cache across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code (secrets come from the host's env, never baked in — see .dockerignore).
COPY ota_guest_agent ./ota_guest_agent

# Cloud Run (and most hosts) inject $PORT; default to 8080 locally.
ENV PORT=8080
CMD ["sh", "-c", "uvicorn ota_guest_agent.server:api --host 0.0.0.0 --port ${PORT}"]
