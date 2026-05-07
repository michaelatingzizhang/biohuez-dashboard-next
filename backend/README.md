# BioHuez FastAPI Backend

Standalone API service for the dashboard data layer.

## Local Run

```bash
source venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Then set the Next.js app to proxy to it:

```bash
BIOHUEZ_API_BASE_URL=http://localhost:8000 npm run dev
```

To test production-style API key protection locally:

```bash
BIOHUEZ_API_KEY=dev-secret uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
BIOHUEZ_API_BASE_URL=http://localhost:8000 BIOHUEZ_API_KEY=dev-secret npm run dev
```

## Production

Deploy this service separately from the Next.js frontend, for example on Railway or Fly.io.

Required environment variables:

```bash
MOTHERDUCK_TOKEN=...
BIOHUEZ_API_KEY=generate-a-long-random-secret
BIOHUEZ_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
BIOHUEZ_API_CACHE_TTL_SECONDS=300
BIOHUEZ_API_CACHE_STALE_SECONDS=3600
BIOHUEZ_API_REFRESH_INTERVAL_SECONDS=240
```

Set the same `BIOHUEZ_API_KEY` in Vercel. The frontend sends it to FastAPI as the `x-biohuez-api-key` header. `/health` stays public for hosting health checks; `/ready` and all dashboard data endpoints require the key when configured.

The service preloads the main dashboard endpoints on startup, refreshes them in the background, and serves the last cached response while a refresh is running.

Start command:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

## Docker

`Dockerfile.backend` installs this API, the dashboard scripts, and the legacy `biohuez-dashboard` repo that provides `db.py`.

```bash
docker build -f Dockerfile.backend -t biohuez-api .
docker run -p 8000:8000 -e MOTHERDUCK_TOKEN=... -e BIOHUEZ_API_KEY=... biohuez-api
```

If the legacy repo URL changes:

```bash
docker build \
  --build-arg BIOHUEZ_LEGACY_REPO_URL=https://github.com/michaelatingzizhang/biohuez-dashboard.git \
  -f Dockerfile.backend \
  -t biohuez-api .
```
