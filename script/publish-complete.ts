#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

if (!Script.preview) {
  await $`gh release edit v${Script.version} --draft=false`
}

await $`bun install`

await $`gh release download --pattern "slmapcode-linux-*64.tar.gz" --pattern "slmapcode-darwin-*64.zip" -D dist`
