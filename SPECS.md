# SPECS

## Project

- Name: `obsidian-ai-plugin`
- Type: Obsidian community plugin
- Runtime entry: `main.ts` -> `src/plugin.ts`
- Build output: `main.js`

## Goal

Provide modular AI capabilities inside Obsidian, starting with writing improvement for the active note.

## Architecture

- `src/plugin.ts`
  - Plugin lifecycle (`onload`, settings persistence)
  - Registers modules
  - Renders plugin settings UI
  - Provides Codex login setup command/modal
- `src/settings.ts`
  - Settings schema and defaults
- `src/ai/client.ts`
  - Backend router for AI execution
  - Supports:
    - `codex_cli` backend via `codex exec` (default)
    - OpenAI-compatible HTTP mode
    - `responses` endpoint (`/responses`)
    - `chat_completions` endpoint (`/chat/completions`)
- `src/modules/writing-improver.ts`
  - Module 1 implementation
  - Ribbon action + command
  - Selection-first behavior; fallback to whole note

## Module 1: Writing Improver

### Trigger

- Command: `Improve writing in current note or selection`
- Ribbon icon: wand icon

### Behavior

1. Require configured backend.
   - For `codex_cli`, use Codex login session.
   - For `openai_api`, require API key.
   - If missing/invalid, open Codex setup modal.
2. Detect active Markdown editor.
3. If selection exists: send selection to AI and replace selection.
4. If no selection: send full note to AI and replace full note.
5. Show user notices for progress/success/errors.

### Prompting

- Uses configurable `writingSystemPrompt`.
- Sends user text as the editing target.
- Expected output: improved markdown text preserving meaning.

## Settings Contract

- `apiKey: string`
- `aiBackend: "codex_cli" | "openai_api"`
- `apiBaseUrl: string`
- `apiStyle: "responses" | "chat_completions"`
- `codexCommand: string`
- `model: string`
- `temperature: number`
- `requestTimeoutMs: number`
- `writingSystemPrompt: string`

## Non-Goals (Current Version)

- No streaming output.
- No diff/preview before apply.
- No per-note history/undo stack beyond editor undo.
- No multi-provider auth flows beyond bearer token.
- No secure OAuth token transfer from Codex CLI into plugin settings.

## Validation

- Type-check and bundle must pass:

```bash
npm run build
```
