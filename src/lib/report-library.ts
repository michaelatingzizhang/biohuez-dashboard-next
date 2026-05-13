export interface ReportLibrarySlide {
  key: string
  title: string
  summary: string
}

export interface ReportLibraryPage {
  path: string
  label: string
  priority: 1 | 2 | 3
  slides: ReportLibrarySlide[]
}

export function slugifyReportText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildReportSlideKey(title: string) {
  return slugifyReportText(title)
}

export function buildGlobalReportSlideId(path: string, slideKey: string) {
  return `${path}#${slideKey}`
}

export const REPORT_LIBRARY: ReportLibraryPage[] = [
  {
    path: "/",
    label: "Summary",
    priority: 1,
    slides: [
      { key: buildReportSlideKey("Topline Performance"), title: "Topline Performance", summary: "Top revenue, orders, units, and price context." },
      { key: buildReportSlideKey("FBA Inventory Health"), title: "FBA Inventory Health", summary: "Stock health and coverage by SKU." },
      { key: buildReportSlideKey("Revenue & ASP"), title: "Revenue & ASP", summary: "Daily revenue stack with price overlay." },
      { key: buildReportSlideKey("SKU Mix"), title: "SKU Mix", summary: "Revenue, units, and ASP by SKU." },
      { key: buildReportSlideKey("SKU Breakdown"), title: "SKU Breakdown", summary: "Detailed SKU performance table." },
    ],
  },
  {
    path: "/sales",
    label: "Sales",
    priority: 1,
    slides: [
      { key: buildReportSlideKey("Sales KPI Widgets"), title: "Sales KPI Widgets", summary: "Topline sales KPIs and selected widgets." },
      { key: buildReportSlideKey("Sales Performance Trend"), title: "Sales Performance Trend", summary: "Primary sales trend with stacked bands." },
      { key: buildReportSlideKey("SKU Performance"), title: "SKU Performance", summary: "SKU performance and sales table." },
      { key: buildReportSlideKey("SKU Time Series"), title: "SKU Time Series", summary: "Trend detail by SKU over time." },
      { key: buildReportSlideKey("Sales Mix Intelligence"), title: "Sales Mix Intelligence", summary: "Weekly momentum, movers, and diagnostic drivers." },
      { key: buildReportSlideKey("Traffic And Session Quality"), title: "Traffic And Session Quality", summary: "Traffic, sessions, and session quality." },
      { key: buildReportSlideKey("BSR Rank"), title: "BSR Rank", summary: "BSR trends and current rankings." },
      { key: buildReportSlideKey("Advertising Efficiency"), title: "Advertising Efficiency", summary: "Ad spend mix and ACOS efficiency." },
      { key: buildReportSlideKey("Unit Economics"), title: "Unit Economics", summary: "pROAS and customer acquisition cost." },
      { key: buildReportSlideKey("Customer Journey"), title: "Customer Journey", summary: "New vs repeat revenue and customer detail." },
    ],
  },
  {
    path: "/finance",
    label: "Finance",
    priority: 1,
    slides: [
      { key: buildReportSlideKey("Finance Executive Summary"), title: "Finance Executive Summary", summary: "Topline sales, fees, and margin view." },
      { key: buildReportSlideKey("Finance Drivers"), title: "Finance Drivers", summary: "Per-unit economics and latest margin drivers." },
      { key: buildReportSlideKey("Finance Detail Tables"), title: "Finance Detail Tables", summary: "Monthly P&L and settlement appendix." },
    ],
  },
  {
    path: "/inventory",
    label: "Inventory",
    priority: 2,
    slides: [
      { key: buildReportSlideKey("Inventory Executive Summary"), title: "Inventory Executive Summary", summary: "Coverage, inbound units, and risk summary." },
      { key: buildReportSlideKey("Inventory Coverage And Aging"), title: "Inventory Coverage And Aging", summary: "Coverage by SKU and aging detail." },
      { key: buildReportSlideKey("Inventory Flow And Placement"), title: "Inventory Flow And Placement", summary: "Movement history, FC placement, and receipts." },
    ],
  },
  {
    path: "/returns",
    label: "Returns",
    priority: 1,
    slides: [
      { key: buildReportSlideKey("Returns Executive Summary"), title: "Returns Executive Summary", summary: "Return rate, refund impact, and top issue." },
      { key: buildReportSlideKey("Returns Drivers"), title: "Returns Drivers", summary: "SKU and reason drivers behind returns." },
      { key: buildReportSlideKey("Returns Detail"), title: "Returns Detail", summary: "Timing, reasons, tables, and raw return log." },
    ],
  },
  {
    path: "/campaign",
    label: "Campaign",
    priority: 1,
    slides: [
      { key: buildReportSlideKey("Campaign Overview"), title: "Campaign Overview", summary: "Spend, sales, ACOS, and ROAS summary." },
      { key: buildReportSlideKey("Campaign Performance Detail"), title: "Campaign Performance Detail", summary: "Campaign-by-campaign performance detail." },
    ],
  },
  {
    path: "/demographics",
    label: "Demographics",
    priority: 1,
    slides: [
      { key: buildReportSlideKey("Demographics Executive Summary"), title: "Demographics Executive Summary", summary: "Repeat rate and retention health summary." },
      { key: buildReportSlideKey("Demographics Segment Detail"), title: "Demographics Segment Detail", summary: "ASIN repeat health and segment shifts." },
    ],
  },
  {
    path: "/geography",
    label: "Geography",
    priority: 2,
    slides: [
      { key: buildReportSlideKey("Geography Executive Summary"), title: "Geography Executive Summary", summary: "Regional concentration and coverage summary." },
      { key: buildReportSlideKey("Geography Performance Detail"), title: "Geography Performance Detail", summary: "State and city performance detail." },
      { key: buildReportSlideKey("Geography Concentration Tables"), title: "Geography Concentration Tables", summary: "Concentration appendix by SKU and market." },
    ],
  },
  {
    path: "/cohorts",
    label: "Cohorts",
    priority: 3,
    slides: [
      { key: buildReportSlideKey("Cohort Retention"), title: "Cohort Retention", summary: "Retention heatmap and headline cohort metrics." },
      { key: buildReportSlideKey("Cohort Size Trend"), title: "Cohort Size Trend", summary: "Incoming cohort size over time." },
    ],
  },
  {
    path: "/competitor",
    label: "Competitor",
    priority: 2,
    slides: [
      { key: buildReportSlideKey("Competitor Executive Summary"), title: "Competitor Executive Summary", summary: "Competitive rank and price summary." },
      { key: buildReportSlideKey("Competitor Positioning Detail"), title: "Competitor Positioning Detail", summary: "Rank gaps, threats, and price detail." },
    ],
  },
  {
    path: "/impact-analysis",
    label: "Impact Analysis",
    priority: 2,
    slides: [
      { key: buildReportSlideKey("Impact Overview"), title: "Impact Overview", summary: "Action timeline and latest outcome summary." },
      { key: buildReportSlideKey("Impact Before And After"), title: "Impact Before And After", summary: "Before-and-after commercial performance." },
      { key: buildReportSlideKey("Impact Support Modules"), title: "Impact Support Modules", summary: "Ads, BSR, and search support evidence." },
    ],
  },
  {
    path: "/seasonality",
    label: "Seasonality",
    priority: 3,
    slides: [
      { key: buildReportSlideKey("Seasonality Outlook"), title: "Seasonality Outlook", summary: "Near-term demand outlook and forecast." },
      { key: buildReportSlideKey("Seasonality Pattern Readout"), title: "Seasonality Pattern Readout", summary: "Peak, slow, and weekly momentum periods." },
      { key: buildReportSlideKey("Seasonality Detail Charts"), title: "Seasonality Detail Charts", summary: "Day, month, week, and hour appendix." },
    ],
  },
  {
    path: "/system-status",
    label: "System Status",
    priority: 3,
    slides: [
      { key: buildReportSlideKey("System Health"), title: "System Health", summary: "Overall data health and sync readiness." },
      { key: buildReportSlideKey("System Table Detail"), title: "System Table Detail", summary: "Table-by-table health breakdown." },
    ],
  },
]

export const REPORT_LIBRARY_BY_PATH = Object.fromEntries(
  REPORT_LIBRARY.map((page) => [page.path, page]),
) as Record<string, ReportLibraryPage>

export const REPORT_PRIORITY_PAGES = REPORT_LIBRARY.filter((page) => page.priority <= 2)
