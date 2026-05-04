import { execFileSync } from "child_process"
import { existsSync } from "fs"
import path from "path"

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_BUFFER_BYTES = 10 * 1024 * 1024

function resolveLegacyDashboardDir() {
  return process.env.BIOHUEZ_LEGACY_DASHBOARD_DIR ?? path.resolve(process.cwd(), "..", "biohuez-dashboard")
}

function resolvePythonBinary(legacyDashboardDir: string) {
  if (process.env.BIOHUEZ_PYTHON) return process.env.BIOHUEZ_PYTHON

  const localVenvPython = path.join(legacyDashboardDir, "venv", "bin", "python3")
  return existsSync(localVenvPython) ? localVenvPython : "python3"
}

export function runPythonJsonScript<T = unknown>(scriptName: string): T {
  const legacyDashboardDir = resolveLegacyDashboardDir()
  const python = resolvePythonBinary(legacyDashboardDir)
  const scriptPath = path.join(process.cwd(), "scripts", scriptName)

  const output = execFileSync(python, [scriptPath], {
    env: {
      ...process.env,
      BIOHUEZ_LEGACY_DASHBOARD_DIR: legacyDashboardDir,
    },
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: DEFAULT_BUFFER_BYTES,
  }).toString()

  return JSON.parse(output) as T
}
