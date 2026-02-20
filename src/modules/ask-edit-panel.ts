import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type ObsidianAiPlugin from "../plugin";
import { improveCurrentWriting } from "./writing-improver";

const VIEW_TYPE_ASK_EDIT_PANEL = "obsidian-ai-ask-edit-panel";

class AskEditPanelView extends ItemView {
  private readonly plugin: ObsidianAiPlugin;
  private readonly getLastMarkdownPath: () => string | undefined;
  private promptEl?: HTMLTextAreaElement;
  private runButtonEl?: HTMLButtonElement;
  private liveOutputEl?: HTMLPreElement;
  private targetFilePath?: string;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: ObsidianAiPlugin,
    getLastMarkdownPath: () => string | undefined
  ) {
    super(leaf);
    this.plugin = plugin;
    this.getLastMarkdownPath = getLastMarkdownPath;
  }

  getViewType(): string {
    return VIEW_TYPE_ASK_EDIT_PANEL;
  }

  getDisplayText(): string {
    return "AI Ask & Edit";
  }

  getIcon(): string {
    return "messages-square";
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    this.targetFilePath =
      this.plugin.app.workspace.getActiveFile()?.path ??
      this.targetFilePath ??
      this.getLastMarkdownPath();

    contentEl.createEl("h2", { text: "Ask AI to Edit Note" });
    contentEl.createEl("p", {
      text: "Ask a question or give an edit instruction for the current note. The note update still goes through the review diff before apply."
    });

    this.promptEl = contentEl.createEl("textarea");
    this.promptEl.placeholder = "Example: tighten this note for executive summary tone and keep all facts.";
    this.promptEl.style.width = "100%";
    this.promptEl.style.minHeight = "140px";
    this.promptEl.style.boxSizing = "border-box";
    this.promptEl.style.marginBottom = "10px";

    const actionsEl = contentEl.createEl("div");
    actionsEl.style.display = "flex";
    actionsEl.style.gap = "8px";

    this.runButtonEl = actionsEl.createEl("button");
    this.runButtonEl.setText("Ask and Edit Current Note");
    this.runButtonEl.addEventListener("click", async () => {
      await this.runAskEdit();
    });

    const clearButtonEl = actionsEl.createEl("button");
    clearButtonEl.setText("Clear");
    clearButtonEl.addEventListener("click", () => {
      if (this.promptEl) {
        this.promptEl.value = "";
      }
    });

    contentEl.createEl("h3", { text: "Generating response" });
    this.liveOutputEl = contentEl.createEl("pre");
    this.liveOutputEl.style.whiteSpace = "pre-wrap";
    this.liveOutputEl.style.maxHeight = "260px";
    this.liveOutputEl.style.overflow = "auto";
    this.liveOutputEl.style.border = "1px solid var(--background-modifier-border)";
    this.liveOutputEl.style.padding = "8px";
    this.liveOutputEl.style.borderRadius = "6px";
    this.liveOutputEl.setText("");
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private async runAskEdit(): Promise<void> {
    const prompt = this.promptEl?.value?.trim() ?? "";
    if (!prompt) {
      new Notice("Enter a question or instruction first.");
      return;
    }

    if (this.runButtonEl) {
      this.runButtonEl.disabled = true;
    }
    if (this.liveOutputEl) {
      this.liveOutputEl.setText("");
    }

    this.targetFilePath =
      this.plugin.app.workspace.getActiveFile()?.path ??
      this.targetFilePath ??
      this.getLastMarkdownPath();
    if (!this.targetFilePath) {
      new Notice("Open a Markdown file first.");
      if (this.runButtonEl) {
        this.runButtonEl.disabled = false;
      }
      return;
    }

    try {
      await improveCurrentWriting(this.plugin, prompt, (partialText) => {
        if (!this.liveOutputEl) {
          return;
        }
        this.liveOutputEl.setText(partialText);
        this.liveOutputEl.scrollTop = this.liveOutputEl.scrollHeight;
      }, this.targetFilePath);
    } finally {
      if (this.runButtonEl) {
        this.runButtonEl.disabled = false;
      }
    }
  }
}

async function activateAskEditPanel(plugin: ObsidianAiPlugin): Promise<void> {
  const existingLeaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_ASK_EDIT_PANEL)[0];
  const leaf = existingLeaf ?? plugin.app.workspace.getRightLeaf(false);
  if (!leaf) {
    new Notice("Unable to open AI Ask & Edit panel.");
    return;
  }

  await leaf.setViewState({
    type: VIEW_TYPE_ASK_EDIT_PANEL,
    active: true
  });
  plugin.app.workspace.revealLeaf(leaf);
}

export function registerAskEditPanelModule(plugin: ObsidianAiPlugin): void {
  let lastOpenedMarkdownPath = plugin.app.workspace.getActiveFile()?.path;
  plugin.registerEvent(
    plugin.app.workspace.on("file-open", (file) => {
      if (file?.extension === "md") {
        lastOpenedMarkdownPath = file.path;
      }
    })
  );

  plugin.registerView(
    VIEW_TYPE_ASK_EDIT_PANEL,
    (leaf) => new AskEditPanelView(leaf, plugin, () => lastOpenedMarkdownPath)
  );

  plugin.addRibbonIcon("messages-square", "Open AI Ask & Edit panel", async () => {
    await activateAskEditPanel(plugin);
  });

  plugin.addCommand({
    id: "open-ai-ask-edit-panel",
    name: "Open AI Ask & Edit panel",
    callback: async () => {
      await activateAskEditPanel(plugin);
    }
  });
}

export async function closeAskEditPanel(plugin: ObsidianAiPlugin): Promise<void> {
  const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_ASK_EDIT_PANEL);
  await Promise.all(leaves.map(async (leaf) => leaf.detach()));
}
