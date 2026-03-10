#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

const ghEnv = {
  ...process.env,
  GH_TOKEN: process.env.GH_TOKEN || "",
}

const output = [`version=${Script.version}`]

if (!Script.preview) {
  // For first release or when no previous tags exist, use simple release notes
  const body = `Release v${Script.version}\n\nFirst release of devtopai CLI.`
  const dir = process.env.RUNNER_TEMP ?? "/tmp"
  const file = `${dir}/devtopai-release-notes.txt`
  await Bun.write(file, body)
  await $`gh release create v${Script.version} -d --title "v${Script.version}" --notes-file ${file}`.env(ghEnv)
  const release = await $`gh release view v${Script.version} --json tagName,databaseId`.env(ghEnv).json()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
} else if (Script.channel === "beta") {
  await $`gh release create v${Script.version} -d --title "v${Script.version}" --repo ${process.env.GH_REPO}`.env(ghEnv)
  const release = await $`gh release view v${Script.version} --json tagName,databaseId --repo ${process.env.GH_REPO}`
    .env(ghEnv)
    .json()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
}

output.push(`repo=${process.env.GH_REPO}`)

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
