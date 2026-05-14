"use client"

import { type CSSProperties, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { REPORT_PRIORITY_PAGES, buildCustomModuleSlideKey, buildGlobalReportSlideId, isCustomModuleSlideKey } from "@/lib/report-library"
import { readChartStudioModules } from "@/components/sales-chart-studio"
import {
  type SavedReportDeckPreset,
  type SavedReportDeckSlide,
  readActiveReportPresetName,
  readSavedReportDeck,
  readSavedReportPresets,
  writeActiveReportPresetName,
  writeSavedReportDeck,
  writeSavedReportPresets,
} from "@/lib/report-deck-storage"

const CUSTOM_STUDIO_PAGES = [
  { path: "/sales", label: "Sales", storageKey: "biohuez:sales-custom-chart-modules" },
  { path: "/finance", label: "Finance", storageKey: "biohuez:finance-custom-chart-modules" },
  { path: "/inventory", label: "Inventory", storageKey: "biohuez:inventory-custom-chart-modules" },
  { path: "/returns", label: "Returns", storageKey: "biohuez:returns-custom-chart-modules" },
  { path: "/campaign", label: "Campaign", storageKey: "biohuez:campaign-custom-chart-modules" },
] as const

export default function ReportBuilderPage() {
  const router = useRouter()
  const [selectedSlides, setSelectedSlides] = useState<SavedReportDeckSlide[]>([])
  const [libraryPages, setLibraryPages] = useState(REPORT_PRIORITY_PAGES)
  const [presets, setPresets] = useState<SavedReportDeckPreset[]>([])
  const [presetName, setPresetName] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSelectedSlides(readSavedReportDeck())
    setPresets(readSavedReportPresets())
    setPresetName(readActiveReportPresetName())
    setLibraryPages(
      REPORT_PRIORITY_PAGES.map((page) => {
        const customConfig = CUSTOM_STUDIO_PAGES.find((item) => item.path === page.path)
        if (!customConfig) return page
        const customSlides = readChartStudioModules(customConfig.storageKey).map((module) => ({
          key: buildCustomModuleSlideKey(module.id),
          title: module.title,
          summary: "Saved custom chart module.",
        }))
        return {
          ...page,
          slides: [...page.slides, ...customSlides],
        }
      }),
    )
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
    writeActiveReportPresetName("")
    window.localStorage.setItem("biohuez-report-mode", "true")
    setSaved(true)
  }

  function savePreset() {
    const normalizedName = presetName.trim()
    if (!normalizedName || !selectedSlides.length) return
    const nextPreset: SavedReportDeckPreset = {
      name: normalizedName,
      slides: selectedSlides,
      updatedAt: new Date().toISOString(),
    }
    const nextPresets = [
      nextPreset,
      ...presets.filter((preset) => preset.name !== normalizedName),
    ]
    setPresets(nextPresets)
    writeSavedReportPresets(nextPresets)
    writeSavedReportDeck(selectedSlides)
    writeActiveReportPresetName(normalizedName)
    setSaved(true)
  }

  function loadPreset(name: string) {
    const preset = presets.find((item) => item.name === name)
    if (!preset) return
    setSaved(false)
    setPresetName(preset.name)
    setSelectedSlides(preset.slides)
    writeSavedReportDeck(preset.slides)
    writeActiveReportPresetName(preset.name)
  }

  function presentPreset(name: string) {
    const preset = presets.find((item) => item.name === name)
    if (!preset || !preset.slides.length) return
    setPresetName(preset.name)
    setSelectedSlides(preset.slides)
    writeSavedReportDeck(preset.slides)
    writeActiveReportPresetName(preset.name)
    window.localStorage.setItem("biohuez-report-mode", "true")
    const first = preset.slides[0]
    router.push(`${first.path}?reportDeck=custom&reportSlide=${first.slideKey}`)
  }

  function deletePreset(name: string) {
    const nextPresets = presets.filter((preset) => preset.name !== name)
    setPresets(nextPresets)
    writeSavedReportPresets(nextPresets)
    if (presetName === name) {
      setPresetName("")
      writeActiveReportPresetName("")
    }
  }

  function clearDeck() {
    setSaved(false)
    setSelectedSlides([])
    writeSavedReportDeck([])
    writeActiveReportPresetName("")
  }

  function openDeck() {
    if (!selectedSlides.length) return
    writeSavedReportDeck(selectedSlides)
    writeActiveReportPresetName(presetName.trim())
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
          {libraryPages.map((page) => (
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#17201B" }}>{slide.title}</div>
                          {isCustomModuleSlideKey(slide.key) ? <span style={customChipStyle}>Custom</span> : null}
                        </div>
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

            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Preset name"
                style={textInputStyle}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button type="button" onClick={saveDeck} style={primaryButtonStyle}>
                  Save Deck
                </button>
                <button type="button" onClick={savePreset} disabled={!selectedSlides.length || !presetName.trim()} style={{ ...secondaryButtonStyle, opacity: selectedSlides.length && presetName.trim() ? 1 : 0.45 }}>
                  Save Preset
                </button>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                          <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#17201B" }}>{slide.title}</div>
                          {isCustomModuleSlideKey(slide.slideKey) ? <span style={customChipStyle}>Custom</span> : null}
                        </div>
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
              <button type="button" onClick={openDeck} disabled={!selectedSlides.length} style={{ ...primaryButtonStyle, opacity: selectedSlides.length ? 1 : 0.45 }}>
                Open Big Report
              </button>
              <button type="button" onClick={clearDeck} style={secondaryButtonStyle}>
                Clear Selection
              </button>
              {saved ? <div style={{ fontSize: "0.76rem", color: "#2D6F39", fontWeight: 700 }}>Saved to this browser.</div> : null}
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              <div style={{ fontSize: "0.72rem", color: "#738071", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Presets
              </div>
              {presets.length === 0 ? (
                <div style={{ border: "1px dashed #D7DDD4", borderRadius: 10, padding: 12, color: "#7B847B", fontSize: "0.78rem", lineHeight: 1.4 }}>
                  Save a named preset to reuse different reporting decks.
                </div>
              ) : (
                presets.map((preset) => (
                  <div key={preset.name} style={{ border: "1px solid #E8ECE7", borderRadius: 10, padding: 12, background: preset.name === presetName ? "#F7FAF5" : "#FCFCFA" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#17201B" }}>{preset.name}</div>
                        <div style={{ fontSize: "0.74rem", color: "#6E786F", marginTop: 4 }}>
                          {preset.slides.length} slides · updated {new Date(preset.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button type="button" onClick={() => deletePreset(preset.name)} aria-label={`Delete ${preset.name}`} style={iconButtonStyle}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      <button type="button" onClick={() => loadPreset(preset.name)} style={secondaryButtonStyle}>
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => presentPreset(preset.name)}
                        style={primaryButtonStyle}
                      >
                        Present
                      </button>
                    </div>
                  </div>
                ))
              )}
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

const textInputStyle: CSSProperties = {
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid rgba(34, 44, 38, 0.12)",
  background: "white",
  color: "#17201B",
  fontSize: "0.78rem",
  padding: "0 12px",
}

const customChipStyle: CSSProperties = {
  minHeight: 20,
  borderRadius: 999,
  border: "1px solid rgba(41, 128, 185, 0.24)",
  background: "#EAF3FB",
  color: "#20638E",
  fontSize: "0.66rem",
  fontWeight: 800,
  padding: "0 8px",
  display: "inline-flex",
  alignItems: "center",
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
