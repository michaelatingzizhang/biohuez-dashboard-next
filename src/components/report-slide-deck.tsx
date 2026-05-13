"use client"

import Image from "next/image"
import Link from "next/link"
import * as React from "react"
import { ChevronLeft, ChevronRight, Grid3x3, LayoutTemplate, Maximize2, PanelsTopLeft, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SlideMeta {
  title: string
  summary: string
  order: number
  el: HTMLElement
}

/**
 * Drives container-level slide mode. When `reportMode` is true,
 * scans the page for [data-report-slide] elements and shows one at a time.
 * Returns the controller used by the topbar to render slide nav.
 */
export function useReportSlideDeck(reportMode: boolean, pathname: string) {
  const [slides, setSlides] = React.useState<SlideMeta[]>([])
  const [index, setIndex] = React.useState(0)
  const [view, setView] = React.useState<"slide" | "sorter">("slide")

  // Re-scan on report-mode toggle / pathname change. Use MutationObserver
  // to catch async hydration so first-render slides are picked up.
  React.useEffect(() => {
    if (!reportMode) {
      setSlides([])
      setIndex(0)
      return
    }
    let timer: number | undefined
    function rescan() {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-report-slide]"))
      const next: SlideMeta[] = els.map((el) => ({
        title: el.dataset.slideTitle || "Untitled",
        summary: el.dataset.slideSummary || "",
        order: Number(el.dataset.slideOrder) || 0,
        el,
      }))
      next.sort((a, b) => a.order - b.order)
      setSlides(next)
    }
    rescan()
    timer = window.setInterval(rescan, 600)
    const stop = window.setTimeout(() => {
      if (timer) window.clearInterval(timer)
    }, 4000)
    return () => {
      if (timer) window.clearInterval(timer)
      window.clearTimeout(stop)
    }
  }, [reportMode, pathname])

  // Reset index whenever route changes
  React.useEffect(() => {
    setIndex(0)
  }, [pathname])

  // Apply DOM classes whenever active index or slides change
  React.useEffect(() => {
    if (!reportMode || view !== "slide") {
      document.body.classList.remove("is-report-slide")
      slides.forEach((s) => {
        s.el.classList.remove("is-active-slide")
        s.el.classList.remove("is-hidden-slide")
      })
      return
    }
    document.body.classList.add("is-report-slide")
    slides.forEach((s, i) => {
      s.el.classList.toggle("is-active-slide", i === index)
      s.el.classList.toggle("is-hidden-slide", i !== index)
    })
    // scroll to top so the active slide is centered
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [reportMode, view, slides, index])

  // Keyboard navigation in slide mode
  React.useEffect(() => {
    if (!reportMode || view !== "slide") return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        setIndex((v) => (slides.length ? Math.min(v + 1, slides.length - 1) : 0))
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setIndex((v) => Math.max(v - 1, 0))
      } else if (e.key === "Home") {
        setIndex(0)
      } else if (e.key === "End") {
        setIndex(Math.max(0, slides.length - 1))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [reportMode, view, slides.length])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      document.body.classList.remove("is-report-slide")
      document.querySelectorAll<HTMLElement>("[data-report-slide]").forEach((el) => {
        el.classList.remove("is-active-slide", "is-hidden-slide")
      })
    }
  }, [])

  return {
    slides, index, setIndex, view, setView,
    next: () => setIndex((v) => (slides.length ? Math.min(v + 1, slides.length - 1) : 0)),
    prev: () => setIndex((v) => Math.max(v - 1, 0)),
  }
}

export function ReportSlideSidebar({
  controller,
  pageTitle,
  pageSubtitle,
  onExit,
}: {
  controller: ReturnType<typeof useReportSlideDeck>
  pageTitle: string
  pageSubtitle?: string
  onExit: () => void
}) {
  const { slides, index, setIndex, view, setView, prev, next } = controller
  const current = slides[index]

  return (
    <>
      <div className="commercial-report-sidebar-brand">
        <Link href="/" className="commercial-brand-link" data-testid="report-brand-home">
          <Image
            src="/biohuez-logo.png"
            alt="BioHuez"
            width={156}
            height={50}
            className="commercial-brand-logo"
            priority
          />
        </Link>
        <button className="commercial-report-exit" onClick={onExit} data-testid="report-mode-exit">
          <X size={13} />
          Exit
        </button>
      </div>

      <div className="commercial-report-sidebar-title">
        <span>Presentation Mode</span>
        <strong>{pageTitle}</strong>
        {pageSubtitle ? <p>{pageSubtitle}</p> : null}
      </div>

      <div className="commercial-report-view-toggle">
        <button
          type="button"
          className={cn(view === "slide" && "active")}
          onClick={() => setView("slide")}
          data-testid="report-slide-view"
        >
          <PanelsTopLeft size={13} />
          Slides
        </button>
        <button
          type="button"
          className={cn(view === "sorter" && "active")}
          onClick={() => setView("sorter")}
          data-testid="report-sorter-view"
        >
          <LayoutTemplate size={13} />
          Sorter
        </button>
      </div>

      <div className="commercial-report-sidebar-status">
        <span>{slides.length ? `Slide ${index + 1} of ${slides.length}` : "No slides yet"}</span>
        <strong title={current?.title}>{current?.title || "Wrap sections in ReportSlide"}</strong>
      </div>

      <nav className="commercial-report-slide-nav" aria-label="Report slides">
        {slides.length ? (
          slides.map((slide, slideIndex) => (
            <button
              key={`${slide.title}-${slide.order}-${slideIndex}`}
              type="button"
              className={cn("commercial-report-slide-link", slideIndex === index && "active")}
              onClick={() => {
                setIndex(slideIndex)
                setView("slide")
              }}
              data-testid={`report-slide-link-${slideIndex + 1}`}
            >
              <span>{slideIndex + 1}</span>
              <div className="commercial-report-slide-thumb" aria-hidden="true">
                <div className="commercial-report-slide-thumb-top" />
                <div className="commercial-report-slide-thumb-main" />
                <div className="commercial-report-slide-thumb-notes" />
              </div>
              <div>
                <strong>{slide.title}</strong>
                <small>{slide.summary || "Presentation-ready container slide."}</small>
              </div>
            </button>
          ))
        ) : (
          <div className="commercial-report-empty-state">
            <Maximize2 size={18} />
            <strong>No report containers detected</strong>
            <p>This page still needs sections wrapped in ReportSlide.</p>
          </div>
        )}
      </nav>

      <div className="commercial-report-sidebar-footer">
        <button
          type="button"
          className="commercial-report-step"
          onClick={prev}
          disabled={index === 0}
          data-testid="report-slide-prev"
        >
          <ChevronLeft size={15} />
          Previous
        </button>
        <button
          type="button"
          className="commercial-report-step"
          onClick={next}
          disabled={!slides.length || index === slides.length - 1}
          data-testid="report-slide-next"
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>
    </>
  )
}

/** Topbar slide deck navigation (prev/next + counter + view toggle). */
export function ReportSlideNav({
  controller,
  onExit,
}: {
  controller: ReturnType<typeof useReportSlideDeck>
  onExit: () => void
}) {
  const { slides, index, view, setView, prev, next } = controller
  const current = slides[index]
  return (
    <div className="report-slide-nav" data-testid="report-slide-nav">
      <button
        className={cn("report-slide-nav-pill", view === "sorter" && "is-active")}
        onClick={() => setView(view === "sorter" ? "slide" : "sorter")}
        title="Toggle sorter view"
        data-testid="report-slide-sorter-toggle"
      >
        <Grid3x3 size={13} />
        {view === "sorter" ? "Slide view" : "Sorter"}
      </button>

      <div className="report-slide-nav-step" aria-live="polite">
        <span className="report-slide-counter">
          <strong>{slides.length ? index + 1 : 0}</strong>
          <span> / {slides.length}</span>
        </span>
        <span className="report-slide-title-pill" title={current?.title}>
          {current?.title || "—"}
        </span>
      </div>

      <button
        className="report-slide-nav-icon"
        onClick={prev}
        disabled={index === 0}
        aria-label="Previous slide"
        data-testid="report-slide-prev"
      >
        <ChevronLeft size={15} />
      </button>
      <button
        className="report-slide-nav-icon"
        onClick={next}
        disabled={!slides.length || index === slides.length - 1}
        aria-label="Next slide"
        data-testid="report-slide-next"
      >
        <ChevronRight size={15} />
      </button>

      <button
        className="report-slide-nav-pill is-exit"
        onClick={onExit}
        title="Exit report mode"
        data-testid="report-mode-exit"
      >
        <X size={13} />
        Exit
      </button>
    </div>
  )
}

/** Slide sorter — thumbnail grid of every container slide on the current page. */
export function ReportSlideSorter({
  controller,
}: {
  controller: ReturnType<typeof useReportSlideDeck>
}) {
  const { slides, index, setIndex, setView } = controller
  if (!slides.length) {
    return (
      <div className="report-sorter-empty">
        <Maximize2 size={24} />
        <strong>No containers detected on this page</strong>
        <p>This page has not yet defined any report slides.</p>
      </div>
    )
  }
  return (
    <div className="report-sorter">
      <header className="report-sorter-heading">
        <div>
          <span>Brand Report · Slide Sorter</span>
          <strong>{slides.length} container slides</strong>
        </div>
        <p>Click any tile to jump in. Use ← → or Page-Down to step through slides.</p>
      </header>
      <div className="report-sorter-grid">
        {slides.map((s, i) => (
          <button
            key={`${s.title}-${i}`}
            className={cn("report-sorter-card", i === index && "is-active")}
            onClick={() => { setIndex(i); setView("slide") }}
            data-testid={`report-sorter-tile-${i + 1}`}
          >
            <span className="report-sorter-card-num">{i + 1}</span>
            <strong>{s.title}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}
