import { App, Modal, Notice, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";
import { registerWritingImproverModule } from "./modules/writing-improver";
import {
  DEFAULT_SETTINGS,
  type AiBackend,
  type ApiStyle,
  type ObsidianAiPluginSettings
} from "./settings";

export default class ObsidianAiPlugin extends Plugin {
  settings: ObsidianAiPluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerCodexSetupCommand();
    registerWritingImproverModule(this);
    this.addSettingTab(new ObsidianAiSettingTab(this.app, this));
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    if (this.settings.aiBackend === "codex_cli" && this.settings.model === "gpt-5-mini") {
      this.settings.model = "gpt-5-codex";
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  openCodexSetupModal(): void {
    new CodexSetupModal(this.app, this).open();
  }

  hasAiConfigured(): boolean {
    if (this.settings.aiBackend === "codex_cli") {
      return true;
    }

    return this.settings.apiKey.trim().length > 0;
  }

  private registerCodexSetupCommand(): void {
    this.addCommand({
      id: "setup-codex-login",
      name: "Set up Codex login",
      callback: () => {
        this.openCodexSetupModal();
      }
    });
  }
}

class ObsidianAiSettingTab extends PluginSettingTab {
  plugin: ObsidianAiPlugin;

  constructor(app: App, plugin: ObsidianAiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AI Configuration" });

    new Setting(containerEl)
      .setName("Codex login setup")
      .setDesc("Use this if Codex/API auth is not configured yet.")
      .addButton((button) =>
        button.setButtonText("Set up").onClick(() => {
          this.plugin.openCodexSetupModal();
        })
      );

    new Setting(containerEl)
      .setName("AI backend")
      .setDesc("Use Codex CLI login session or direct API key mode.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("codex_cli", "codex_cli (recommended)")
          .addOption("openai_api", "openai_api")
          .setValue(this.plugin.settings.aiBackend)
          .onChange(async (value) => {
            this.plugin.settings.aiBackend = value as AiBackend;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Codex command")
      .setDesc("Command used to invoke Codex CLI.")
      .addText((text) =>
        text
          .setPlaceholder("codex")
          .setValue(this.plugin.settings.codexCommand)
          .onChange(async (value) => {
            this.plugin.settings.codexCommand = value.trim() || DEFAULT_SETTINGS.codexCommand;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API key")
      .setDesc("OpenAI-compatible API key. Stored in plain text in plugin data.")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API base URL")
      .setDesc("Base URL only. Example: https://api.openai.com/v1")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.apiBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiBaseUrl =
              value.trim() || DEFAULT_SETTINGS.apiBaseUrl;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API style")
      .setDesc("Use responses for modern models, chat_completions for older endpoints.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("responses", "responses")
          .addOption("chat_completions", "chat_completions")
          .setValue(this.plugin.settings.apiStyle)
          .onChange(async (value) => {
            this.plugin.settings.apiStyle = value as ApiStyle;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Model ID to use for writing improvement.")
      .addText((text) =>
        text
          .setPlaceholder("gpt-5-codex")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value.trim() || DEFAULT_SETTINGS.model;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Temperature")
      .setDesc("Lower = safer edits. Higher = more rewriting.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.1)
          .setValue(this.plugin.settings.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.temperature = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Request timeout (ms)")
      .setDesc("Maximum wait time before request fails.")
      .addText((text) =>
        text
          .setPlaceholder("60000")
          .setValue(String(this.plugin.settings.requestTimeoutMs))
          .onChange(async (value) => {
            const parsed = Number(value);
            this.plugin.settings.requestTimeoutMs =
              Number.isFinite(parsed) && parsed >= 1000
                ? Math.floor(parsed)
                : DEFAULT_SETTINGS.requestTimeoutMs;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h2", { text: "Writing Module" });

    new Setting(containerEl)
      .setName("Writing system prompt")
      .setDesc("Instruction used by the writing improver module.")
      .addTextArea((text) =>
        text
          .setPlaceholder("Instruction for the AI editor...")
          .setValue(this.plugin.settings.writingSystemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.writingSystemPrompt =
              value.trim() || DEFAULT_SETTINGS.writingSystemPrompt;
            await this.plugin.saveSettings();
          })
      );
  }
}

class CodexSetupModal extends Modal {
  private readonly plugin: ObsidianAiPlugin;

  constructor(app: App, plugin: ObsidianAiPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Set Up Codex Login" });
    contentEl.createEl("p", {
      text:
        "1) Sign in to Codex on the web (Pro plan). 2) In terminal, run `codex login` once to connect CLI to your account. 3) Keep AI backend as `codex_cli` in plugin settings."
    });

    new Setting(contentEl)
      .setName("Open Codex web login")
      .setDesc("Opens the Codex sign-in page in your browser.")
      .addButton((button) =>
        button.setButtonText("Open").onClick(() => {
          window.open("https://chatgpt.com/codex", "_blank");
          new Notice("Opened Codex web login.");
        })
      );

    new Setting(contentEl)
      .setName("Run codex login")
      .setDesc("Optional desktop flow. Attempts to launch `codex login` from Obsidian.")
      .addButton((button) =>
        button.setButtonText("Run").onClick(() => {
          this.tryRunCodexLogin();
        })
      );

    contentEl.createEl("p", {
      text:
        "Note: Codex Pro web login and API keys are separate auth flows. This plugin currently uses API key authentication for requests."
    });

    new Setting(contentEl)
      .setName("Close")
      .addButton((button) =>
        button.setButtonText("Done").setCta().onClick(() => {
          this.close();
        })
      );
  }

  private tryRunCodexLogin(): void {
    if (!Platform.isDesktopApp) {
      new Notice("Codex login launcher is available only on desktop.");
      return;
    }

    try {
      type SpawnFn = (
        command: string,
        args: string[],
        options: { shell: boolean; detached: boolean; stdio: string }
      ) => { unref?: () => void };

      const requireFn = (window as Window & { require?: (id: string) => unknown }).require;
      if (!requireFn) {
        throw new Error("Node integration is unavailable in this Obsidian build.");
      }

      const childProcess = requireFn("child_process") as { spawn?: SpawnFn };
      if (!childProcess.spawn) {
        throw new Error("Unable to access child_process.spawn.");
      }

      const child = childProcess.spawn("codex", ["login"], {
        shell: true,
        detached: true,
        stdio: "ignore"
      });
      child.unref?.();
      new Notice("Started `codex login` in the background.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Could not launch codex login: ${message}`);
    }
  }
}
