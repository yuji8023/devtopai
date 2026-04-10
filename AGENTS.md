# OpenCode Agent Guidelines

- Default branch: `dev`
- Prefer automation: execute actions without confirmation unless blocked by missing info or safety concerns
- Use parallel tools when applicable

## Build/Test Commands

```bash
# Installation & Development (requires Bun 1.3+)
bun install                    # Install dependencies
bun dev                        # Run TUI in packages/opencode
bun dev <directory>            # Run TUI in specific directory
bun dev serve                  # Start headless API server (port 4096)
bun dev web                    # Start server + open web interface

# Type Checking & Building
bun run typecheck              # Typecheck all packages (turbo)
bun run --cwd packages/opencode typecheck  # Typecheck opencode (tsgo)
./packages/opencode/script/build.ts --single  # Build standalone executable

# Testing (run from packages/opencode)
bun test                       # Run all tests
bun test test/tool/bash.test.ts  # Run single test file
bun test --grep "bash"         # Run tests matching pattern
```

When modifying `packages/opencode/src/server/server.ts`, run `./script/generate.ts` to regenerate SDK.

## Code Style

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch`; prefer `.catch(...)` or Result patterns
- Never use `any` type
- Prefer single word variable names
- Use Bun APIs: `Bun.file()`, `$\`...\`` for shell commands
- Rely on type inference; avoid explicit annotations unless necessary for exports
- Prefer functional array methods (flatMap, filter, map) over for loops
- Avoid `else` statements; use early returns

### Imports & Naming

### Naming Enforcement (Read This)

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.
- Examples to avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

```ts
// Named imports, relative paths
import { Tool } from "./tool"
import { Log } from "../util/log"
import z from "zod"

// Good: single word names, inline values used only once
const foo = 1
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad: compound names, unnecessary intermediate variables
const fooBar = 1
const journalPath = path.join(dir, "journal.json")
```

### Variables & Control Flow

```ts
// Good: direct access, ternaries, early returns
obj.a
obj.b
const foo = condition ? 1 : 2

// Bad: unnecessary destructuring, let, else
const { a, b } = obj
let foo
if (condition) foo = 1
else foo = 2
```

### Namespace Pattern

```ts
export namespace Tool {
  export function define(id: string, init: ...) { ... }
}
// Usage: Tool.define("bash", async () => { ... })
```

### Error Handling & Validation

```ts
// NamedError pattern for typed errors
import { NamedError } from "@opencode-ai/util/error"
export const NotFoundError = NamedError.create("NotFoundError", z.object({ message: z.string() }))

// Zod schemas for all input validation
const params = z.object({
  command: z.string().describe("The command to execute"),
  timeout: z.number().optional(),
})
```

### Schema Definitions (Drizzle)

```ts
// Use snake_case for field names (no column name redefinition needed)
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(), // Good
  created_at: integer().notNull(),
})
// Bad: projectID: text("project_id"), createdAt: integer("created_at")
```

## Architecture

### Project Structure

- `packages/opencode`: Core business logic & server
- `packages/opencode/src/cli/cmd/tui/`: TUI code (SolidJS + OpenTUI)
- `packages/app`: Shared web UI components (SolidJS)
- `packages/desktop`: Native desktop app (Tauri)
- `packages/plugin`: Source for `@opencode-ai/plugin`
- `packages/sdk/js`: JavaScript SDK

### Tool Implementation

```ts
export const MyTool = Tool.define("my-tool", async () => ({
  description: "Tool description",
  parameters: z.object({ ... }),
  async execute(params, ctx) {
    return { title: "Result title", metadata: { ... }, output: "Result output" }
  },
}))
```

### Logging

```ts
const log = Log.create({ service: "my-service" })
log.info("message", { extra: "data" })
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.
