"use client"

import * as React from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export type StatusTone = "normal" | "alert" | "warn" | "info" | "gold"

const TONE_ACCENT: Record<StatusTone, { bar: string; ring: string; text: string }> = {
  normal: { bar: "from-sage-700 to-sage-500", ring: "ring-sage-700/15", text: "text-sage-700" },
  warn:   { bar: "from-gold-500 to-gold-400", ring: "ring-gold-500/20", text: "text-gold-600" },
  alert:  { bar: "from-[#D14343] to-[#E07474]", ring: "ring-[#D14343]/20", text: "text-[#B33232]" },
  info:   { bar: "from-sage-500 to-sage-400", ring: "ring-sage-500/15", text: "text-sage-600" },
  gold:   { bar: "from-gold-500 to-gold-400", ring: "ring-gold-500/20", text: "text-gold-600" },
}

/**
 * Premium top-line metric card.
 * - eyebrow label + value + sublabel
 * - optional delta (% with arrow + tone)
 * - optional sparkline (recharts mini line)
 * - left accent bar tied to tone
 * - hover lift, crisp shadow, glass surface
 */
export interface MetricCardProps {
  label: string
  value: React.ReactNode
  sublabel?: React.ReactNode
  status?: StatusTone
  delta?: number | null
  deltaLabel?: string
  trend?: number[]
  invertDelta?: boolean
  icon?: React.ComponentType<{ size?: number; className?: string }>
  testId?: string
  className?: string
}

function pickDeltaTone(delta: number, invertDelta: boolean): "up" | "down" | "flat" {
  if (Math.abs(delta) < 0.05) return "flat"
  const positive = invertDelta ? delta < 0 : delta > 0
  return positive ? "up" : "down"
}

export function MetricCard({
  label,
  value,
  sublabel,
  status = "normal",
  delta = null,
  deltaLabel,
  trend,
  invertDelta = false,
  icon: Icon,
  testId,
  className,
}: MetricCardProps) {
  const tone = TONE_ACCENT[status]
  const deltaTone = delta != null ? pickDeltaTone(delta, invertDelta) : null
  const DeltaIcon = deltaTone === "up" ? ArrowUpRight : deltaTone === "down" ? ArrowDownRight : Minus
  const deltaColor =
    deltaTone === "up" ? "bg-sage-700/10 text-sage-700 ring-sage-700/15"
    : deltaTone === "down" ? "bg-[#D14343]/10 text-[#B33232] ring-[#D14343]/20"
    : "bg-sage-500/8 text-sage-500 ring-sage-500/15"

  return (
    <div
      data-testid={testId}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-sage-500/10 bg-white/85 backdrop-blur-xl",
        "shadow-crisp transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-elevated hover:border-sage-500/20",
        "p-4 sm:p-5",
        className,
      )}
    >
      {/* left accent gradient */}
      <span className={cn("pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-gradient-to-b", tone.bar)} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-sage-500/85">
          {label}
        </span>
        {Icon ? (
          <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg ring-1", "bg-sage-500/8", tone.ring, tone.text)}>
            <Icon size={14} />
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <div className="font-mono text-[1.7rem] sm:text-[1.85rem] font-semibold leading-none tracking-tight text-sage-900 tabular-nums">
          {value}
        </div>
        {delta != null ? (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ring-1 tabular-nums", deltaColor)}>
            <DeltaIcon size={11} className="shrink-0" />
            {deltaTone === "flat" ? "0.0%" : `${Math.abs(delta).toFixed(1)}%`}
          </span>
        ) : null}
      </div>

      {sublabel ? (
        <div className="mt-1.5 text-xs leading-snug text-sage-500/95">
          {sublabel}
          {deltaLabel && delta != null ? <span className="text-sage-500/70"> · {deltaLabel}</span> : null}
        </div>
      ) : null}

      {trend && trend.length > 1 ? <Sparkline data={trend} tone={status} /> : null}
    </div>
  )
}

/** Minimal SVG sparkline — no recharts overhead. */
function Sparkline({ data, tone }: { data: number[]; tone: StatusTone }) {
  const w = 120, h = 28
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const stepX = w / (data.length - 1)
  const points = data.map((v, i) => `${(i * stepX).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`).join(" ")
  const stroke = TONE_ACCENT[tone].bar.includes("D14343") ? "#D14343"
              : TONE_ACCENT[tone].bar.includes("gold") ? "#AEA33C"
              : "#275719"
  const id = React.useId().replace(/:/g, "")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full h-8 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#spark-${id})`}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
