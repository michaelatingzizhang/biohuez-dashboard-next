import os
import sys
from pathlib import Path


def add_legacy_dashboard_to_path():
    default_dir = Path(__file__).resolve().parents[2] / "biohuez-dashboard"
    legacy_dir = Path(os.environ.get("BIOHUEZ_LEGACY_DASHBOARD_DIR", default_dir))
    sys.path.insert(0, str(legacy_dir))
    return legacy_dir
