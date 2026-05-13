"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/** Reusable section header used across all dashboard pages. */
export function SectionHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  eyebrow?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative mt-7 mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="mb-1.5 inline-flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-sage-600/85">
            <span className="inline-block h-1 w-3 rounded-full bg-gradient-to-r from-sage-700 to-gold-500" />
            {eyebrow}
          </div>
        ) : null}
        <div className="text-base sm:text-[1.05rem] font-semibold text-sage-900 leading-tight tracking-tight">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-1 text-xs sm:text-[0.78rem] text-sage-500/90 leading-relaxed max-w-2xl">
            {subtitle}
          </div>
        ) : null}
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  )
}
