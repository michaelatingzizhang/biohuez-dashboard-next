"use client";

import { Suspense, useState } from "react";
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
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { DashboardFilters } from "@/components/dashboard-filters";

const navItems = [
  { icon: Home, label: "Summary", href: "/" },
  { icon: BarChart3, label: "Sales", href: "/sales" },
  { icon: DollarSign, label: "Finance", href: "/finance" },
  { icon: Warehouse, label: "Inventory", href: "/inventory" },
  { icon: RotateCcw, label: "Returns", href: "/returns" },
  { icon: Target, label: "Campaign", href: "/campaign" },
  { icon: Users, label: "Demographics", href: "/demographics" },
  { icon: MapPin, label: "Geography", href: "/geography" },
  { icon: CalendarDays, label: "Seasonality", href: "/seasonality" },
  { icon: GitMerge, label: "Cohorts", href: "/cohorts" },
  { icon: Swords, label: "Competitor", href: "/competitor" },
  { icon: Activity, label: "System Status", href: "/system-status" },
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
  Seasonality: "Seasonal demand, peak periods, weekly patterns, and trend comparisons",
  "System Status": "MotherDuck, Amazon SP-API, Ads API, sync freshness, and endpoint health",
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
  const pathname = usePathname();
  const activeNav = getActiveNav(pathname);

  function handleRefresh() {
    setRefreshing(true);
    window.location.reload();
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
              <Link key={item.label} href={item.href} className={`commercial-nav-item ${isActive ? "active" : ""}`}>
                <item.icon size={17} />
                {!collapsed && <span>{item.label}</span>}
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
          <button className="commercial-collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse navigation">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="commercial-workspace">
        <header className="commercial-topbar">
          <div className="commercial-topbar-left">
            <button className="commercial-icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <Menu size={19} />
            </button>
            <div className="commercial-search">
              <Search size={16} />
              <input placeholder="Search SKU, ASIN, campaign, or report..." />
            </div>
          </div>

          <div className="commercial-topbar-actions">
            <button className="commercial-refresh-button" onClick={handleRefresh} aria-label="Refresh status">
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        <main className="commercial-main">
          <div className="commercial-page-header">
            <div>
              <div className="commercial-eyebrow">BioHuez Dashboard</div>
              <h1>{activeNav}</h1>
              <p>{pageSubtitles[activeNav] || ""}</p>
            </div>
            <div className="commercial-page-meta">
              <span className="commercial-status-dot" />
              <span>Live dashboard data</span>
            </div>
          </div>

          <Suspense fallback={null}>
            <DashboardFilters />
          </Suspense>

          <Suspense fallback={null}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
