import { execSync } from 'child_process'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const scriptPath = process.cwd() + '/scripts/get_summary.py'
    const python = '/Users/tingzizhang/biohuez-dashboard/venv/bin/python3'
    const output = execSync(`${python} ${scriptPath}`, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }).toString()
    const data = JSON.parse(output)
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Summary API error:', msg)
    return NextResponse.json({ error: msg, sales: [], inventory: [] }, { status: 200 })
  }
}
