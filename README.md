# Obsidian AI Plugin

Modular Obsidian plugin for AI-assisted writing and question-driven editing workflows.

## Features

- Improve selected text or the entire active note with AI.
- Preserve YAML front matter (front matter is never edited during full-note rewrites).
- Review before apply:
  - editable proposed text
  - colored diff preview (`+` green, `-` red, unchanged muted)
  - accept/cancel
- Codex thread control:
  - global thread mode (`new`, `last`, `specific`)
  - per-file override commands
- Right-side `AI Ask & Edit` panel:
  - ask a question/instruction for the current note
  - view response text while it is being generated
  - still requires review/diff acceptance before applying edits
- Supports both `codex_cli` and OpenAI-compatible API backend modes.

## Quick Start

```bash
npm install
npm run dev
```

Load it in your vault:

1. Place this folder at `.obsidian/plugins/obsidian-ai-plugin` (or symlink).
2. Open Obsidian -> `Settings` -> `Community plugins`.
3. Disable restricted mode and enable `Obsidian AI Plugin`.

## Commands

- `Improve writing in current note or selection`
- `Open AI Ask & Edit panel`
- `Set Codex thread mode for current file`
- `Clear Codex thread mode for current file`
- `Test Codex CLI connection`
- `Set up Codex login`

If text is selected, only that selection is replaced.
If no selection exists, the whole current note is replaced.

For Codex Pro users, the setup modal includes a direct web-login button.

## Settings

- `Codex login setup` button
- `AI backend`: `codex_cli` (default) or `openai_api`
- `Codex command` (default `codex`)
- `Codex thread mode`: `new` | `last` | `specific`
- `Codex thread ID` (used when mode = `specific`)
- `API key`
- `API base URL` (default `https://api.openai.com/v1`)
- `API style`: `responses` or `chat_completions`
- `Model`
- `Temperature`
- `Request timeout (ms)`
- `Writing system prompt`

If auth is missing, the writing command opens a setup modal with Codex login steps.
Default mode uses your Codex CLI login session (`codex_cli`) and does not require an API key.
Use `openai_api` backend only if you want direct API key calls.

## Side Panel Workflow

1. Open command: `Open AI Ask & Edit panel`.
2. Enter a question or instruction for the note.
3. Click `Ask and Edit Current Note`.
4. Watch live generated output in `Generating response`.
5. Confirm final changes in the review modal before applying.

## Thread Modes

- `new`: start a fresh Codex thread every run.
- `last`: continue the most recent thread.
- `specific`: continue a specific thread ID.
- Per-file thread settings override global settings for that note.

## Build

```bash
npm run build
```
