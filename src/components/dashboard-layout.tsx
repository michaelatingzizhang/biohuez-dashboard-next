"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const activeNav = getActiveNav(pathname);
  const previewItem = navItems.find(item => item.label === previewNav);

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
    document.documentElement.style.setProperty("--biohuez-dark", theme.dark);
    document.documentElement.style.setProperty("--biohuez-canvas", theme.canvas);
    document.documentElement.style.setProperty("--biohuez-sage", theme.sage);
    document.documentElement.style.setProperty("--biohuez-gold", theme.gold);
    window.localStorage.setItem("biohuez-theme", JSON.stringify(theme));
  }, [theme]);

  function updateTheme(key: keyof typeof DEFAULT_THEME, value: string) {
    setTheme(current => ({ ...current, [key]: value }));
  }

  return (
    <div className="commercial-shell">
      <aside className={`commercial-sidebar ${sidebarOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
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
          </div>
          <div className="commercial-topbar-controls">
            <Suspense fallback={null}>
              <DashboardFilters />
            </Suspense>
          </div>
        </header>

        <main className="commercial-main">
          <Suspense fallback={null}>
            {children}
          </Suspense>
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
