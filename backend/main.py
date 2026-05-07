import asyncio
import contextlib
import io
import json
import logging
import os
import runpy
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
CACHE_TTL_SECONDS = int(os.environ.get("BIOHUEZ_API_CACHE_TTL_SECONDS", "300"))
CACHE_STALE_SECONDS = int(os.environ.get("BIOHUEZ_API_CACHE_STALE_SECONDS", "3600"))
REFRESH_INTERVAL_SECONDS = int(os.environ.get("BIOHUEZ_API_REFRESH_INTERVAL_SECONDS", "240"))
LOGGER = logging.getLogger("biohuez.api")

ENDPOINTS = {
    "summary": "get_summary.py",
    "sales": "get_sales.py",
    "finance": "get_finance.py",
    "returns": "get_returns.py",
    "inventory": "get_inventory.py",
    "campaign": "get_campaign.py",
    "demographics": "get_demographics.py",
    "geography": "get_geography.py",
    "competitor": "get_competitor.py",
    "seasonality": "get_seasonality.py",
    "cohorts": "get_cohorts.py",
    "impact-analysis": "get_impact_analysis.py",
    "system-status": "get_system_status.py",
    "executive-insights": "get_executive_insights.py",
}


def endpoint_names_from_env(name: str, default: str) -> tuple[str, ...]:
    raw = os.environ.get(name, default)
    return tuple(endpoint.strip() for endpoint in raw.split(",") if endpoint.strip() in ENDPOINTS)


WARMUP_ENDPOINTS = endpoint_names_from_env(
    "BIOHUEZ_API_WARMUP_ENDPOINTS",
    "summary,executive-insights,sales,finance,inventory,geography,returns,campaign,demographics",
)
REFRESH_ENDPOINTS = endpoint_names_from_env(
    "BIOHUEZ_API_REFRESH_ENDPOINTS",
    ",".join(WARMUP_ENDPOINTS),
)

cache: dict[str, dict[str, Any]] = {}
refresh_tasks: dict[str, asyncio.Task[Any]] = {}
script_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    warmup_task = asyncio.create_task(refresh_loop())
    try:
        yield
    finally:
        warmup_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await warmup_task


app = FastAPI(title="BioHuez Dashboard API", version="0.1.0", lifespan=lifespan)

allowed_origins = [
    origin.strip()
    for origin in os.environ.get("BIOHUEZ_ALLOWED_ORIGINS", "http://localhost:3001,http://localhost:3002").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def check_api_key(x_biohuez_api_key: str | None) -> None:
    expected = os.environ.get("BIOHUEZ_API_KEY")
    if expected and x_biohuez_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


def run_json_script(script_name: str) -> Any:
    script_path = SCRIPTS_DIR / script_name
    if not script_path.exists():
        raise FileNotFoundError(f"Unknown script: {script_name}")

    old_argv = sys.argv[:]
    old_path = sys.path[:]
    stdout = io.StringIO()
    stderr = io.StringIO()
    sys.argv = [str(script_path)]
    sys.path.insert(0, str(SCRIPTS_DIR))
    sys.path.insert(0, str(ROOT_DIR))
    try:
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            try:
                runpy.run_path(str(script_path), run_name="__main__")
            except SystemExit as exc:
                if exc.code not in (0, None):
                    raise RuntimeError(stderr.getvalue().strip() or stdout.getvalue().strip() or f"{script_name} exited with {exc.code}") from exc
    finally:
        sys.argv = old_argv
        sys.path = old_path

    output = stdout.getvalue().strip()
    if not output:
        raise RuntimeError(stderr.getvalue().strip() or f"{script_name} returned no JSON")
    return json.loads(output)


async def endpoint_payload(endpoint: str) -> Any:
    now = time.time()
    cached = cache.get(endpoint)
    if cached and cached["expires_at"] > now:
        return cached["payload"]
    if cached and cached.get("payload") is not None and cached.get("stale_until", 0) > now:
        schedule_refresh(endpoint)
        return cached["payload"]

    return await refresh_endpoint(endpoint, force=True)


async def refresh_endpoint(endpoint: str, force: bool = False) -> Any:
    now = time.time()
    cached = cache.get(endpoint)
    if not force and cached and cached["expires_at"] > now:
        return cached["payload"]

    script_name = ENDPOINTS[endpoint]
    async with script_lock:
        cached = cache.get(endpoint)
        if not force and cached and cached["expires_at"] > time.time():
            return cached["payload"]
        payload = await asyncio.to_thread(run_json_script, script_name)
        refreshed_at = time.time()
        cache[endpoint] = {
            "payload": payload,
            "expires_at": refreshed_at + CACHE_TTL_SECONDS,
            "stale_until": refreshed_at + CACHE_TTL_SECONDS + CACHE_STALE_SECONDS,
            "refreshed_at": refreshed_at,
        }
        return payload


def schedule_refresh(endpoint: str) -> None:
    task = refresh_tasks.get(endpoint)
    if task and not task.done():
        return
    refresh_tasks[endpoint] = asyncio.create_task(refresh_endpoint_quietly(endpoint))


async def refresh_endpoint_quietly(endpoint: str) -> None:
    try:
        await refresh_endpoint(endpoint, force=True)
    except Exception:
        LOGGER.exception("Failed to refresh %s", endpoint)


async def refresh_many(endpoints: tuple[str, ...]) -> None:
    for endpoint in endpoints:
        await refresh_endpoint_quietly(endpoint)


async def refresh_loop() -> None:
    await refresh_many(WARMUP_ENDPOINTS)
    while REFRESH_INTERVAL_SECONDS > 0:
        await asyncio.sleep(REFRESH_INTERVAL_SECONDS)
        await refresh_many(REFRESH_ENDPOINTS)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "endpoints": sorted(ENDPOINTS)}


@app.get("/ready")
async def ready(x_biohuez_api_key: str | None = Header(default=None)) -> dict[str, Any]:
    check_api_key(x_biohuez_api_key)
    now = time.time()
    warmed = {
        endpoint: {
            "ready": bool(cache.get(endpoint, {}).get("payload") is not None),
            "fresh": bool(cache.get(endpoint, {}).get("expires_at", 0) > now),
            "refreshed_at": cache.get(endpoint, {}).get("refreshed_at"),
        }
        for endpoint in WARMUP_ENDPOINTS
    }
    return {"status": "ready" if all(item["ready"] for item in warmed.values()) else "warming", "endpoints": warmed}


@app.get("/{endpoint}")
async def get_endpoint(endpoint: str, x_biohuez_api_key: str | None = Header(default=None)) -> Any:
    check_api_key(x_biohuez_api_key)
    if endpoint not in ENDPOINTS:
        raise HTTPException(status_code=404, detail="Unknown endpoint")
    try:
        return await endpoint_payload(endpoint)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
