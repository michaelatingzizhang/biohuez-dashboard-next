import json
import os
import secrets
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
DEFAULT_TIMEOUT_SECONDS = 45

for env_path in (ROOT_DIR / ".env.local", ROOT_DIR / ".env", ROOT_DIR.parent / "biohuez-dashboard" / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)

ENV_ALIASES = {
    "SP_API_CLIENT_ID": "SP_API_LWA_APP_ID",
    "LWA_CLIENT_ID": "SP_API_LWA_APP_ID",
    "SP_API_CLIENT_SECRET": "SP_API_LWA_CLIENT_SECRET",
    "LWA_CLIENT_SECRET": "SP_API_LWA_CLIENT_SECRET",
}

for source, target in ENV_ALIASES.items():
    if os.getenv(source) and not os.getenv(target):
        os.environ[target] = os.environ[source]

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
    for origin in os.getenv("BIOHUEZ_ALLOWED_ORIGINS", "http://localhost:3001,http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def require_api_key(x_biohuez_api_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("BIOHUEZ_API_KEY")
    if not expected:
        return
    if not x_biohuez_api_key or not secrets.compare_digest(x_biohuez_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def run_script(script_name: str) -> Any:
    script_path = SCRIPTS_DIR / script_name
    if not script_path.exists():
        raise HTTPException(status_code=404, detail=f"Script not found: {script_name}")

    timeout = int(os.getenv("BIOHUEZ_SCRIPT_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)))
    legacy_dir = os.getenv("BIOHUEZ_LEGACY_DASHBOARD_DIR", str(ROOT_DIR.parent / "biohuez-dashboard"))

    try:
        proc = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(ROOT_DIR),
            env={**os.environ, "BIOHUEZ_LEGACY_DASHBOARD_DIR": legacy_dir},
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail=f"{script_name} timed out after {timeout}s") from exc

    if proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip() or f"{script_name} exited with code {proc.returncode}"
        raise HTTPException(status_code=500, detail=detail)

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"{script_name} returned invalid JSON") from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", dependencies=[Depends(require_api_key)])
def ready() -> dict[str, Any]:
    return {
        "status": "ok",
        "endpoints": sorted(ENDPOINTS.keys()),
        "auth_enabled": bool(os.getenv("BIOHUEZ_API_KEY")),
    }


@app.get("/{endpoint}", dependencies=[Depends(require_api_key)])
def dashboard_endpoint(endpoint: str) -> Any:
    script_name = ENDPOINTS.get(endpoint)
    if not script_name:
        raise HTTPException(status_code=404, detail=f"Unknown endpoint: {endpoint}")
    return run_script(script_name)
