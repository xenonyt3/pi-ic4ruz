import type { AssistantMessage } from "@earendil-works/pi-ai";
import { type Component, Container, Markdown, type MarkdownTheme, MouseRegion, Spacer, Text, visibleWidth } from "@earendil-works/pi-tui";
import type { AssistantTextRenderer, MarkdownTransformer, ThinkingRenderer } from "../../../core/extensions/types.ts";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { createMarkdownTransform } from "./markdown-transform.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

export type TranscriptPart =
	| { kind: "assistant" | "reasoning" | "notice"; component: Component; trimLeading?: boolean }
	| { kind: "tool"; toolCallId: string };

/**
 * Component that renders a complete assistant message
 */
export class AssistantMessageComponent extends Container {
	private contentContainer: Container;
	private hideThinkingBlock: boolean;
	private markdownTheme: MarkdownTheme;
	private hiddenThinkingLabel: string;
	private outputPad: number;
	private markdownTransformers: readonly MarkdownTransformer[];
	private getTextRenderer?: () => AssistantTextRenderer | undefined;
	private onTextRendererError?: (error: unknown) => void;
	private getThinkingRenderer?: () => ThinkingRenderer | undefined;
	private onThinkingRendererError?: (error: unknown) => void;
	private lastMessage?: AssistantMessage;
	private hasToolCalls = false;
	private isStreaming = false;
	private thinkingVisibilityOverrides = new Map<number, boolean>();
	private transcriptParts: TranscriptPart[] = [];

	getTranscriptParts(): readonly TranscriptPart[] { return this.transcriptParts; }

	constructor(
		message?: AssistantMessage,
		hideThinkingBlock = false,
		markdownTheme: MarkdownTheme = getMarkdownTheme(),
		hiddenThinkingLabel = "Thinking...",
		outputPad = 1,
		markdownTransformers: readonly MarkdownTransformer[] = [],
		getTextRenderer?: () => AssistantTextRenderer | undefined,
		onTextRendererError?: (error: unknown) => void,
		getThinkingRenderer?: () => ThinkingRenderer | undefined,
		onThinkingRendererError?: (error: unknown) => void,
	) {
		super();

		this.hideThinkingBlock = hideThinkingBlock;
		this.markdownTheme = markdownTheme;
		this.hiddenThinkingLabel = hiddenThinkingLabel;
		this.outputPad = outputPad;
		this.markdownTransformers = markdownTransformers;
		this.getTextRenderer = getTextRenderer;
		this.onTextRendererError = onTextRendererError;
		this.getThinkingRenderer = getThinkingRenderer;
		this.onThinkingRendererError = onThinkingRendererError;

		// Container for text/thinking content
		this.contentContainer = new Container();
		this.addChild(this.contentContainer);

		if (message) {
			this.updateContent(message);
		}
	}

	override invalidate(): void {
		super.invalidate();
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	setHideThinkingBlock(hide: boolean): void {
		this.hideThinkingBlock = hide;
		this.thinkingVisibilityOverrides.clear();
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	setHiddenThinkingLabel(label: string): void {
		this.hiddenThinkingLabel = label;
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	setOutputPad(padding: number): void {
		this.outputPad = padding;
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	override render(width: number): string[] {
		return this.applyTranscriptZones(super.render(width));
	}

	applyTranscriptZones(lines: string[]): string[] {
		if (this.hasToolCalls || lines.length === 0) {
			return lines;
		}

		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
		return lines;
	}

	updateContent(message: AssistantMessage, isStreaming = this.isStreaming): void {
		this.lastMessage = message;
		this.isStreaming = isStreaming;

		// Clear content container
		this.contentContainer.clear();
		this.transcriptParts = [];

		const hasVisibleContent = message.content.some(
			(c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()),
		);

		if (hasVisibleContent) {
			this.contentContainer.addChild(new Spacer(1));
		}

		// Render content in order
		let thinkingRunIndex = 0;
		for (let i = 0; i < message.content.length; i++) {
			const content = message.content[i];
			if (content.type === "text" && content.text.trim()) {
				const transform = createMarkdownTransform("assistant", this.isStreaming, this.markdownTransformers);
				const fallback = new Markdown(content.text.trim(), this.outputPad, 0, this.markdownTheme, undefined, { transform });
				// Only text presentation is replaceable; the surrounding message lifecycle stays upstream.
				const textComponent: Component = {
					invalidate: () => fallback.invalidate(),
					render: (width: number) => {
						try {
							const renderer = this.getTextRenderer?.();
							if (renderer) {
								const text = transform(content.text, Math.max(1, width - 2 * this.outputPad));
								const custom = renderer(text, width, theme, this.isStreaming, this.outputPad);
								if (custom !== undefined) {
									if (!Array.isArray(custom) || custom.length === 0 || custom.length > 10000 ||
										custom.some(line => typeof line !== "string" || /[\r\n]/.test(line) || visibleWidth(line) > width)) {
										throw new Error("INVALID_ASSISTANT_TEXT_RENDERER_OUTPUT");
									}
									return [...custom];
								}
							}
						} catch (error) {
							try { this.onTextRendererError?.(error); } catch { /* Preserve stock output. */ }
						}
						return fallback.render(width);
					},
				};
				this.contentContainer.addChild(textComponent);
				this.transcriptParts.push({ kind: "assistant", component: textComponent });
			} else if (content.type === "thinking") {
				const followsText = message.content.slice(0, i).reverse().find(block =>
					(block.type === "text" && block.text.trim()) || (block.type === "thinking" && block.thinking.trim()) || block.type === "toolCall",
				)?.type === "text";
				const thinkingBlocks: string[] = [];
				for (; i < message.content.length; i++) {
					const thinkingContent = message.content[i];
					if (thinkingContent.type !== "thinking") {
						break;
					}
					const thinking = thinkingContent.thinking.trim();
					if (thinking) {
						thinkingBlocks.push(thinking);
					}
				}
				i--;

				if (thinkingBlocks.length === 0) {
					continue;
				}

				// Add spacing only when another visible assistant content block follows.
				// This avoids a superfluous blank line before separately-rendered tool execution blocks.
				const hasVisibleContentAfter = message.content
					.slice(i + 1)
					.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));

				const runIndex = thinkingRunIndex++;
				const hidden = this.thinkingVisibilityOverrides.get(runIndex) ?? this.hideThinkingBlock;
				const thinkingComponent = hidden
					? new Text(theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)), this.outputPad, 0)
					: new Markdown(
							thinkingBlocks.join("\n\n"),
							this.outputPad,
							0,
							this.markdownTheme,
							{
								color: (text: string) => theme.fg("thinkingText", text),
								italic: true,
							},
							{
								transform: createMarkdownTransform(
									"assistant-thinking",
									this.isStreaming,
									this.markdownTransformers,
								),
							},
						);
				const presentedThinking = {
					invalidate: () => thinkingComponent.invalidate(),
					render: (width: number) => {
						try {
							const custom = this.getThinkingRenderer?.()?.(thinkingBlocks.join("\n\n"), width, theme, {
								expanded: !hidden, isStreaming: this.isStreaming, outputPad: this.outputPad,
								transform: createMarkdownTransform("assistant-thinking", this.isStreaming, this.markdownTransformers),
							});
							if (custom !== undefined) {
								if (!Array.isArray(custom) || custom.length === 0 || custom.length > 10000 ||
									custom.some(line => typeof line !== "string" || /[\r\n]/.test(line) || visibleWidth(line) > width)) {
									throw new Error("INVALID_THINKING_RENDERER_OUTPUT");
								}
								return [...(followsText ? [""] : []), ...custom];
							}
						} catch (error) {
							try { this.onThinkingRendererError?.(error); } catch { /* Preserve stock reasoning. */ }
						}
						return thinkingComponent.render(width);
					},
				};
				const thinkingRegion = new MouseRegion(presentedThinking, (event) => {
						if (event.type !== "click" || event.button !== "left") return undefined;
						this.thinkingVisibilityOverrides.set(runIndex, !hidden);
						if (this.lastMessage) this.updateContent(this.lastMessage);
						return { handled: true };
					});
				this.contentContainer.addChild(thinkingRegion);
				this.transcriptParts.push({ kind: "reasoning", component: thinkingRegion, trimLeading: followsText });
				if (hasVisibleContentAfter) {
					this.contentContainer.addChild(new Spacer(1));
				}
			} else if (content.type === "toolCall") {
				this.transcriptParts.push({ kind: "tool", toolCallId: content.id });
			}
		}
		const contentChildCount = this.contentContainer.children.length;

		// Check if incomplete/failed - show after partial content.
		// For aborted/error tool calls, tool execution components show the error.
		// Length stops can happen before a tool call is complete, so surface them here too.
		const hasToolCalls = message.content.some((c) => c.type === "toolCall");
		this.hasToolCalls = hasToolCalls;
		if (message.stopReason === "length") {
			this.contentContainer.addChild(new Spacer(1));
			this.contentContainer.addChild(
				new Text(theme.fg("error", "Response was truncated before completion."), this.outputPad, 0),
			);
		} else if (!hasToolCalls) {
			if (message.stopReason === "aborted") {
				const abortMessage =
					message.errorMessage && message.errorMessage !== "Request was aborted"
						? message.errorMessage
						: "Operation aborted";
				this.contentContainer.addChild(new Spacer(1));
				this.contentContainer.addChild(new Text(theme.fg("error", abortMessage), this.outputPad, 0));
			} else if (message.stopReason === "error") {
				const errorMsg = message.errorMessage || "Unknown error";
				this.contentContainer.addChild(new Spacer(1));
				this.contentContainer.addChild(new Text(theme.fg("error", `Error: ${errorMsg}`), this.outputPad, 0));
			}
		}
		for (const component of this.contentContainer.children.slice(contentChildCount)) {
			if (!(component instanceof Spacer)) this.transcriptParts.push({ kind: "notice", component });
		}
	}
}
