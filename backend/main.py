import asyncio
import contextlib
import io
import json
import os
import runpy
import sys
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
CACHE_TTL_SECONDS = int(os.environ.get("BIOHUEZ_API_CACHE_TTL_SECONDS", "300"))

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
    "system-status": "get_system_status.py",
    "executive-insights": "get_executive_insights.py",
}

app = FastAPI(title="BioHuez Dashboard API", version="0.1.0")

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

cache: dict[str, dict[str, Any]] = {}
script_lock = asyncio.Lock()


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

    script_name = ENDPOINTS[endpoint]
    async with script_lock:
        cached = cache.get(endpoint)
        if cached and cached["expires_at"] > time.time():
            return cached["payload"]
        payload = await asyncio.to_thread(run_json_script, script_name)
        cache[endpoint] = {"payload": payload, "expires_at": time.time() + CACHE_TTL_SECONDS}
        return payload


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "endpoints": sorted(ENDPOINTS)}


@app.get("/{endpoint}")
async def get_endpoint(endpoint: str, x_biohuez_api_key: str | None = Header(default=None)) -> Any:
    check_api_key(x_biohuez_api_key)
    if endpoint not in ENDPOINTS:
        raise HTTPException(status_code=404, detail="Unknown endpoint")
    try:
        return await endpoint_payload(endpoint)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
