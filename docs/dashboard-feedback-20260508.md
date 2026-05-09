# Dashboard Feedback 2026-05-08

Source: `/home/ultron/Downloads/Dashboard Feedback 20260508.pptx`

## Navigation / Reporting Model

- [Done] Add a PowerPoint-style page navigation concept.
- [Done] Sidebar navigation should support thumbnail previews.
- [Done] Pages/containers should be viewable sequentially like slides.
- [Done] Each slide/container should tell one message.
- [Done] Combined slides should support brand reporting/storytelling.
- [Done] Consider slide-sorter style view where containers can be viewed individually or side-by-side.
- [Done] Add auto-generated insights per container.
- [Done] Add dynamic titles/subtitles that summarize the key takeaway.

## Sales Overview Layout

- [Done] Use a clean top-to-bottom layout:
  - Filter/control bar.
  - Subpage tabs.
  - KPI block.
  - Main chart block.
- [Done] Make filter controls look like grouped Day / Week / Month / Custom options.
- [Done] Add custom date selection in the same grouped visual format.
- [Done] Keep SKU selector simple: All, Black, Brown, Cream Latte.
- [Done] Add Save view, Reset, and Compare previous period actions.
- [Done] Save selected view so users do not need to reselect checkboxes.
- [Done] In compare mode, split the screen into two matching metric/chart panels.

## KPI Cards

- [Done] KPI section should be editable like iPhone widgets.
- [Done] Edit view should allow hiding/removing cards with an `x`.
- [Done] Hidden widgets should appear greyed out in edit mode and be restorable.
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

- [Done] Main chart should resemble a clean stock-chart layout.
- [Done] Sales chart should be taller.
- [Done] ASP, Ad Spend, and BSR should be equal height.
- [Done] Dates should display as `MM/DD`.
- [Done] Use the four BioHuez brand colors, not Robinhood colors.
- [Done] Make chart separation lines more obvious.
- [Done] Hovering a date should sync the cursor/selection across all chart bands.
- [Done] Dynamic title should reflect the selected interval, for example `L30D Performance`.
- [Done] Dynamic subtitle should summarize the chart message, for example improving ASP.
- [Done] Allow users to select which chart layers to display.
- [Done] Make area fills lighter and lines brighter.
- [Done] Include ad spend by type at the bottom where available:
  - SP = Sponsored Products
  - SB = Sponsored Brands
  - SD = Sponsored Display
- [Done] Add chart type customization where useful, for example line vs area.

## Sales Tables / Export

- [Done] Sales table should include or support:
  - Sales
  - ASP
  - AOV
  - Ad Sales
  - % of Ad Sales
  - Ad Units
  - % of Ad Units
- [Done] Add option to download as Excel.

## Time-Series Views

- [Done] Add a dedicated time-series view:
  - Sales by SKU over time.
  - Units by SKU over time.
  - ASP by SKU over time.
- [Done] Support weekly aggregation when a week-based interval is selected.
- [Done] For longer brand history, allow viewing historical data in weekly form.
- [Done] Keep aggregated period views separate from time-series views.

## Traffic / Session Analysis

- [Done] Recreate the Amazon-style chart if possible.
- [Done] Investigate whether add-to-cart data is available for the whole brand.
- [Done] If brand-level add-to-cart is unavailable, keep current approach.
- [Done] Key analysis goal:
  - Show whether session count improved based on ad spend.
  - Show whether session-to-click improved after artwork changes.
  - BioHuez had artwork changes around mid-April, so daily data matters.

## Remaining Implementation Status

- Done:
  - Full slide/reporting mode navigation.
  - Sidebar thumbnail previews.
  - Simplified SKU options.
  - Sales KPI/edit view.
  - Sales stacked chart layout.
  - Brand color customization.
  - Daily/weekly granularity toggle.
  - Save view/reset/compare controls.
  - Excel-compatible SKU performance export.
  - Ad spend by type in Sales overview chart.
  - Dedicated Sales/Units/ASP by SKU time-series view.
  - Traffic/session/artwork impact analysis refinement.
  - Chart type customization.

- Still to build:
  - None from this feedback file.
