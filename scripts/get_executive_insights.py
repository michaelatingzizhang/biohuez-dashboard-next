import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

INSIGHT_SOURCES = [
    {'section': 'Sales', 'href': '/sales', 'script': 'get_sales.py'},
    {'section': 'Finance', 'href': '/finance', 'script': 'get_finance.py'},
    {'section': 'Campaign', 'href': '/campaign', 'script': 'get_campaign.py'},
    {'section': 'Inventory', 'href': '/inventory', 'script': 'get_inventory.py'},
    {'section': 'Returns', 'href': '/returns', 'script': 'get_returns.py'},
    {'section': 'Demographics', 'href': '/demographics', 'script': 'get_demographics.py'},
    {'section': 'Competitor', 'href': '/competitor', 'script': 'get_competitor.py'},
    {'section': 'Seasonality', 'href': '/seasonality', 'script': 'get_seasonality.py'},
    {'section': 'Geography', 'href': '/geography', 'script': 'get_geography.py'},
]

SEVERITY_WEIGHT = {
    'critical': 0,
    'warning': 1,
    'positive': 2,
    'neutral': 3,
}


def normalize_severity(value, title='', detail=''):
    value = str(value or '').lower()
    text = f"{title} {detail}".lower()
    if value in ('critical', 'danger', 'alert'):
        return 'critical'
    if value in ('warning', 'warn', 'risk', 'negative'):
        return 'warning'
    if value in ('normal', 'positive', 'good', 'win', 'opportunity', 'healthy'):
        return 'positive'
    warning_terms = (
        'low', 'dropped', 'declined', 'excess', 'exposure', 'pressuring',
        'unavailable', 'outranking', 'risk', 'high', 'cooling',
    )
    positive_terms = ('healthy', 'improved', 'growth', 'win', 'opportunity')
    if any(term in text for term in warning_terms):
        return 'warning'
    if any(term in text for term in positive_terms):
        return 'positive'
    return 'neutral'


def run_source(source):
    script_path = Path(__file__).resolve().parent / source['script']
    try:
        proc = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if proc.returncode != 0:
            return {
                'section': source['section'],
                'href': source['href'],
                'error': proc.stderr.strip() or proc.stdout.strip() or f"{source['script']} exited with code {proc.returncode}",
            }

        payload = json.loads(proc.stdout)
        signals = payload.get('insights', {}).get('signals', [])
        items = []
        for signal in signals[:3]:
            title = signal.get('title') or f"{source['section']} signal"
            detail = signal.get('detail') or ''
            severity = normalize_severity(signal.get('severity'), title, detail)
            items.append({
                'section': source['section'],
                'href': source['href'],
                'severity': severity,
                'title': title,
                'detail': detail,
            })
        return {'section': source['section'], 'href': source['href'], 'items': items}
    except Exception as e:
        return {'section': source['section'], 'href': source['href'], 'error': str(e)}


def build_executive_insights():
    items = []
    sources = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(run_source, source) for source in INSIGHT_SOURCES]
        for future in as_completed(futures):
            source_result = future.result()
            sources.append({
                'section': source_result.get('section'),
                'href': source_result.get('href'),
                'error': source_result.get('error'),
                'signal_count': len(source_result.get('items', [])),
            })
            items.extend(source_result.get('items', []))

    items = sorted(items, key=lambda item: (SEVERITY_WEIGHT.get(item.get('severity'), 3), item.get('section', ''), item.get('title', '')))
    counts = {'critical': 0, 'warning': 0, 'positive': 0, 'neutral': 0}
    for item in items:
        counts[item['severity']] = counts.get(item['severity'], 0) + 1

    return {'items': items[:12], 'counts': counts, 'sources': sorted(sources, key=lambda item: item.get('section') or '')}


result = {'items': [], 'counts': {'critical': 0, 'warning': 0, 'positive': 0, 'neutral': 0}, 'sources': []}

try:
    result = build_executive_insights()
except Exception as e:
    result['error'] = str(e)

print(json.dumps(result))
