#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

const output = [`version=${Script.version}`]

if (!Script.preview) {
  // For first release or when no previous tags exist, use simple release notes
  const body = `Release v${Script.version}\n\nFirst release of devtopai CLI.`
  const dir = process.env.RUNNER_TEMP ?? "/tmp"
  const file = `${dir}/devtopai-release-notes.txt`
  await Bun.write(file, body)
  await $`gh release create v${Script.version} -d --title "v${Script.version}" --notes-file ${file}`
  const release = await $`gh release view v${Script.version} --json tagName,databaseId`.json()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
}

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
