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

## Needs Deeper Review Against Streamlit

- Demographics: old Streamlit has a very deep monthly/weekly comparison workflow; the new page has the main repeat purchase and segment modules but should still be reviewed for exact month-vs-month and weekly snapshot parity.
- Campaign: old Streamlit has detailed bubble/tier/scenario tables; the new page has action candidates, tier performance, and cluster opportunities but should be reviewed for exact scenario table parity.
- Impact Analysis: migrated as a functional page; should be reviewed after real stakeholder feedback because some old explanatory callouts were converted into data-driven takeaways.
- DB Explorer: not migrated intentionally because it is an internal developer/admin tool, not a client-facing dashboard page.

## Review Format

For each page, review:

- What old Streamlit module is missing.
- Whether it should be copied exactly or redesigned for the new commercial dashboard.
- Whether it depends on data that is already in MotherDuck.
- Priority: must-have for Tier 1/2, polish, or future.
