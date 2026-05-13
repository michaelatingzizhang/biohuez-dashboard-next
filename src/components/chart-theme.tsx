"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Shared chart palette + Recharts theme primitives.
 * Use these in every Recharts component for visual consistency.
 */
export const CHART_PALETTE = [
  "#275719", // sage-700 (brand)
  "#AEA33C", // gold-500
  "#7B956D", // sage-400
  "#D4CBA3", // canvas-300 warm
  "#1A3B11", // sage-800
  "#E29547", // warm accent
  "#4A5D4E", // muted sage
  "#8B9E83", // dusty sage
]

export const SKU_PALETTE: Record<string, string> = {
  "Black": "#275719",
  "Chocolate": "#7B956D",
  "Cream Latte": "#AEA33C",
}

export const AXIS_TICK = {
  fill: "#6C7A68",
  fontSize: 11,
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
} as const

export const GRID_PROPS = {
  stroke: "#5A774C",
  strokeOpacity: 0.12,
  strokeDasharray: "3 4",
  vertical: false,
} as const

/** Premium glass tooltip used in all charts. */
export function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey?: string; payload?: Record<string, unknown> }>
  label?: string | number
  valueFormatter?: (v: number, name: string) => string
  labelFormatter?: (l: string | number | undefined) => string
}) {
  if (!active || !payload?.length) return null
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString())
  const labelText = labelFormatter ? labelFormatter(label) : (label ?? "")
  return (
    <div
      role="tooltip"
      className="pointer-events-none rounded-xl border border-sage-500/15 bg-white/95 px-3 py-2.5 shadow-elevated backdrop-blur-xl min-w-[140px] max-w-[280px]"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      {labelText ? (
        <div className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-sage-500/80">
          {labelText}
        </div>
      ) : null}
      <ul className="grid gap-1">
        {payload.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} aria-hidden />
              <span className="truncate text-sage-900/85 font-medium">{item.name}</span>
            </span>
            <span className="font-mono tabular-nums font-semibold text-sage-900">
              {fmt(Number(item.value), item.name)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Standard SVG <defs> for area/bar gradient fills used across all charts. */
export function ChartGradients({ colors = CHART_PALETTE, idPrefix = "g" }: { colors?: string[]; idPrefix?: string }) {
  return (
    <defs>
      {colors.map((c, i) => (
        <linearGradient key={`${idPrefix}-${i}`} id={`${idPrefix}-${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity={0.55} />
          <stop offset="95%" stopColor={c} stopOpacity={0.04} />
        </linearGradient>
      ))}
      {Object.entries(SKU_PALETTE).map(([sku, c], i) => (
        <linearGradient key={`sku-${i}`} id={`sku-${slug(sku)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity={0.55} />
          <stop offset="95%" stopColor={c} stopOpacity={0.05} />
        </linearGradient>
      ))}
    </defs>
  )
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

/** Custom legend marker (rounded square, more premium than default circle). */
export function ChartLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload?.length) return null
  return (
    <ul className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5 text-[0.7rem] font-medium text-sage-700/95">
      {payload.map(item => (
        <li key={item.value} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} aria-hidden />
          <span>{item.value}</span>
        </li>
      ))}
    </ul>
  )
}

/** Default money formatter for axis ticks (shorter form). */
export function fmtCompactCurrency(n: number) {
  if (n == null || isNaN(n)) return "—"
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toLocaleString("en-US", { maximumFractionDigits: 0 })}k`
  return `$${Math.round(n).toLocaleString("en-US")}`
}

export function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—"
  return "$" + Math.round(Number(n)).toLocaleString("en-US")
}

export function fmtCompact(n: number) {
  if (n == null || isNaN(n)) return "—"
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString("en-US", { maximumFractionDigits: 0 })}k`
  return Math.round(n).toLocaleString("en-US")
}

/**
 * Helpful Recharts axis-tick generator that always returns 4-5 evenly-spaced
 * "round" ticks regardless of data range — addresses the feedback to always
 * show 4 numbers on the vertical axis with auto-adjusted intervals.
 */
export function niceTicks(domainMin: number, domainMax: number, count = 4): number[] {
  if (!isFinite(domainMin) || !isFinite(domainMax) || domainMax <= domainMin) return []
  const range = domainMax - domainMin
  const rawStep = range / (count - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep) || 1)))
  const norm = rawStep / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const start = Math.floor(domainMin / step) * step
  const out: number[] = []
  for (let v = start; v <= domainMax + step / 2 && out.length < 8; v += step) out.push(Number(v.toFixed(6)))
  return out
}
