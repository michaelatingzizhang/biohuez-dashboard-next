import { execFile } from "child_process"
import { existsSync } from "fs"
import path from "path"
import { promisify } from "util"

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_BUFFER_BYTES = 10 * 1024 * 1024
const execFileAsync = promisify(execFile)

function resolveLegacyDashboardDir() {
  return process.env.BIOHUEZ_LEGACY_DASHBOARD_DIR ?? path.resolve(process.cwd(), "..", "biohuez-dashboard")
}

function resolvePythonBinary(legacyDashboardDir: string) {
  if (process.env.BIOHUEZ_PYTHON) return process.env.BIOHUEZ_PYTHON

  const localVenvPython = path.join(legacyDashboardDir, "venv", "bin", "python3")
  return existsSync(localVenvPython) ? localVenvPython : "python3"
}

export async function runPythonJsonScript<T = unknown>(scriptName: string): Promise<T> {
  const legacyDashboardDir = resolveLegacyDashboardDir()
  const python = resolvePythonBinary(legacyDashboardDir)
  const scriptPath = path.join(process.cwd(), "scripts", scriptName)

  const { stdout } = await execFileAsync(python, [scriptPath], {
    env: {
      ...process.env,
      BIOHUEZ_LEGACY_DASHBOARD_DIR: legacyDashboardDir,
    },
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: DEFAULT_BUFFER_BYTES,
  })

  return JSON.parse(stdout) as T
}
