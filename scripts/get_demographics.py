import sys, json, warnings, math
from _bootstrap import add_legacy_dashboard_to_path
warnings.filterwarnings('ignore')
add_legacy_dashboard_to_path()
import db

def clean(obj):
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, 'item'):
        return obj.item()
    return obj

result = {}

try:
    df = db.get_ba_repeat_purchase_weekly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['repeat_weekly'] = clean(df.to_dict(orient='records'))
    else:
        result['repeat_weekly'] = []
except Exception as e:
    result['repeat_weekly_error'] = str(e)
    result['repeat_weekly'] = []

try:
    df = db.get_ba_repeat_purchase_monthly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['repeat_monthly'] = clean(df.to_dict(orient='records'))
    else:
        result['repeat_monthly'] = []
except Exception as e:
    result['repeat_monthly_error'] = str(e)
    result['repeat_monthly'] = []

print(json.dumps(result))
