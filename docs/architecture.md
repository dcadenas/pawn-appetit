# Architecture

Pawn Appetit is a Tauri desktop app with a React/Vite frontend and a Rust backend. The frontend owns interactive UI state, board surfaces, tab layout, settings forms, and local optimistic UI updates. The Rust backend owns trusted filesystem access, engine process management, database reads and writes, archive extraction, imports, exports, and native integration.

## Frontend And Backend Boundary

Frontend code lives in `src/`. It calls generated, typed Tauri commands from `src/bindings.ts` rather than reaching into backend implementation details. Browser-only fallbacks should stay isolated behind environment helpers so the UI can run in tests without Tauri globals.

Backend code lives in `src-tauri/src/`. Tauri commands should stay thin: validate input, call normal Rust services or module functions, and return serializable data or structured errors. Domain behavior belongs in regular functions that can be tested without launching a Tauri webview.

## State Ownership

Frontend state is owned by React components, hooks, stores, and tab/session helpers. It should model current UI intent: active board, selected game, command availability, pending form state, and visible progress.

Backend state is stored in `AppState` and related Rust services. It owns shared engine process maps, database connection pools, caches, and long-running job state. Backend state should include stable identifiers for processes or jobs so events can be routed back to the correct frontend surface.

## Tauri Command Flow

Commands are registered in `src-tauri/src/lib.rs` through the Specta/Tauri builder and exposed to TypeScript bindings during debug desktop builds. Frontend code invokes commands through the generated bindings. Backend commands emit typed events for progress and async results when a single command response is not enough.

When adding or changing a command, update the Rust command signature, regenerate or verify bindings as needed, and add focused tests for the underlying Rust function. Avoid changing public command names unless migration is intentional.

## Engine Lifecycle

Engine binaries are installed and launched by Rust code. The backend starts UCI processes, sends setup and search commands, reads engine output, and emits analysis or play-session updates to the frontend. The frontend should treat engines as asynchronous services and render readiness, searching, stopped, and failure states explicitly.

Each engine workflow should have one authoritative owner for the process, an idempotent shutdown path, and cleanup when the owning tab or job ends.

## Database Modules

Database work is currently organized under `src-tauri/src/db/` plus related import, PGN, puzzle, and search modules. Rust owns SQLite connections, schema access, game normalization, position search, and import/export work. Frontend code should request data through commands instead of reading database files directly.

Long-running database operations should report progress through typed events and should avoid blocking UI workflows.

## Test Commands

Use these commands from the repository root:

```sh
pnpm test
pnpm lint
pnpm fmt:check
pnpm test:rust
pnpm lint:rust
pnpm fmt:rust:check
```

Rust backend checks use `--no-default-features` so contributors can run unit tests from a fresh checkout without building the frontend first. Default-feature Cargo builds still use Tauri's production asset embedding path and may require `dist`; use `pnpm build-vite` before default-feature production sanity checks.

## Common Workflows

Run the desktop app with `pnpm dev`. Build frontend assets with `pnpm build-vite`. Build the Tauri app with `pnpm tauri build`.

For backend-only work, prefer focused Rust tests under `src-tauri/src/` and run `pnpm test:rust`. For frontend work, add Vitest coverage near the changed components or hooks and run `pnpm test`.
