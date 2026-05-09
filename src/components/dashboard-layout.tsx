"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  GitMerge,
  Home,
  MapPin,
  Menu,
  RefreshCw,
  RotateCcw,
  Search,
  Swords,
  Target,
  TrendingUp,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { DashboardFilters } from "@/components/dashboard-filters";

const navItems = [
  { icon: Home, label: "Summary", href: "/", priority: 1, preview: "/page-previews/summary.png" },
  { icon: BarChart3, label: "Sales", href: "/sales", priority: 1, preview: "/page-previews/sales.png" },
  { icon: DollarSign, label: "Finance", href: "/finance", priority: 1, preview: "/page-previews/finance.png" },
  { icon: Warehouse, label: "Inventory", href: "/inventory", priority: 2, preview: "/page-previews/inventory.png" },
  { icon: RotateCcw, label: "Returns", href: "/returns", priority: 1, preview: "/page-previews/returns.png" },
  { icon: Target, label: "Campaign", href: "/campaign", priority: 1, preview: "/page-previews/campaign.png" },
  { icon: Users, label: "Demographics", href: "/demographics", priority: 1, preview: "/page-previews/demographics.png" },
  { icon: MapPin, label: "Geography", href: "/geography", priority: 2, preview: "/page-previews/geography.png" },
  { icon: CalendarDays, label: "Seasonality", href: "/seasonality", priority: 3, preview: "/page-previews/seasonality.png" },
  { icon: GitMerge, label: "Cohorts", href: "/cohorts", priority: 3, preview: "/page-previews/cohorts.png" },
  { icon: Swords, label: "Competitor", href: "/competitor", priority: 2, preview: "/page-previews/competitor.png" },
  { icon: TrendingUp, label: "Impact Analysis", href: "/impact-analysis", priority: 2, preview: "/page-previews/impact-analysis.png" },
  { icon: Activity, label: "System Status", href: "/system-status", priority: 3, preview: "/page-previews/system-status.png" },
];

const pageSubtitles: Record<string, string> = {
  Summary: "Executive command view for sales, margin, inventory risk, and data freshness",
  Sales: "Revenue, units, ASP, AOV, sessions, conversion, and SKU trends",
  Finance: "Calendar P&L, settlement P&L, fees, refunds, and margin analysis",
  Inventory: "Stock levels, coverage, aging, inbound units, and operating risk",
  Returns: "Return rates, refund drag, SKU risk, and return reason trends",
  Campaign: "Ad spend, campaign efficiency, ACOS, ROAS, clicks, and conversion",
  Demographics: "Buyer segments, repeat behavior, cohort patterns, and customer mix",
  Geography: "Shipment geography, city concentration, state performance, and SKU mix",
  Cohorts: "Customer cohort retention and LTV analysis",
  Competitor: "Competitive pricing, visibility, positioning, and market signals",
  "Impact Analysis": "Before and after readout for marketing actions, search updates, and listing artwork",
  Seasonality: "Seasonal demand, peak periods, weekly patterns, and trend comparisons",
  "System Status": "MotherDuck, Amazon SP-API, Ads API, sync freshness, and endpoint health",
};

const pageNarratives: Record<string, { message: string; watch: string; action: string }> = {
  Summary: {
    message: "Executive view should quickly show whether the brand is healthy enough for daily operating decisions.",
    watch: "Revenue momentum, margin pressure, inventory risk, and API/data freshness.",
    action: "Use this slide as the opening readout before drilling into page-level drivers.",
  },
  Sales: {
    message: "Sales performance is the primary story: revenue, ASP, ad spend, and BSR should explain what changed.",
    watch: "KPI widgets, SKU time series, traffic quality, and ad spend mix.",
    action: "Review Sales first when the business question is growth, conversion, or SKU performance.",
  },
  Finance: {
    message: "Finance should explain whether reported sales are converting into contribution after fees and refunds.",
    watch: "Settlement gaps, fee drag, refunds, margin trend, and calendar versus payout timing.",
    action: "Use this slide to identify where revenue is leaking into Amazon costs or refund pressure.",
  },
  Inventory: {
    message: "Inventory should surface operating risk before it becomes a sales constraint.",
    watch: "Coverage, low-stock SKUs, aging units, inbound timing, and fulfillment-center imbalance.",
    action: "Use this slide to prioritize restock and inventory cleanup decisions.",
  },
  Returns: {
    message: "Returns should show which products or reasons are creating refund drag.",
    watch: "Return rate spikes, reason mix, refund value, and SKU-level concentration.",
    action: "Use this slide to connect quality, listing, or customer-fit issues to financial impact.",
  },
  Campaign: {
    message: "Campaigns should show whether paid spend is creating profitable demand.",
    watch: "ACOS, ROAS, pROAS, clicks, conversion, campaign type, and search-term efficiency.",
    action: "Use this slide to decide whether to scale, pause, or restructure spend.",
  },
  Demographics: {
    message: "Demographics should explain who is buying and whether repeat behavior is improving.",
    watch: "Customer mix, repeat purchase behavior, cohorts, segments, and revenue contribution.",
    action: "Use this slide to guide positioning, retention, and brand onboarding narratives.",
  },
  Geography: {
    message: "Geography should show where demand is concentrated and whether regional mix is shifting.",
    watch: "State/city concentration, SKU mix by region, shipment geography, and growth pockets.",
    action: "Use this slide for regional demand planning and market expansion conversations.",
  },
  Seasonality: {
    message: "Seasonality should make demand timing predictable enough for inventory and campaign planning.",
    watch: "Weekly patterns, seasonal peaks, recurring dips, and category timing.",
    action: "Use this slide to plan stock, ad pacing, and seasonal promotions.",
  },
  Cohorts: {
    message: "Cohorts should show whether customers are coming back and compounding value over time.",
    watch: "Retention curves, repeat behavior, cohort revenue, and LTV movement.",
    action: "Use this slide when the question is customer quality rather than one-time sales.",
  },
  Competitor: {
    message: "Competitor analysis should show where BioHuez is positioned against the market.",
    watch: "Price, visibility, BSR movement, competitive offers, and category signals.",
    action: "Use this slide to support pricing, listing, and positioning decisions.",
  },
  "Impact Analysis": {
    message: "Impact analysis should isolate what changed after a specific action.",
    watch: "Before/after movement in traffic, conversion, sales, BSR, and ad efficiency.",
    action: "Use this slide for experiments such as artwork changes, listing edits, or campaign shifts.",
  },
  "System Status": {
    message: "System status should prove whether the dashboard data is trustworthy and current.",
    watch: "MotherDuck access, SP-API freshness, Ads API status, script errors, and endpoint health.",
    action: "Use this slide before demos or client reviews to confirm data readiness.",
  },
};

const DEFAULT_THEME = {
  dark: "#275719",
  canvas: "#F4EEE5",
  sage: "#5A774C",
  gold: "#AEA33C",
};

function getActiveNav(pathname: string) {
  if (pathname === "/") return "Summary";
  const item = navItems.find(nav => pathname === nav.href);
  return item?.label || "Summary";
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewNav, setPreviewNav] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeNav = getActiveNav(pathname);
  const activeIndex = Math.max(0, navItems.findIndex(item => item.label === activeNav));
  const previousItem = navItems[(activeIndex - 1 + navItems.length) % navItems.length];
  const nextItem = navItems[(activeIndex + 1) % navItems.length];
  const previewItem = navItems.find(item => item.label === previewNav);
  const [reportMode, setReportMode] = useState(false);
  const [reportView, setReportView] = useState<"slide" | "sorter">("slide");
  const activeNarrative = pageNarratives[activeNav] || pageNarratives.Summary;
  const comparisonActive = searchParams.get("compare") === "previous";

  function handleRefresh() {
    setRefreshing(true);
    window.location.reload();
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("biohuez-theme");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setTheme({ ...DEFAULT_THEME, ...parsed });
    } catch {}
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("biohuez-report-mode");
    if (saved === "true") setReportMode(true);
    const savedReportView = window.localStorage.getItem("biohuez-report-view");
    if (savedReportView === "sorter") setReportView("sorter");
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--biohuez-dark", theme.dark);
    document.documentElement.style.setProperty("--biohuez-canvas", theme.canvas);
    document.documentElement.style.setProperty("--biohuez-sage", theme.sage);
    document.documentElement.style.setProperty("--biohuez-gold", theme.gold);
    window.localStorage.setItem("biohuez-theme", JSON.stringify(theme));
  }, [theme]);

  function updateTheme(key: keyof typeof DEFAULT_THEME, value: string) {
    setTheme(current => ({ ...current, [key]: value }));
  }

  function toggleReportMode() {
    setReportMode(current => {
      window.localStorage.setItem("biohuez-report-mode", String(!current));
      return !current;
    });
  }

  function updateReportView(value: "slide" | "sorter") {
    setReportView(value);
    window.localStorage.setItem("biohuez-report-view", value);
  }

  function toggleCompare() {
    const next = new URLSearchParams(searchParams.toString());
    if (comparisonActive) next.delete("compare");
    else next.set("compare", "previous");
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`);
  }

  return (
    <div className={`commercial-shell ${reportMode ? "is-report-mode" : ""}`}>
      <aside className={`commercial-sidebar ${sidebarOpen ? "is-open" : ""} ${!reportMode && collapsed ? "is-collapsed" : ""} ${reportMode ? "is-report-sidebar" : ""}`}>
        {reportMode ? (
          <>
            <div className="commercial-report-sidebar-brand">
              <Link href="/" className="commercial-brand-link">
                <Image
                  src="/biohuez-logo.png"
                  alt="BioHuez"
                  width={142}
                  height={46}
                  className="commercial-brand-logo"
                  priority
                />
              </Link>
              <button className="commercial-report-exit" onClick={toggleReportMode}>Exit</button>
            </div>

            <div className="commercial-report-sidebar-title">
              <span>Brand Report</span>
              <strong>Slide {activeIndex + 1} of {navItems.length}</strong>
            </div>

            <div className="commercial-report-view-toggle">
              <button className={reportView === "slide" ? "active" : ""} onClick={() => updateReportView("slide")}>Slide</button>
              <button className={reportView === "sorter" ? "active" : ""} onClick={() => updateReportView("sorter")}>Sorter</button>
            </div>

            <nav className="commercial-report-slide-nav" aria-label="Report slides">
              {navItems.map((item, index) => {
                const isActive = item.label === activeNav;
                return (
                  <Link key={item.label} href={item.href} className={`commercial-report-slide-link ${isActive ? "active" : ""}`}>
                    <span>{index + 1}</span>
                    <img src={item.preview} alt="" />
                    <div>
                      <strong>{item.label}</strong>
                      <small>{pageNarratives[item.label]?.message || pageSubtitles[item.label] || "Dashboard page"}</small>
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="commercial-report-sidebar-footer">
              <Link href={previousItem.href} className="commercial-report-step full">
                <ChevronLeft size={15} />
                <span>{previousItem.label}</span>
              </Link>
              <Link href={nextItem.href} className="commercial-report-step full">
                <span>{nextItem.label}</span>
                <ChevronRight size={15} />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="commercial-brand">
              <Link href="/" className="commercial-brand-link">
                <Image
                  src="/biohuez-logo.png"
                  alt="BioHuez"
                  width={156}
                  height={50}
                  className="commercial-brand-logo"
                  priority
                />
              </Link>
              <button className="commercial-icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
                <X size={16} />
              </button>
            </div>

            <nav className="commercial-nav">
              {navItems.map(item => {
                const isActive = activeNav === item.label;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`commercial-nav-item ${isActive ? "active" : ""}`}
                    onMouseEnter={() => setPreviewNav(item.label)}
                    onMouseLeave={() => setPreviewNav(null)}
                    onFocus={() => setPreviewNav(item.label)}
                    onBlur={() => setPreviewNav(null)}
                  >
                    <item.icon size={17} />
                    {!collapsed && (
                      <>
                        <span>{item.label}</span>
                      </>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="commercial-sidebar-footer">
              {!collapsed && (
                <div className="commercial-health-card">
                  <div className="commercial-health-top">
                    <span>Data Freshness</span>
                    <span className="commercial-status-dot" />
                  </div>
                  <div className="commercial-health-date">Live data</div>
                  <button className="commercial-refresh-card-button" onClick={handleRefresh}>
                    <RefreshCw size={13} className={refreshing ? "spin" : ""} />
                    Refresh page
                  </button>
                </div>
              )}
              {!collapsed && (
                <div className="commercial-theme-card">
                  <button className="commercial-theme-toggle" onClick={() => setThemeOpen(!themeOpen)}>
                    Customize colors
                  </button>
                  {themeOpen && (
                    <div className="commercial-theme-grid">
                      {Object.entries(theme).map(([key, value]) => (
                        <label key={key}>
                          <span>{key}</span>
                          <input type="color" value={value} onChange={event => updateTheme(key as keyof typeof DEFAULT_THEME, event.target.value)} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button className="commercial-collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse navigation">
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                {!collapsed && <span>Collapse</span>}
              </button>
            </div>
          </>
        )}
      </aside>

      <div className={`commercial-sidebar-preview ${previewItem ? "is-visible" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        {previewItem && (
          <>
            <div className="commercial-sidebar-preview-top">
              <span>{previewItem.label}</span>
            </div>
            <img src={previewItem.preview} alt={`${previewItem.label} preview`} />
          </>
        )}
      </div>

      <div className="commercial-workspace">
        <header className="commercial-topbar">
          <div className="commercial-topbar-heading">
            <button className="commercial-icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <Menu size={19} />
            </button>
            <div>
              <h1>{activeNav}</h1>
              {activeNav !== "Sales" && <p>{pageSubtitles[activeNav] || ""}</p>}
            </div>
            <div className="commercial-report-controls">
              <button className={`commercial-report-toggle ${reportMode ? "active" : ""}`} onClick={toggleReportMode}>
                {reportMode ? "Exit report" : "Report mode"}
              </button>
              <button className={`commercial-report-toggle ${comparisonActive ? "active" : ""}`} onClick={toggleCompare}>
                Compare previous period
              </button>
              {reportMode && (
                <button className={`commercial-report-toggle ${reportView === "sorter" ? "active" : ""}`} onClick={() => updateReportView(reportView === "sorter" ? "slide" : "sorter")}>
                  {reportView === "sorter" ? "Slide view" : "Slide sorter"}
                </button>
              )}
            </div>
          </div>
          <div className="commercial-topbar-controls">
            <Suspense fallback={null}>
              <DashboardFilters />
            </Suspense>
          </div>
        </header>

        <main className="commercial-main">
          {reportMode && reportView === "slide" && (
            <div className="commercial-report-banner">
              <div>
                <span>Slide {activeIndex + 1} of {navItems.length}</span>
                <strong>{activeNav}</strong>
              </div>
              <p>{activeNarrative.message}</p>
            </div>
          )}
          {reportMode && reportView === "slide" && (
            <section className="commercial-report-insights" aria-label="Report slide insights">
              <div>
                <span>Key Message</span>
                <strong>{activeNarrative.message}</strong>
              </div>
              <div>
                <span>Watch</span>
                <strong>{activeNarrative.watch}</strong>
              </div>
              <div>
                <span>Action</span>
                <strong>{activeNarrative.action}</strong>
              </div>
            </section>
          )}
          {reportMode && reportView === "sorter" ? (
            <section className="commercial-slide-sorter" aria-label="Report slide sorter">
              <div className="commercial-slide-sorter-heading">
                <div>
                  <span>Brand Report</span>
                  <strong>Slide Sorter</strong>
                </div>
                <p>Review every dashboard page as a reporting slide, then open any slide to continue the narrative.</p>
              </div>
              <div className="commercial-slide-sorter-grid">
                {navItems.map((item, index) => (
                  <Link key={item.label} href={item.href} className={`commercial-slide-sorter-card ${item.label === activeNav ? "active" : ""}`} onClick={() => updateReportView("slide")}>
                    <div className="commercial-slide-sorter-preview">
                      <span>{index + 1}</span>
                      <img src={item.preview} alt="" />
                    </div>
                    <div className="commercial-slide-sorter-copy">
                      <strong>{item.label}</strong>
                      <p>{pageNarratives[item.label]?.message || pageSubtitles[item.label]}</p>
                      <small>{pageNarratives[item.label]?.action}</small>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <Suspense fallback={null}>
              {children}
            </Suspense>
          )}
        </main>
      </div>

      <div className="commercial-ai-dock">
        <Search size={16} />
        <input placeholder="Ask BioHuez about sales, finance, campaigns, or inventory..." />
        <button type="button">Overview</button>
      </div>
    </div>
  );
}
