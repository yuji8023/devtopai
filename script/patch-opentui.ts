#!/usr/bin/env bun

/**
 * Post-install script to patch @opentui/core for multi-byte character support
 * This fixes Chinese/Japanese/Korean input in the TUI
 */

import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

const PACKAGE_NAME = "@opentui/core"
const FILE_TO_PATCH = "index.js"

// The original code that needs to be replaced
const ORIGINAL_CODE =
  'if (key.sequence && key.sequence.length === 1 && key.sequence.charCodeAt(0) >= 32 && key.sequence.charCodeAt(0) <= 126) {'

// The fixed code that supports multi-byte characters
const FIXED_CODE = `// Support multi-byte characters (Chinese, Japanese, Korean, etc.)
      // Accept any printable character, not just ASCII 32-126
      if (key.sequence && key.sequence.length >= 1 && key.sequence.trim().length > 0) {`

function findPackagePath(): string | null {
  // Try to find the package in node_modules
  const possiblePaths = [
    join(process.cwd(), "node_modules", PACKAGE_NAME, FILE_TO_PATCH),
    join(process.cwd(), "packages", "opencode", "node_modules", PACKAGE_NAME, FILE_TO_PATCH),
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  return null
}

function applyPatch() {
  console.log(`[patch-opentui] Applying patch to ${PACKAGE_NAME}...`)

  const filePath = findPackagePath()

  if (!filePath) {
    console.log(`[patch-opentui] ⚠️  ${PACKAGE_NAME} not found, skipping patch`)
    return
  }

  try {
    const content = readFileSync(filePath, "utf-8")

    // Check if the patch is already applied
    if (content.includes(FIXED_CODE)) {
      console.log(`[patch-opentui] ✓ Patch already applied`)
      return
    }

    // Check if the original code exists
    if (!content.includes(ORIGINAL_CODE)) {
      console.log(`[patch-opentui] ⚠️  Original code not found, package may have been updated`)
      return
    }

    // Apply the patch
    const patchedContent = content.replace(ORIGINAL_CODE, FIXED_CODE)
    writeFileSync(filePath, patchedContent, "utf-8")

    console.log(`[patch-opentui] ✓ Successfully patched ${PACKAGE_NAME}`)
    console.log(`[patch-opentui]   Multi-byte character input (Chinese/Japanese/Korean) is now supported`)
  } catch (error) {
    console.error(`[patch-opentui] ✗ Failed to apply patch:`, error)
    process.exit(1)
  }
}

applyPatch()
