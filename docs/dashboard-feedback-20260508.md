# Dashboard Feedback 2026-05-08

Source: `/home/ultron/Downloads/Dashboard Feedback 20260508.pptx`

## Navigation / Reporting Model

- Add a PowerPoint-style page navigation concept.
- Sidebar navigation should support thumbnail previews.
- Pages/containers should be viewable sequentially like slides.
- Each slide/container should tell one message.
- Combined slides should support brand reporting/storytelling.
- Consider slide-sorter style view where containers can be viewed individually or side-by-side.
- Add auto-generated insights per container.
- Add dynamic titles/subtitles that summarize the key takeaway.

## Sales Overview Layout

- Use a clean top-to-bottom layout:
  - Filter/control bar.
  - Subpage tabs.
  - KPI block.
  - Main chart block.
- Make filter controls look like grouped Day / Week / Month / Custom options.
- Add custom date selection in the same grouped visual format.
- Keep SKU selector simple: All, Black, Brown, Cream Latte.
- Add Save view, Reset, and Compare previous period actions.
- Save selected view so users do not need to reselect checkboxes.
- In compare mode, split the screen into two matching metric/chart panels.

## KPI Cards

- KPI section should be editable like iPhone widgets.
- Edit view should allow hiding/removing cards with an `x`.
- Hidden widgets should appear greyed out in edit mode and be restorable.
- Current KPI candidates:
  - Total Revenue
  - Total Orders
  - Total Units
  - AOV
  - ACOS
  - ROAS
  - pROAS
  - ASP
  - CAC
  - Organic Sales %

## Sales Chart

- Main chart should resemble a clean stock-chart layout.
- Sales chart should be taller.
- ASP, Ad Spend, and BSR should be equal height.
- Dates should display as `MM/DD`.
- Use the four BioHuez brand colors, not Robinhood colors.
- Make chart separation lines more obvious.
- Hovering a date should sync the cursor/selection across all chart bands.
- Dynamic title should reflect the selected interval, for example `L30D Performance`.
- Dynamic subtitle should summarize the chart message, for example improving ASP.
- Allow users to select which chart layers to display.
- Make area fills lighter and lines brighter.
- Include ad spend by type at the bottom where available:
  - SP = Sponsored Products
  - SD = Sponsored Display
- Add chart type customization where useful, for example line vs area.

## Sales Tables / Export

- Sales table should include or support:
  - Sales
  - ASP
  - AOV
  - Ad Sales
  - % of Ad Sales
  - Ad Units
  - % of Ad Units
- Add option to download as Excel.

## Time-Series Views

- Add a dedicated time-series view:
  - Sales by SKU over time.
  - Units by SKU over time.
  - ASP by SKU over time.
- Support weekly aggregation when a week-based interval is selected.
- For longer brand history, allow viewing historical data in weekly form.
- Keep aggregated period views separate from time-series views.

## Traffic / Session Analysis

- Recreate the Amazon-style chart if possible.
- Investigate whether add-to-cart data is available for the whole brand.
- If brand-level add-to-cart is unavailable, keep current approach.
- Key analysis goal:
  - Show whether session count improved based on ad spend.
  - Show whether session-to-click improved after artwork changes.
  - BioHuez had artwork changes around mid-April, so daily data matters.

## Remaining Implementation Status

- Mostly done:
  - Sidebar thumbnail previews.
  - Simplified SKU options.
  - Sales KPI/edit view.
  - Sales stacked chart layout.
  - Brand color customization.
  - Daily/weekly granularity toggle.
  - Save view/reset/compare controls.

- Still to build:
  - Full slide/reporting mode.
  - Container-level auto insights.
  - Excel export.
  - Ad spend by type in Sales overview chart.
  - Dedicated Sales/Units/ASP by SKU time-series view.
  - Traffic/session/artwork impact analysis refinement.
  - Chart type customization.
