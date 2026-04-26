import sys, json, warnings, math
warnings.filterwarnings('ignore')
sys.path.insert(0, '/Users/tingzizhang/biohuez-dashboard')
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
    df = db.get_ads()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['ads'] = clean(df.to_dict(orient='records'))
    else:
        result['ads'] = []
except Exception as e:
    result['ads_error'] = str(e)
    result['ads'] = []

try:
    df = db.get_cleaned_search_query()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['search_terms'] = clean(df.to_dict(orient='records'))
    else:
        result['search_terms'] = []
except Exception as e:
    result['search_terms_error'] = str(e)
    result['search_terms'] = []

try:
    df = db.get_ads_by_type()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['ads_by_type'] = clean(df.to_dict(orient='records'))
    else:
        result['ads_by_type'] = []
except Exception as e:
    result['ads_by_type_error'] = str(e)
    result['ads_by_type'] = []

print(json.dumps(result))
