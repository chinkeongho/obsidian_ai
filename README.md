# Obsidian AI Plugin

Modular Obsidian plugin for AI-assisted writing workflows.

## Features

- Improve selected text or the entire active note with AI.
- Configure model, endpoint style, prompt, temperature, and timeout in settings.
- Built to support multiple modules under `src/modules`.
- Includes a `Set up Codex login` helper command/button when auth is not configured.

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
- `Set up Codex login`

If text is selected, only that selection is replaced.
If no selection exists, the whole current note is replaced.

For Codex Pro users, the setup modal includes a direct web-login button.

## Settings

- `Codex login setup` button
- `AI backend`: `codex_cli` (default) or `openai_api`
- `Codex command` (default `codex`)
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

## Build

```bash
npm run build
```
