import { NextResponse } from 'next/server'
import { runPythonJsonScript } from '@/lib/python-runner'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(runPythonJsonScript('get_summary.py'))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Summary API error:', msg)
    return NextResponse.json({ error: msg, sales: [], inventory: [] }, { status: 200 })
  }
}
