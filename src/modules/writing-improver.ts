import { ButtonComponent, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin } from "obsidian";
import { AiClient } from "../ai/client";
import type ObsidianAiPlugin from "../plugin";

function getActiveMarkdownView(plugin: Plugin): MarkdownView | null {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  return view ?? null;
}

function getVaultBasePath(plugin: ObsidianAiPlugin): string | undefined {
  const adapter = plugin.app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath();
  }
  return undefined;
}

function splitFrontMatter(text: string): { frontMatter: string; body: string } {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (!match || match.index !== 0) {
    return { frontMatter: "", body: text };
  }

  const frontMatter = match[0];
  const body = text.slice(frontMatter.length);
  return { frontMatter, body };
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function buildUnifiedDiff(originalText: string, updatedText: string): string {
  const originalLines = splitLines(originalText);
  const updatedLines = splitLines(updatedText);
  const n = originalLines.length;
  const m = updatedLines.length;

  if (n * m > 250000) {
    return "Diff is too large to render safely. Apply to inspect full changes in note view.";
  }

  const cols = m + 1;
  const directions = new Uint8Array((n + 1) * cols);
  const prev = new Uint32Array(cols);
  const curr = new Uint32Array(cols);

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const idx = i * cols + j;
      if (originalLines[i - 1] === updatedLines[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        directions[idx] = 3;
      } else if (prev[j] >= curr[j - 1]) {
        curr[j] = prev[j];
        directions[idx] = 1;
      } else {
        curr[j] = curr[j - 1];
        directions[idx] = 2;
      }
    }

    prev.set(curr);
    curr.fill(0);
  }

  const diffLines: string[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    const idx = i * cols + j;
    if (i > 0 && j > 0 && directions[idx] === 3) {
      diffLines.push(` ${updatedLines[j - 1]}`);
      i -= 1;
      j -= 1;
      continue;
    }

    if (j > 0 && (i === 0 || directions[idx] === 2)) {
      diffLines.push(`+${updatedLines[j - 1]}`);
      j -= 1;
      continue;
    }

    if (i > 0) {
      diffLines.push(`-${originalLines[i - 1]}`);
      i -= 1;
      continue;
    }
  }

  return diffLines.reverse().join("\n");
}

function renderDiffPreview(container: HTMLElement, diffText: string): void {
  container.empty();

  const lines = diffText.split("\n");
  for (const line of lines) {
    const lineEl = container.createEl("div");
    lineEl.style.whiteSpace = "pre-wrap";

    if (line.startsWith("+")) {
      lineEl.style.color = "var(--color-green)";
    } else if (line.startsWith("-")) {
      lineEl.style.color = "var(--color-red)";
    } else {
      lineEl.style.color = "var(--text-muted)";
    }

    lineEl.setText(line);
  }
}

export function registerWritingImproverModule(plugin: ObsidianAiPlugin): void {
  plugin.addRibbonIcon("wand-sparkles", "Improve writing in current note", async () => {
    await improveCurrentWriting(plugin);
  });

  plugin.addCommand({
    id: "improve-current-writing",
    name: "Improve writing in current note or selection",
    callback: async () => {
      await improveCurrentWriting(plugin);
    }
  });

  plugin.addCommand({
    id: "test-codex-cli-connection",
    name: "Test Codex CLI connection",
    callback: async () => {
      await testCodexCliConnection(plugin);
    }
  });
}

async function improveCurrentWriting(plugin: ObsidianAiPlugin): Promise<void> {
  if (!plugin.hasAiConfigured()) {
    new Notice("AI backend is not configured. Run 'Set up Codex login'.");
    plugin.openCodexSetupModal();
    return;
  }

  const view = getActiveMarkdownView(plugin);
  if (!view) {
    new Notice("Open a Markdown note first.");
    return;
  }

  const editor = view.editor;
  const selectedText = editor.getSelection();
  const useSelection = selectedText.trim().length > 0;
  const sourceText = useSelection ? selectedText : editor.getValue();

  if (!sourceText.trim()) {
    new Notice("The current note is empty.");
    return;
  }

  const aiClient = new AiClient(plugin.settings, getVaultBasePath(plugin));
  const notice = new Notice("Improving writing...", 0);

  try {
    let textForAi = sourceText;
    let preservedFrontMatter = "";
    if (!useSelection) {
      const split = splitFrontMatter(sourceText);
      preservedFrontMatter = split.frontMatter;
      textForAi = split.body;
    }

    if (!textForAi.trim()) {
      notice.hide();
      new Notice("No editable body text found outside front matter.");
      return;
    }

    const improvedText = await aiClient.improveWriting({
      text: textForAi,
      systemPrompt: plugin.settings.writingSystemPrompt
    });

    if (!improvedText.trim()) {
      notice.hide();
      new Notice("No improved text returned.");
      return;
    }

    const finalImprovedText = useSelection
      ? improvedText
      : `${preservedFrontMatter}${improvedText}`;

    notice.hide();
    new ImprovedTextReviewModal(plugin, {
      originalText: sourceText,
      improvedText: finalImprovedText,
      useSelection,
      onApply: (approvedText) => {
        if (useSelection) {
          editor.replaceSelection(approvedText);
        } else {
          editor.setValue(approvedText);
        }
        new Notice("Writing improved.");
      }
    }).open();
  } catch (error) {
    notice.hide();
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Failed to improve writing: ${message}`);
  }
}

interface ImprovedTextReviewModalOptions {
  originalText: string;
  improvedText: string;
  useSelection: boolean;
  onApply: (text: string) => void;
}

class ImprovedTextReviewModal extends Modal {
  private readonly options: ImprovedTextReviewModalOptions;

  constructor(plugin: ObsidianAiPlugin, options: ImprovedTextReviewModalOptions) {
    super(plugin.app);
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Review improved text" });
    contentEl.createEl("p", {
      text: this.options.useSelection
        ? "Confirm before replacing the selected text."
        : "Confirm before replacing the entire note."
    });

    const editorEl = contentEl.createEl("textarea");
    editorEl.value = this.options.improvedText;
    editorEl.style.width = "100%";
    editorEl.style.minHeight = "220px";
    editorEl.style.boxSizing = "border-box";

    contentEl.createEl("h3", { text: "Diff preview" });
    const diffEl = contentEl.createEl("div");
    diffEl.style.fontFamily = "var(--font-monospace)";
    diffEl.style.fontSize = "var(--font-ui-small)";
    diffEl.style.whiteSpace = "pre-wrap";
    diffEl.style.maxHeight = "260px";
    diffEl.style.overflow = "auto";
    diffEl.style.border = "1px solid var(--background-modifier-border)";
    diffEl.style.padding = "8px";
    diffEl.style.borderRadius = "6px";

    const refreshDiff = (): void => {
      renderDiffPreview(diffEl, buildUnifiedDiff(this.options.originalText, editorEl.value));
    };

    refreshDiff();
    editorEl.addEventListener("input", () => refreshDiff());

    const actionsEl = contentEl.createEl("div");
    actionsEl.style.display = "flex";
    actionsEl.style.justifyContent = "flex-end";
    actionsEl.style.gap = "8px";
    actionsEl.style.marginTop = "12px";

    const cancelButton = new ButtonComponent(actionsEl);
    cancelButton.setButtonText("Cancel").onClick(() => {
      this.close();
      new Notice("Changes not applied.");
    });

    const applyLabel = this.options.useSelection ? "Replace selection" : "Replace note";
    const applyButton = new ButtonComponent(actionsEl);
    applyButton.setButtonText(applyLabel).setCta().onClick(() => {
      this.options.onApply(editorEl.value);
      this.close();
    });
  }
}

async function testCodexCliConnection(plugin: ObsidianAiPlugin): Promise<void> {
  if (plugin.settings.aiBackend !== "codex_cli") {
    new Notice("AI backend is not codex_cli. Switch backend in settings first.");
    return;
  }

  const aiClient = new AiClient(plugin.settings, getVaultBasePath(plugin));
  const notice = new Notice("Testing Codex CLI connection...", 0);

  try {
    const version = await aiClient.testCodexCliConnection();
    notice.hide();
    new Notice(`Codex CLI connected: ${version}`);
  } catch (error) {
    notice.hide();
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Codex CLI connection failed: ${message}`);
  }
}
