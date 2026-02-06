# OpenCode Agent Guidelines

- Default branch: `dev`
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility

## Build/Test Commands

### Installation & Development

```bash
bun install                    # Install dependencies (requires Bun 1.3+)
bun dev                        # Run TUI in packages/opencode directory
bun dev <directory>            # Run TUI in specific directory
bun dev .                      # Run TUI in repo root
bun dev serve                  # Start headless API server (port 4096)
bun dev serve --port 8080      # Start server on custom port
bun dev web                    # Start server + open web interface
```

### Type Checking & Building

```bash
bun run typecheck              # Typecheck all packages (uses turbo)
bun run --cwd packages/opencode typecheck  # Typecheck opencode package (uses tsgo)
./packages/opencode/script/build.ts --single  # Build standalone executable
```

### Testing

```bash
bun test                       # Run all tests (from packages/opencode)
bun test test/tool/bash.test.ts  # Run single test file
bun test --grep "bash"         # Run tests matching pattern
```

### SDK Regeneration

When modifying `packages/opencode/src/server/server.ts`, run `./script/generate.ts` to regenerate SDK.

## Code Style

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch`; prefer `.catch(...)` or Result patterns
- Never use `any` type
- Prefer single word variable names
- Use Bun APIs: `Bun.file()`, `$\`...\`` for shell commands
- Rely on type inference; avoid explicit type annotations unless necessary for exports
- Prefer functional array methods (flatMap, filter, map) over for loops

### Imports

```ts
// Good: Named imports, relative paths
import { Tool } from "./tool"
import { Log } from "../util/log"
import z from "zod"
```

### Naming

Prefer single word names. Inline values used only once:

```ts
// Good: const foo = 1; function journal(dir: string) {}
// Bad: const fooBar = 1; function prepareJournal(dir: string) {}

// Good: const journal = await Bun.file(path.join(dir, "journal.json")).json()
// Bad: const journalPath = path.join(dir, "journal.json"); const journal = ...
```

### Destructuring & Variables

Avoid unnecessary destructuring. Prefer `const` over `let`. Use ternaries or early returns.

```ts
// Good: obj.a; obj.b; const foo = condition ? 1 : 2
// Bad: const { a, b } = obj; let foo; if (condition) foo = 1; else foo = 2
```

### Namespace Pattern

Use namespace-based organization for modules:

```ts
export namespace Tool {
  export function define(id: string, init: ...) { ... }
}
// Usage: const tool = Tool.define("bash", async () => { ... })
```

### Error Handling

Use NamedError pattern for typed errors:

```ts
import { NamedError } from "@opencode-ai/util/error"
export const NotFoundError = NamedError.create("NotFoundError", z.object({ message: z.string() }))
```

### Validation

Use Zod schemas for all input validation:

```ts
const params = z.object({
  command: z.string().describe("The command to execute"),
  timeout: z.number().optional(),
})
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined:

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
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

Implement tools using `Tool.define()`:

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

Use `Log.create()` pattern:

```ts
const log = Log.create({ service: "my-service" })
log.info("message", { extra: "data" })
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Use `bun:test` for test framework
- Use `Instance.provide()` for test context setup

## Formatting

- Prettier config: `semi: false`, `printWidth: 120`
- No semicolons
- 120 character line width
