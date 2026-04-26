import { execSync } from 'child_process'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const python = '/Users/tingzizhang/biohuez-dashboard/venv/bin/python3'
    const script = process.cwd() + '/scripts/get_returns.py'
    const out = execSync(`${python} ${script}`, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }).toString()
    return NextResponse.json(JSON.parse(out))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 200 })
  }
}
