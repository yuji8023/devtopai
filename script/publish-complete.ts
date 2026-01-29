#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

// Download release artifacts for AUR or other purposes
await $`gh release download v${Script.version} --pattern "slmapcode-linux-*64.tar.gz" --pattern "slmapcode-darwin-*64.zip" -D dist`
