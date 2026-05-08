# Streamlit Migration Checklist

This tracks the old `biohuez-dashboard` Streamlit pages against the new Next.js dashboard.

## Migrated Or Mostly Migrated

- Summary: sales KPIs, inventory snapshot, revenue/ASP, orders/units, SKU breakdown, executive insights.
- Sales: sales traffic, ads, BSR, SKU performance, pROAS/CAC, customer journey sections.
- Finance: calendar P&L, per-unit economics, settlement summary, margin pressure, Streamlit trend modules.
- Geography: shipment/state/city view, SKU concentration fallback, latest state/city modules.
- Returns: return log, reason clusters, SKU risk, trend charts, refund impact.
- Inventory: planning snapshot, restock recommendations, ledger movement, aging, FC distribution, receipt history.
- Campaign: ads data, search terms, campaign efficiency, cluster/tier opportunity sections.
- Cohorts: retention heatmap, cohort sizes, retention proxy.
- Competitor: BSR comparison, competitor snapshot, review tracking, item comparison placeholders.
- Seasonality: day/month/week/hour ordering patterns, forecast and momentum signals.
- System Status: database/table freshness and row counts.
- Impact Analysis: marketing action timeline, before/after phase comparisons, SP ads impact, BSR movement, search query shifts, demographics highlights.
- Demographics: monthly/weekly Streamlit profile KPIs, latest snapshot, period comparison, and trend modules.
- Campaign: war room KPIs, A/B/C/D scenario logic, cluster action map, tier profitability, funnel diagnostics, and price benchmark.

## Needs Deeper Review Against Streamlit

- Cohorts: old Streamlit has LTV, acquisition/repeat revenue, repeat-rate charts, cohort summary table, and LTV/CAC. The new page currently has retention proxy and cohort size only.
- Competitor: old Streamlit has price history, rating history, full history expanders, and refresh workflow. The new page has the main BSR/review/intelligence modules but should get polish if Tingzi wants exact parity.
- Demographics: old Streamlit has manual Month A/Month B and Week A/Week B selectors. New page shows default latest-vs-previous comparisons.
- Impact Analysis: migrated as a functional page; should be reviewed after real stakeholder feedback because some old explanatory callouts were converted into data-driven takeaways.
- DB Explorer: not migrated intentionally because it is an internal developer/admin tool, not a client-facing dashboard page.

Detailed review: `docs/streamlit-parity-review.md`.

## Review Format

For each page, review:

- What old Streamlit module is missing.
- Whether it should be copied exactly or redesigned for the new commercial dashboard.
- Whether it depends on data that is already in MotherDuck.
- Priority: must-have for Tier 1/2, polish, or future.
