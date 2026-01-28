#!/usr/bin/env node

const childProcess = require("child_process")
const fs = require("fs")
const path = require("path")
const os = require("os")

function run(target) {
  const result = childProcess.spawnSync(target, process.argv.slice(2), {
    stdio: "inherit",
  })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  const code = typeof result.status === "number" ? result.status : 0
  process.exit(code)
}

const envPath = process.env.SLMAPCODE_BIN_PATH
if (envPath) {
  run(envPath)
}

const scriptPath = fs.realpathSync(__filename)
const scriptDir = path.dirname(scriptPath)

const platformMap = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
}
const archMap = {
  x64: "x64",
  arm64: "arm64",
  arm: "arm",
}

let platform = platformMap[os.platform()]
if (!platform) {
  platform = os.platform()
}
let arch = archMap[os.arch()]
if (!arch) {
  arch = os.arch()
}
const base = "slmapcode-" + platform + "-" + arch
const binary = platform === "windows" ? "slmapcode.exe" : "slmapcode"

function findBinary(startDir) {
  let current = startDir
  for (;;) {
    const modules = path.join(current, "node_modules")
    if (fs.existsSync(modules)) {
      const entries = fs.readdirSync(modules)
      for (const entry of entries) {
        if (!entry.startsWith(base)) {
          continue
        }
        const candidate = path.join(modules, entry, "bin", binary)
        if (fs.existsSync(candidate)) {
          return candidate
        }
      }
    }
    const parent = path.dirname(current)
    if (parent === current) {
      return
    }
    current = parent
  }
}

const resolved = findBinary(scriptDir)
if (!resolved) {
  // Try development mode - look for src/index.ts
  const packageDir = path.join(scriptDir, "..")
  const devEntry = path.join(packageDir, "src", "index.ts")
  if (fs.existsSync(devEntry)) {
    // Try to find bun
    const bunPath = process.platform === "win32" ? "bun.exe" : "bun"
    const result = childProcess.spawnSync(
      bunPath,
      ["run", "--conditions=browser", devEntry, ...process.argv.slice(2)],
      {
        stdio: "inherit",
        cwd: packageDir  // Run from package directory
      }
    )
    if (result.error) {
      console.error("Failed to run in development mode:", result.error.message)
      process.exit(1)
    }
    process.exit(typeof result.status === "number" ? result.status : 0)
  }

  console.error(
    'It seems that your package manager failed to install the right version of the slmapcode CLI for your platform. You can try manually installing the "' +
      base +
      '" package',
  )
  process.exit(1)
}

run(resolved)
