import { NextResponse } from "next/server"
import { runPythonJsonScript } from "@/lib/python-runner"

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

export async function dashboardApiResponse<T = unknown>(
  scriptName: string,
  fallback: Record<string, unknown> = {},
) {
  try {
    return NextResponse.json(await fetchFromBackend<T>(scriptName))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`${scriptName} API error:`, msg)
    return NextResponse.json({ error: msg, ...fallback }, { status: 200 })
  }
}
