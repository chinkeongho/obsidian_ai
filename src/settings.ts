export type ApiStyle = "responses" | "chat_completions";
export type AiBackend = "codex_cli" | "openai_api";

export interface ObsidianAiPluginSettings {
  aiBackend: AiBackend;
  apiKey: string;
  apiBaseUrl: string;
  apiStyle: ApiStyle;
  codexCommand: string;
  model: string;
  temperature: number;
  requestTimeoutMs: number;
  writingSystemPrompt: string;
}

export const DEFAULT_SETTINGS: ObsidianAiPluginSettings = {
  aiBackend: "codex_cli",
  apiKey: "",
  apiBaseUrl: "https://api.openai.com/v1",
  apiStyle: "responses",
  codexCommand: "codex",
  model: "gpt-5-codex",
  temperature: 0.2,
  requestTimeoutMs: 60000,
  writingSystemPrompt:
    "You are an expert writing editor. Improve clarity, flow, grammar, and structure while preserving the original meaning and markdown format."
};
