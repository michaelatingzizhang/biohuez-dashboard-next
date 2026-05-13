"use client"

import { type CSSProperties, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { REPORT_PRIORITY_PAGES, buildGlobalReportSlideId } from "@/lib/report-library"
import {
  type SavedReportDeckSlide,
  readSavedReportDeck,
  writeSavedReportDeck,
} from "@/lib/report-deck-storage"

export default function ReportBuilderPage() {
  const router = useRouter()
  const [selectedSlides, setSelectedSlides] = useState<SavedReportDeckSlide[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSelectedSlides(readSavedReportDeck())
  }, [])

  const selectedIds = useMemo(() => new Set(selectedSlides.map((slide) => slide.id)), [selectedSlides])

  function addSlide(slide: SavedReportDeckSlide) {
    setSaved(false)
    setSelectedSlides((current) => {
      if (current.some((item) => item.id === slide.id)) return current
      return [...current, slide]
    })
  }

  function removeSlide(id: string) {
    setSaved(false)
    setSelectedSlides((current) => current.filter((slide) => slide.id !== id))
  }

  function moveSlide(id: string, direction: -1 | 1) {
    setSaved(false)
    setSelectedSlides((current) => {
      const index = current.findIndex((slide) => slide.id === id)
      if (index < 0) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  function saveDeck() {
    writeSavedReportDeck(selectedSlides)
    window.localStorage.setItem("biohuez-report-mode", "true")
    setSaved(true)
  }

  function clearDeck() {
    setSaved(false)
    setSelectedSlides([])
    writeSavedReportDeck([])
  }

  function openDeck() {
    if (!selectedSlides.length) return
    writeSavedReportDeck(selectedSlides)
    window.localStorage.setItem("biohuez-report-mode", "true")
    const first = selectedSlides[0]
    router.push(`${first.path}?reportDeck=custom&reportSlide=${first.slideKey}`)
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4, color: "#1A1A1A" }}>Report Builder</h1>
      <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 20 }}>
        Choose slides from each page, arrange them into one executive report, then open the custom deck in report mode.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: 18 }}>
        <div style={{ display: "grid", gap: 16 }}>
          {REPORT_PRIORITY_PAGES.map((page) => (
            <section key={page.path} style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #E8ECE7" }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6D776D" }}>
                  {page.label}
                </div>
                <div style={{ color: "#7B847B", fontSize: "0.78rem", marginTop: 4 }}>{page.slides.length} available slides</div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {page.slides.map((slide) => {
                  const id = buildGlobalReportSlideId(page.path, slide.key)
                  const isSelected = selectedIds.has(id)
                  const payload: SavedReportDeckSlide = {
                    id,
                    path: page.path,
                    pageLabel: page.label,
                    slideKey: slide.key,
                    title: slide.title,
                    summary: slide.summary,
                  }
                  return (
                    <div key={id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: 12, border: "1px solid #E8ECE7", borderRadius: 10, background: isSelected ? "#F7FAF5" : "#FCFCFA" }}>
                      <div>
                        <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#17201B" }}>{slide.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6E786F", marginTop: 4, lineHeight: 1.45 }}>{slide.summary}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => (isSelected ? removeSlide(id) : addSlide(payload))}
                        style={{
                          minHeight: 34,
                          minWidth: 84,
                          borderRadius: 9,
                          border: "1px solid rgba(34, 44, 38, 0.12)",
                          background: isSelected ? "#FDECEA" : "#F4F7F2",
                          color: isSelected ? "#C0392B" : "#275719",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          padding: "0 12px",
                        }}
                      >
                        {isSelected ? "Remove" : "Add"}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <aside style={{ display: "grid", alignContent: "start", gap: 14 }}>
          <section style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #E8ECE7", position: "sticky", top: 18 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6D776D" }}>
                Selected Deck
              </div>
              <div style={{ color: "#7B847B", fontSize: "0.78rem", marginTop: 4 }}>
                {selectedSlides.length} slide{selectedSlides.length === 1 ? "" : "s"} chosen
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              {selectedSlides.length === 0 ? (
                <div style={{ border: "1px dashed #D7DDD4", borderRadius: 10, padding: 16, color: "#7B847B", fontSize: "0.8rem", lineHeight: 1.45 }}>
                  Add slides from the left to assemble a cross-page executive report.
                </div>
              ) : (
                selectedSlides.map((slide, index) => (
                  <div key={slide.id} style={{ border: "1px solid #E8ECE7", borderRadius: 10, padding: 12, background: "#FCFCFA" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#738071", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {index + 1}. {slide.pageLabel}
                        </div>
                        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#17201B", marginTop: 4 }}>{slide.title}</div>
                        <div style={{ fontSize: "0.74rem", color: "#6E786F", marginTop: 4, lineHeight: 1.4 }}>{slide.summary}</div>
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <button type="button" onClick={() => moveSlide(slide.id, -1)} aria-label="Move up" style={iconButtonStyle}>
                          <ChevronUp size={14} />
                        </button>
                        <button type="button" onClick={() => moveSlide(slide.id, 1)} aria-label="Move down" style={iconButtonStyle}>
                          <ChevronDown size={14} />
                        </button>
                        <button type="button" onClick={() => removeSlide(slide.id)} aria-label="Remove slide" style={iconButtonStyle}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <button type="button" onClick={saveDeck} style={primaryButtonStyle}>
                Save Deck
              </button>
              <button type="button" onClick={openDeck} disabled={!selectedSlides.length} style={{ ...primaryButtonStyle, opacity: selectedSlides.length ? 1 : 0.45 }}>
                Open Big Report
              </button>
              <button type="button" onClick={clearDeck} style={secondaryButtonStyle}>
                Clear Selection
              </button>
              {saved ? <div style={{ fontSize: "0.76rem", color: "#2D6F39", fontWeight: 700 }}>Saved to this browser.</div> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid rgba(34, 44, 38, 0.1)",
  background: "#275719",
  color: "white",
  fontSize: "0.78rem",
  fontWeight: 800,
  cursor: "pointer",
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "#F4F7F2",
  color: "#275719",
}

const iconButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid rgba(34, 44, 38, 0.1)",
  background: "#F7F8F4",
  color: "#506050",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
}
