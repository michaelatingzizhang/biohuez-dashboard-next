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
    df = db.get_competitor()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['competitor'] = clean(df.to_dict(orient='records'))
    else:
        result['competitor'] = []
except Exception as e:
    result['competitor_error'] = str(e)
    result['competitor'] = []

try:
    df = db.get_bsr()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['bsr'] = clean(df.to_dict(orient='records'))
    else:
        result['bsr'] = []
except Exception as e:
    result['bsr_error'] = str(e)
    result['bsr'] = []

try:
    df = db.get_ba_item_comparison_weekly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['item_comparison'] = clean(df.to_dict(orient='records'))
    else:
        result['item_comparison'] = []
except Exception as e:
    result['item_comparison_error'] = str(e)
    result['item_comparison'] = []

try:
    df = db.get_ba_alternate_purchase_weekly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['alt_purchase'] = clean(df.to_dict(orient='records'))
    else:
        result['alt_purchase'] = []
except Exception as e:
    result['alt_purchase_error'] = str(e)
    result['alt_purchase'] = []

try:
    df = db.get_competitor_reviews()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['competitor_reviews'] = clean(df.to_dict(orient='records'))
    else:
        result['competitor_reviews'] = []
except Exception as e:
    result['competitor_reviews_error'] = str(e)
    result['competitor_reviews'] = []

print(json.dumps(result))
