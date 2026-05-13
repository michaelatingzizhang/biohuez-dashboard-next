"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Premium chart container.
 * - title + subtitle + optional eyebrow + action slot (e.g. tabs, toggle)
 * - glass surface, ambient shadow, subtle border
 * - responsive padding, generous whitespace
 */
export interface ChartCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  eyebrow?: React.ReactNode
  action?: React.ReactNode
  footer?: React.ReactNode
  height?: number | string
  testId?: string
}

export function ChartCard({
  title,
  subtitle,
  eyebrow,
  action,
  footer,
  height,
  className,
  children,
  testId,
  ...props
}: ChartCardProps) {
  return (
    <section
      data-testid={testId}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-sage-500/10 bg-white/90 backdrop-blur-xl",
        "shadow-crisp transition-all duration-300 ease-out hover:shadow-elevated",
        "p-5 sm:p-6",
        className,
      )}
      {...props}
    >
      {(title || action || eyebrow || subtitle) && (
        <header className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div className="mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-sage-600/85">
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h3 className="text-base font-semibold text-sage-900 leading-tight tracking-tight">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-xs leading-relaxed text-sage-500/90">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="flex-shrink-0">{action}</div> : null}
        </header>
      )}
      <div style={height ? { height } : undefined} className="relative">
        {children}
      </div>
      {footer ? (
        <footer className="mt-4 pt-3 border-t border-sage-500/10 text-xs text-sage-500/85">
          {footer}
        </footer>
      ) : null}
    </section>
  )
}
