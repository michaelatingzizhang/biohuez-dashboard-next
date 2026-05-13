"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type PillTone = "sage" | "gold" | "ruby" | "neutral" | "info"

const TONE: Record<PillTone, string> = {
  sage:    "bg-sage-700/10 text-sage-700 ring-sage-700/20",
  gold:    "bg-gold-500/12 text-gold-600 ring-gold-500/25",
  ruby:    "bg-[#D14343]/10 text-[#B33232] ring-[#D14343]/20",
  neutral: "bg-sage-500/10 text-sage-600 ring-sage-500/15",
  info:    "bg-sage-500/8 text-sage-700 ring-sage-500/15",
}

export function Pill({
  tone = "neutral",
  size = "md",
  icon: Icon,
  children,
  className,
  testId,
}: {
  tone?: PillTone
  size?: "sm" | "md"
  icon?: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
  className?: string
  testId?: string
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-1 text-[0.7rem]",
        TONE[tone],
        className,
      )}
    >
      {Icon ? <Icon size={size === "sm" ? 10 : 12} className="shrink-0" /> : null}
      {children}
    </span>
  )
}

/** Status dot with soft halo - useful for inline live indicators. */
export function StatusDot({ tone = "sage", className }: { tone?: PillTone; className?: string }) {
  const map: Record<PillTone, string> = {
    sage: "bg-sage-700",
    gold: "bg-gold-500",
    ruby: "bg-[#D14343]",
    neutral: "bg-sage-500",
    info: "bg-sage-500",
  }
  return (
    <span className={cn("relative inline-flex h-2 w-2 items-center justify-center", className)} aria-hidden>
      <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping", map[tone])} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", map[tone])} />
    </span>
  )
}
