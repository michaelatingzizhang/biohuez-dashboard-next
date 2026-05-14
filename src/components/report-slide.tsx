"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { buildReportSlideKey } from "@/lib/report-library"

/**
 * Wraps a single visual container so it can be treated as one slide
 * when the dashboard is in report mode. Each <ReportSlide> is auto-detected
 * via its `data-report-slide` attribute and shown one-at-a-time.
 */
export interface ReportSlideProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  slideKey?: string
  /** Short narrative shown only in report mode below the slide content. */
  message?: string
  /** Optional rich annotation shown only in report mode. */
  watch?: string
  /** Optional CTA action shown only in report mode. */
  action?: string
  /** Optional sort order for the slide deck. Lower values render first. */
  order?: number
}

export function ReportSlide({
  title,
  slideKey,
  message,
  watch,
  action,
  order,
  className,
  children,
  ...props
}: ReportSlideProps) {
  return (
    <section
      data-report-slide=""
      data-slide-key={slideKey || buildReportSlideKey(title)}
      data-slide-title={title}
      data-slide-order={order ?? ""}
      data-slide-summary={message || watch || action || ""}
      className={cn("report-slide", className)}
      {...props}
    >
      <header className="report-slide-header" aria-hidden="true">
        <span>Presentation Slide</span>
        <strong>{title}</strong>
        {(message || watch) ? <p>{message || watch}</p> : null}
      </header>
      <div className="report-slide-content">{children}</div>
      {(message || watch || action) ? (
        <aside className="report-slide-narrative" aria-label={`Slide narrative for ${title}`}>
          {message ? <div><span>Key Message</span><strong>{message}</strong></div> : null}
          {watch ? <div><span>Watch</span><strong>{watch}</strong></div> : null}
          {action ? <div><span>Action</span><strong>{action}</strong></div> : null}
        </aside>
      ) : null}
    </section>
  )
}
