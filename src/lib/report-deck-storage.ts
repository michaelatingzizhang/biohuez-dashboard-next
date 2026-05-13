export interface SavedReportDeckSlide {
  id: string
  path: string
  pageLabel: string
  slideKey: string
  title: string
  summary: string
}

export const REPORT_DECK_STORAGE_KEY = "biohuez-report-deck"

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
