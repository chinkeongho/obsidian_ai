import type { ObsidianAiPluginSettings } from "../settings";

export interface ImproveWritingInput {
  text: string;
  systemPrompt: string;
}

export class AiClient {
  private readonly settings: ObsidianAiPluginSettings;
  private readonly workingDirectory?: string;

  constructor(settings: ObsidianAiPluginSettings, workingDirectory?: string) {
    this.settings = settings;
    this.workingDirectory = workingDirectory;
  }

  async improveWriting(input: ImproveWritingInput): Promise<string> {
    if (this.settings.aiBackend === "codex_cli") {
      return this.improveWithCodexCli(input);
    }

    if (this.settings.apiStyle === "chat_completions") {
      return this.improveWithChatCompletions(input);
    }

    return this.improveWithResponses(input);
  }

  async testCodexCliConnection(): Promise<string> {
    const output = await this.spawnCommand([ "--version" ], this.settings.requestTimeoutMs);
    const text = output.trim();
    if (!text) {
      throw new Error("Codex CLI did not return a version string.");
    }
    return text;
  }

  private async improveWithCodexCli(input: ImproveWritingInput): Promise<string> {
    const prompt = [
      input.systemPrompt,
      "",
      "Return only the improved markdown text with no preface.",
      "",
      "Text to improve:",
      input.text
    ].join("\n");

    const args = ["exec", "--skip-git-repo-check", "-m", this.settings.model, prompt];
    const result = await this.spawnCommand(args, this.settings.requestTimeoutMs);
    const output = result.trim();
    if (!output) {
      throw new Error("Codex CLI returned no text.");
    }
    return output;
  }

  private async improveWithResponses(input: ImproveWritingInput): Promise<string> {
    const response = await this.postJson("/responses", {
      model: this.settings.model,
      temperature: this.settings.temperature,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: input.systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: input.text }]
        }
      ]
    });

    if (response.status >= 400) {
      throw new Error(this.readApiError(response.json, response.status));
    }

    const body = response.json as {
      output_text?: string;
      output?: unknown;
    };

    const textFromTopLevel = (body.output_text ?? "").trim();
    if (textFromTopLevel) {
      return textFromTopLevel;
    }

    const textFromOutput = this.extractTextFromResponseOutput(body.output);
    if (!textFromOutput) {
      throw new Error("AI API returned no text.");
    }
    return textFromOutput;
  }

  private async improveWithChatCompletions(input: ImproveWritingInput): Promise<string> {
    const response = await this.postJson("/chat/completions", {
      model: this.settings.model,
      temperature: this.settings.temperature,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.text }
      ]
    });

    if (response.status >= 400) {
      throw new Error(this.readApiError(response.json, response.status));
    }

    const body = response.json as {
      choices?: Array<{
        message?: { content?: string };
        text?: string;
      }>;
    };

    const text =
      body.choices?.[0]?.message?.content ?? body.choices?.[0]?.text ?? "";
    if (!text.trim()) {
      throw new Error("AI API returned no text.");
    }

    return text.trim();
  }

  private extractTextFromResponseOutput(output: unknown): string {
    if (!Array.isArray(output)) {
      return "";
    }

    const chunks: string[] = [];

    for (const item of output) {
      const content = (item as { content?: unknown })?.content;
      if (!Array.isArray(content)) {
        continue;
      }

      for (const block of content) {
        const text = (block as { text?: unknown })?.text;
        if (typeof text === "string" && text.trim()) {
          chunks.push(text.trim());
        }
      }
    }

    return chunks.join("\n\n").trim();
  }

  private readApiError(json: unknown, status: number): string {
    const message =
      (json as { error?: { message?: string } })?.error?.message ??
      (json as { message?: string })?.message;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }

    return `API request failed with status ${status}.`;
  }

  private async postJson(
    path: string,
    payload: Record<string, unknown>
  ): Promise<{ status: number; json: unknown }> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.settings.requestTimeoutMs);
    const url = `${this.settings.apiBaseUrl.replace(/\/$/, "")}${path}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const json = (await response.json().catch(() => ({}))) as unknown;
      return { status: response.status, json };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.settings.requestTimeoutMs}ms.`);
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  private async spawnCommand(args: string[], timeoutMs: number): Promise<string> {
    if (!(window as Window & { require?: (id: string) => unknown }).require) {
      throw new Error("Codex CLI is available only in Obsidian desktop.");
    }

    type SpawnFn = (
      command: string,
      args: string[],
      options: { stdio: string[]; cwd?: string }
    ) => {
      stdout?: { on: (event: string, cb: (chunk: unknown) => void) => void };
      stderr?: { on: (event: string, cb: (chunk: unknown) => void) => void };
      on: (event: string, cb: (code: number | null) => void) => void;
      kill: (signal?: string) => void;
    };

    const requireFn = (window as Window & { require?: (id: string) => unknown }).require;
    const childProcess = requireFn?.("child_process") as { spawn?: SpawnFn };
    if (!childProcess?.spawn) {
      throw new Error("Unable to access child_process.spawn.");
    }
    const spawn = childProcess.spawn;

    return await new Promise<string>((resolve, reject) => {
      const child = spawn(this.settings.codexCommand, args, {
        cwd: this.workingDirectory,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill("SIGTERM");
        reject(new Error(`Codex CLI timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);

        if (code === 0) {
          resolve(stdout.trim());
          return;
        }

        const err = stderr.trim() || `Codex CLI exited with code ${String(code)}.`;
        reject(new Error(err));
      });
    });
  }
}
