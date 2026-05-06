import os
import sys
from pathlib import Path

from dotenv import load_dotenv


def load_local_env():
    repo_dir = Path(__file__).resolve().parents[1]
    for env_path in (repo_dir / ".env.local", repo_dir / ".env", repo_dir.parent / "biohuez-dashboard" / ".env"):
        if env_path.exists():
            load_dotenv(env_path, override=False)

    aliases = {
        "SP_API_CLIENT_ID": "SP_API_LWA_APP_ID",
        "LWA_CLIENT_ID": "SP_API_LWA_APP_ID",
        "SP_API_CLIENT_SECRET": "SP_API_LWA_CLIENT_SECRET",
        "LWA_CLIENT_SECRET": "SP_API_LWA_CLIENT_SECRET",
    }
    for source, target in aliases.items():
        if os.getenv(source) and not os.getenv(target):
            os.environ[target] = os.environ[source]


def add_legacy_dashboard_to_path():
    load_local_env()
    default_dir = Path(__file__).resolve().parents[2] / "biohuez-dashboard"
    legacy_dir = Path(os.environ.get("BIOHUEZ_LEGACY_DASHBOARD_DIR", default_dir))
    sys.path.insert(0, str(legacy_dir))
    return legacy_dir
