import { NextResponse } from "next/server"
import { runPythonJsonScript } from "@/lib/python-runner"

const DEFAULT_CACHE_TTL_MS = Number(process.env.BIOHUEZ_API_CACHE_TTL_MS || 5 * 60 * 1000)

const SCRIPT_ENDPOINTS: Record<string, string> = {
  "get_summary.py": "summary",
  "get_sales.py": "sales",
  "get_finance.py": "finance",
  "get_returns.py": "returns",
  "get_inventory.py": "inventory",
  "get_campaign.py": "campaign",
  "get_demographics.py": "demographics",
  "get_geography.py": "geography",
  "get_competitor.py": "competitor",
  "get_seasonality.py": "seasonality",
  "get_cohorts.py": "cohorts",
  "get_system_status.py": "system-status",
  "get_executive_insights.py": "executive-insights",
}

type CacheEntry<T> = {
  expiresAt: number
  value?: T
  pending?: Promise<T>
}

const responseCache = new Map<string, CacheEntry<unknown>>()

async function fetchFromBackend<T>(scriptName: string): Promise<T> {
  const baseUrl = process.env.BIOHUEZ_API_BASE_URL?.replace(/\/$/, "")
  if (!baseUrl) return runPythonJsonScript<T>(scriptName)

  const endpoint = SCRIPT_ENDPOINTS[scriptName]
  if (!endpoint) throw new Error(`No API endpoint mapped for ${scriptName}`)
  const apiKey = process.env.BIOHUEZ_API_KEY

  const response = await fetch(`${baseUrl}/${endpoint}`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(apiKey ? { "x-biohuez-api-key": apiKey } : {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Backend ${endpoint} failed with ${response.status}: ${body}`)
  }

  return response.json() as Promise<T>
}

async function getCachedBackendData<T>(scriptName: string): Promise<T> {
  const key = `${process.env.BIOHUEZ_API_BASE_URL || "local"}:${scriptName}`
  const now = Date.now()
  const cached = responseCache.get(key) as CacheEntry<T> | undefined

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value
  }

  if (cached?.pending) {
    return cached.pending
  }

  const pending = fetchFromBackend<T>(scriptName)
    .then(value => {
      responseCache.set(key, { value, expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS })
      return value
    })
    .catch(error => {
      responseCache.delete(key)
      throw error
    })

  responseCache.set(key, { pending, expiresAt: now + DEFAULT_CACHE_TTL_MS })
  return pending
}

export async function dashboardApiResponse<T = unknown>(
  scriptName: string,
  fallback: Record<string, unknown> = {},
) {
  try {
    return NextResponse.json(await getCachedBackendData<T>(scriptName))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`${scriptName} API error:`, msg)
    return NextResponse.json({ error: msg, ...fallback }, { status: 200 })
  }
}
