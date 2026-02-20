# SPECS

## Project

- Name: `obsidian-ai-plugin`
- Type: Obsidian community plugin
- Runtime entry: `main.ts` -> `src/plugin.ts`
- Build output: `main.js`

## Goal

Provide modular AI capabilities inside Obsidian for guided writing edits, thread-aware Codex usage, and review-before-apply workflows.

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
    - `codex_cli` backend via `codex exec` / `codex exec resume`
    - OpenAI-compatible HTTP mode
    - `responses` endpoint (`/responses`)
    - `chat_completions` endpoint (`/chat/completions`)
- `src/modules/writing-improver.ts`
  - Writing improver implementation
  - Ribbon action + command
  - Selection-first behavior; fallback to whole note
  - Front matter preservation for full-note rewrites
  - Review modal with editable proposed text + colored diff
  - Per-file Codex thread override commands
- `src/modules/ask-edit-panel.ts`
  - Right sidebar panel to ask instruction/question and trigger note edits
  - Reuses review/diff flow before applying changes

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
3. Resolve Codex thread mode:
   - global mode (`new` / `last` / `specific`) from settings, or
   - per-file override (if configured for active file).
4. If selection exists: send selection to AI.
5. If no selection: split YAML front matter and body; send only body to AI; preserve front matter unchanged.
6. Show review modal before apply:
   - editable candidate text
   - colored unified diff preview (`+` green, `-` red, unchanged muted)
   - apply/cancel actions
7. Show user notices for progress/success/errors.

### Prompting

- Uses configurable `writingSystemPrompt`.
- Sends selected text or note body as the editing target.
- For side panel runs, appends one-off instruction under:
  - `Additional user instruction for this edit:`
- Expected output: improved markdown text preserving meaning.

## Ask & Edit Side Panel

### Trigger

- Command: `Open AI Ask & Edit panel`
- Ribbon icon: messages icon

### Behavior

1. Opens right sidebar panel view.
2. User enters question/instruction.
3. On submit, panel runs writing improver for the current note using the same thread rules.
4. Result still goes through review modal and diff before apply.
5. Panel does not auto-apply edits.

## Settings Contract

- `apiKey: string`
- `aiBackend: "codex_cli" | "openai_api"`
- `apiBaseUrl: string`
- `apiStyle: "responses" | "chat_completions"`
- `codexCommand: string`
- `codexThreadMode: "new" | "last" | "specific"`
- `codexThreadId: string`
- `codexThreadOverrides: Record<string, { mode: "new" | "last" | "specific"; threadId: string }>`
- `model: string`
- `temperature: number`
- `requestTimeoutMs: number`
- `writingSystemPrompt: string`

## Commands

- `Improve writing in current note or selection`
- `Test Codex CLI connection`
- `Set Codex thread mode for current file`
- `Clear Codex thread mode for current file`
- `Open AI Ask & Edit panel`
- `Set up Codex login`

## Non-Goals (Current Version)

- No streaming output.
- No per-note history/undo stack beyond editor undo.
- No multi-provider auth flows beyond bearer token.
- No secure OAuth token transfer from Codex CLI into plugin settings.

## Validation

- Type-check and bundle must pass:

```bash
npm run build
```
