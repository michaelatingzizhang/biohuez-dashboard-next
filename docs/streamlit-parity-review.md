# Streamlit to Next.js Parity Review

Review date: 2026-05-07

This compares the old `biohuez-dashboard` Streamlit pages with the new `biohuez-dashboard-next` pages and lists what is already migrated, what is intentionally different, and what still needs work.

## Summary

Most Tier 1 and Tier 2 dashboard pages now have the important Streamlit data presentation migrated into the new Next.js interface. The highest-priority remaining parity gap is `Cohorts`, followed by smaller polish gaps in `Competitor`, `System Status`, and possible stakeholder-specific review items on `Impact Analysis`.

## Page Review

### Summary

Status: mostly migrated.

Old Streamlit coverage:
- Revenue, ASP, orders, units.
- Inventory cards.
- SKU revenue/unit/ASP breakdowns.
- Raw data expander.

New Next.js coverage:
- Executive insights.
- Revenue, orders, units, AOV, ASP.
- Inventory snapshot.
- Revenue/ASP charts.
- Orders/units charts.
- SKU breakdown table.

Remaining gap:
- Raw data expander is not copied as-is. This is acceptable for a commercial dashboard unless Tingzi wants an admin/debug view.

Priority: low.

### Sales

Status: mostly migrated.

Old Streamlit coverage:
- Core KPI rows.
- Revenue and order trends.
- SKU charts.
- Traffic, BSR, ads, pROAS/CAC, customer journey sections.

New Next.js coverage:
- Overview, Intelligence, Traffic, BSR, Ads, Unit Economics, Customer Journey tabs.
- Weekly momentum, SKU movers, BSR movers, ad spend, ACOS, pROAS, CAC.

Remaining gap:
- Needs visual QA against the old page, but the main business logic is present.

Priority: low to medium.

### Finance

Status: mostly migrated.

Old Streamlit coverage:
- Calendar P&L.
- Per-unit economics.
- Settlement summary.
- Margin pressure and Streamlit trend modules.

New Next.js coverage:
- Monthly P&L.
- Fee-adjusted margin.
- Finance intelligence.
- Calendar P&L.
- Per-unit economics.
- Latest month drivers.
- Cost drag.
- Margin pressure trend.
- Streamlit trend modules.
- Settlement summary.

Remaining gap:
- No major data module gap found.

Priority: low.

### Geography

Status: mostly migrated.

Old Streamlit coverage:
- State KPIs.
- State heatmap/table.
- State product mix charts.
- City bubble/table.
- City product mix charts.

New Next.js coverage:
- State performance.
- Market concentration.
- Revenue by state.
- Latest state/city modules.
- City/state tables.
- Concentration readout.
- SKU concentration.

Remaining gap:
- Old Streamlit visual map/bubble treatment is redesigned into charts and tables. This is acceptable unless Tingzi specifically wants the old map-style visual.

Priority: low.

### Returns

Status: mostly migrated.

Old Streamlit coverage:
- Return KPI rows.
- Return reason charts.
- SKU and trend views.
- Refund impact.
- Return log.

New Next.js coverage:
- Returns intelligence.
- SKU return risk.
- Reason clusters.
- Monthly return trend.
- Returns over time.
- Return reasons.
- Returns by SKU.
- Return log.

Remaining gap:
- No major data module gap found.

Priority: low.

### Inventory

Status: mostly migrated.

Old Streamlit coverage:
- Planning snapshot.
- Sales velocity.
- Aging.
- Movement history.
- FC distribution.
- Receipt history.

New Next.js coverage:
- Operations intelligence.
- SKU risk scores.
- FC concentration.
- Movement watchlist.
- Inventory coverage.
- Sales velocity.
- Aging.
- Movement history.
- Where inventory sits.
- Shipment/receipt history.

Remaining gap:
- No major data module gap found.

Priority: low.

### Campaign

Status: migrated after latest parity pass.

Old Streamlit coverage:
- War room KPIs.
- Cluster/tier scenario logic.
- pROAS.
- Funnel diagnostics.
- Price benchmark.
- Scenario action table.

New Next.js coverage:
- Campaign overview.
- Search terms.
- Optimization signals.
- Streamlit parity tab with war room KPIs, scenario summary, cluster action map, tier profitability, funnel diagnostic, and price benchmark.

Remaining gap:
- Needs Tingzi visual review for wording and prioritization, but the major Streamlit logic is now present.

Priority: low.

### Demographics

Status: mostly migrated after latest parity pass.

Old Streamlit coverage:
- Monthly and weekly tabs.
- Latest profile KPIs.
- All-time weighted profile.
- Period comparison.
- Latest snapshot.
- Multi-period trend.
- Repeat purchase and segment views.

New Next.js coverage:
- Intelligence.
- Streamlit Profiles tab.
- Repeat purchase.
- Segments.
- Monthly and weekly profile cards, comparison, snapshot, trend.

Remaining gap:
- Old Streamlit allowed interactive Month A/Month B and Week A/Week B selection. New version currently shows a default latest-vs-previous comparison. Add selectable comparison periods only if Tingzi wants the exact workflow.

Priority: medium only if she asks for manual comparison controls.

### Cohorts

Status: partially migrated.

Old Streamlit coverage:
- Avg LTV per cohort.
- Avg repeat rate.
- Total users acquired.
- Best cohort LTV.
- LTV by cohort.
- Cohort size and repeat rate.
- Acquisition vs repeat revenue.
- Cohort summary table.
- LTV/CAC if ad spend is available.

New Next.js coverage:
- Cohort retention heatmap.
- Cohort size over time.
- Total orders.
- Avg M1 and M3 retention proxy.

Remaining gap:
- Missing LTV, acquisition revenue, repeat revenue, repeat-rate chart, summary table, and LTV/CAC modules.
- Current script uses order history proxy, while old Streamlit reads cached AMC cohort files from `.cache/amc`. If the cache exists or can be generated, the new page should read that same cohort source.

Priority: high for parity.

### Competitor

Status: mostly migrated, with some polish gaps.

Old Streamlit coverage:
- Latest combined snapshot table.
- Competitor cards.
- BioHuez own cards.
- BSR trend.
- Review count trend split between competitors and BioHuez.
- Price history.
- Rating history.
- Full history expanders.
- Refresh button that runs SP-API capture.

New Next.js coverage:
- Intelligence tab.
- BSR comparison.
- Ratings and reviews.
- Item comparison placeholder/data display.
- Alternate purchase placeholder/data display.
- Price positioning.
- Threats and rank gap.

Remaining gap:
- No refresh button in UI.
- Price history and rating history are not shown as their own charts.
- Raw full-history expanders are not copied.
- Item comparison and alternate purchase sections are still basic JSON previews when data exists.

Priority: medium.

### Seasonality

Status: migrated and improved.

Old Streamlit coverage:
- Orders by day of week.
- Orders by month.
- Week/day heatmap.
- Key insights.

New Next.js coverage:
- Forecast signals.
- Four-week forecast.
- Peak and slow periods.
- Weekly momentum.
- Orders by day of week.
- Monthly orders and revenue.
- Weekly order trend.
- Orders by hour of day.

Remaining gap:
- Old heatmap view is not copied exactly, but the new page has stronger forecast/momentum modules.

Priority: low.

### Impact Analysis

Status: functionally migrated.

Old Streamlit coverage:
- Marketing action timeline.
- Revenue and traffic trends.
- Before/after comparison.
- Ads SP vs SD.
- BSR movement.
- Search query shifts.
- Demographic shifts.
- Key takeaways.

New Next.js coverage:
- Marketing timeline.
- Key takeaways.
- Revenue and traffic trends.
- Before/after comparison.
- SP spend and ROAS.
- BSR movement.
- Ads phase comparison.
- Search query cluster shifts.
- Demographic highlights.

Remaining gap:
- Some old explanatory callouts were converted into data-driven takeaways. Review with Tingzi after she checks the page.

Priority: medium after stakeholder feedback.

### System Status

Status: intentionally simplified.

Old Streamlit coverage:
- Table counts and freshness.
- Filters.
- Data issue details.
- Cron status explanation.
- Data update schedule.

New Next.js coverage:
- Database/table status and table details.

Remaining gap:
- Filters, cron explanation, and data update schedule are not fully copied.

Priority: low unless this becomes an internal admin page.

### DB Explorer

Status: intentionally not migrated.

Reason:
- This is an internal developer/admin tool, not a client-facing commercial dashboard page.

Priority: no action for Tier 1/2.

## Recommended Next Implementation Order

1. Cohorts parity: migrate old AMC/LTV workflow into the new page.
2. Competitor polish: add price history, rating history, better item/alternate purchase tables, and optional refresh workflow.
3. Demographics controls: add manual period selectors only if Tingzi wants old-style month/week comparison controls.
4. System Status admin polish: add filters/update schedule only if needed for internal operations.
5. Impact Analysis stakeholder review: adjust wording and modules after Tingzi reviews.
