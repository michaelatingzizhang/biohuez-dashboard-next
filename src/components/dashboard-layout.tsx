"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Users,
  Bell,
  Menu,
  X,
  Home,
  RefreshCw,
  Globe,
  RotateCcw,
  Target,
  GitMerge,
  Swords,
  Sun,
  Activity,
  DollarSign,
  Warehouse,
} from "lucide-react";

const navItems = [
  { icon: Home, label: "Summary", href: "/" },
  { icon: BarChart3, label: "Sales", href: "/sales" },
  { icon: DollarSign, label: "Finance", href: "/finance" },
  { icon: Globe, label: "Geography", href: "/geography" },
  { icon: RotateCcw, label: "Returns", href: "/returns" },
  { icon: Warehouse, label: "Inventory", href: "/inventory" },
  { icon: Users, label: "Demographics", href: "/demographics" },
  { icon: Target, label: "Campaign", href: "/campaign" },
  { icon: GitMerge, label: "Cohorts", href: "/cohorts" },
  { icon: Swords, label: "Competitor", href: "/competitor" },
  { icon: Sun, label: "Seasonality", href: "/seasonality" },
  { icon: Activity, label: "System Status", href: "/system-status" },
];

const pageSubtitles: Record<string, string> = {
  Summary: "Real-time analytics for your Amazon business",
  Sales: "Revenue, units, ASP, AOV, sessions, and conversion trends",
  Finance: "Profit & loss, fees, refunds, and margin analysis",
  Geography: "Sales by state, city, and zip code",
  Returns: "Return rates, reasons, and refund trends",
  Inventory: "Stock levels, aging, coverage, and where units sit across FCs",
  Demographics: "Buyer age, gender, income, and repeat purchase analysis",
  Campaign: "Ad campaign performance, ACOS, ROAS, and spend",
  Cohorts: "Customer cohort retention and LTV analysis",
  Competitor: "Market share, pricing, and keyword competition",
  Seasonality: "Seasonal trends, holiday spikes, and demand forecasting",
  "System Status": "Data pipeline health, sync status, and API connectivity",
};

const TIME_RANGES = ['7D', '5W', '10W', '26W', 'All'] as const
type TimeRange = typeof TIME_RANGES[number]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedRange, setSelectedRange] = useState<TimeRange>('All');
  const [dataLastUpdated, setDataLastUpdated] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem('biohuez_range') as TimeRange | null;
    if (saved && TIME_RANGES.includes(saved)) {
      setSelectedRange(saved);
    }
  }, []);

  useEffect(() => {
    fetch("/api/system-status")
      .then((response) => response.json())
      .then((data) => {
        const latest = data?.last_updated || data?.tables
          ?.map((table: { last_updated?: string | null }) => table.last_updated)
          .filter(Boolean)
          .sort()
          .reverse()?.[0]
        setDataLastUpdated(latest ? String(latest).slice(0, 10) : null)
      })
      .catch(() => setDataLastUpdated(null))
  }, []);

  const handleRangeSelect = (range: TimeRange) => {
    setSelectedRange(range);
    localStorage.setItem('biohuez_range', range);
  };

  const getActiveNav = () => {
    if (pathname === "/") return "Summary";
    if (pathname === "/sales") return "Sales";
    if (pathname === "/finance") return "Finance";
    if (pathname === "/geography") return "Geography";
    if (pathname === "/returns") return "Returns";
    if (pathname === "/inventory") return "Inventory";
    if (pathname === "/demographics") return "Demographics";
    if (pathname === "/campaign") return "Campaign";
    if (pathname === "/cohorts") return "Cohorts";
    if (pathname === "/competitor") return "Competitor";
    if (pathname === "/seasonality") return "Seasonality";
    if (pathname === "/system-status") return "System Status";
    return "Summary";
  };

  const activeNav = getActiveNav();

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F5", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid #E5E5E5", background: "white",
        padding: "0 24px", height: 56, display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#555" }}
            className="lg:hidden"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              height: 32, width: 32, borderRadius: 8,
              background: "#2D4A27", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <BarChart3 size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.2 }}>BioHuez Dashboard</div>
              <div style={{ fontSize: "0.72rem", color: "#888" }}>Amazon Analytics Platform</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 6, borderRadius: 8, color: "#555",
            display: "flex", alignItems: "center",
          }}>
            <Bell size={20} />
          </button>
          <div style={{
            height: 32, width: 32, borderRadius: "50%",
            background: "#E8EDE7", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.75rem", fontWeight: 600, color: "#2D4A27",
          }}>
            TZ
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <aside style={{
          width: 220, minWidth: 220,
          background: "white",
          borderRight: "1px solid #E5E5E5",
          display: sidebarOpen ? "flex" : "none",
          flexDirection: "column",
          position: "sticky",
          top: 56,
          height: "calc(100vh - 56px)",
          overflowY: "auto",
        }}>
          <nav style={{ padding: "12px 8px", flex: 1 }}>
            {navItems.map((item) => {
              const isActive = activeNav === item.label;
              return (
                <Link key={item.label} href={item.href} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 8, marginBottom: 2,
                    cursor: "pointer", fontSize: "0.85rem", fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#2D4A27" : "#444",
                    background: isActive ? "#F0F4EF" : "transparent",
                    borderLeft: isActive ? "3px solid #2D4A27" : "3px solid transparent",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#F9F9F9"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Time Range Filter */}
          <div style={{ borderTop: "1px solid #EBEBEB", padding: "10px 8px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#555", marginBottom: 6, paddingLeft: 4 }}>Time Range</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {TIME_RANGES.map(range => (
                <button
                  key={range}
                  onClick={() => handleRangeSelect(range)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: selectedRange === range ? 600 : 400,
                    background: selectedRange === range ? "#2D4A27" : "#F0F0F0",
                    color: selectedRange === range ? "white" : "#444",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #EBEBEB", padding: 12 }}>
            <div style={{
              background: "#F9FBF8", borderRadius: 8, padding: "10px 12px",
              border: "1px solid #E8EDE7",
            }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#555", marginBottom: 2 }}>Data last updated</div>
              <div style={{ fontSize: "0.75rem", color: "#888" }}>{dataLastUpdated ?? "Checking..."}</div>
              <button style={{
                marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, fontSize: "0.75rem", fontWeight: 500, color: "#2D4A27",
                background: "#E8EDE7", border: "none", borderRadius: 6, padding: "5px 0", cursor: "pointer",
              }}>
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, padding: 24, minWidth: 0 }}>
          {/* Page Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1A1A1A" }}>{activeNav}</div>
            <div style={{ fontSize: "0.82rem", color: "#888", marginTop: 2 }}>
              {pageSubtitles[activeNav] || ""}
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
