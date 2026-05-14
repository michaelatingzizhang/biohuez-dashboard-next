export interface SavedReportDeckSlide {
  id: string
  path: string
  pageLabel: string
  slideKey: string
  title: string
  summary: string
}

export interface SavedReportDeckPreset {
  name: string
  slides: SavedReportDeckSlide[]
  updatedAt: string
}

export const REPORT_DECK_STORAGE_KEY = "biohuez-report-deck"
export const REPORT_DECK_PRESETS_STORAGE_KEY = "biohuez-report-deck-presets"
export const REPORT_DECK_ACTIVE_PRESET_STORAGE_KEY = "biohuez-report-deck-active-preset"

export function readSavedReportDeck(): SavedReportDeckSlide[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(REPORT_DECK_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeSavedReportDeck(slides: SavedReportDeckSlide[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(REPORT_DECK_STORAGE_KEY, JSON.stringify(slides))
}

export function readSavedReportPresets(): SavedReportDeckPreset[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(REPORT_DECK_PRESETS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeSavedReportPresets(presets: SavedReportDeckPreset[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(REPORT_DECK_PRESETS_STORAGE_KEY, JSON.stringify(presets))
}

export function readActiveReportPresetName() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(REPORT_DECK_ACTIVE_PRESET_STORAGE_KEY) || ""
}

export function writeActiveReportPresetName(name: string) {
  if (typeof window === "undefined") return
  if (!name) {
    window.localStorage.removeItem(REPORT_DECK_ACTIVE_PRESET_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(REPORT_DECK_ACTIVE_PRESET_STORAGE_KEY, name)
}
