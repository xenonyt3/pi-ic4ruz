import { type Component, Container, type TuiMouseEvent } from "@earendil-works/pi-tui";
import { AssistantMessageComponent } from "./assistant-message.ts";
import { UserMessageComponent } from "./user-message.ts";

type Kind = "user" | "assistant" | "reasoning" | "tool" | "notice" | "other";

/** Adjust only structural spacing, and translate mouse coordinates by the same offset. */
class TranscriptRow implements Component {
	private prefix = 0;
	private removed = 0;
	private originalHeight = 0;
	constructor(private component: Component, private kind: Kind,
		private state: { previous?: Kind }, private trimLeading = false) {}
	invalidate(): void { this.component.invalidate(); }
	render(width: number): string[] {
		const lines = this.component.render(width);
		this.originalHeight = lines.length;
		this.removed = this.trimLeading && lines[0] === "" ? 1 : 0;
		const body = lines.slice(this.removed);
		this.prefix = body.length && this.kind !== "other" && !(this.kind === "tool" && this.state.previous === "tool") ? 1 : 0;
		if (body.length) this.state.previous = this.kind;
		return this.prefix ? ["", ...body] : body;
	}
	handleMouse(event: TuiMouseEvent) {
		if (event.y < this.prefix) return undefined;
		return this.component.handleMouse?.({ ...event, y: event.y - this.prefix + this.removed, height: this.originalHeight });
	}
}

/** Keep the original flat children for Pi lifecycle/expansion; project only the visible layout. */
export class TranscriptContainer extends Container {
	private associations = new WeakMap<Component, { id: string; owner?: AssistantMessageComponent }>();
	private presented?: Container;
	constructor(private enabled: () => boolean, private onFailure: (error: unknown) => void) { super(); }

	addToolComponent(component: Component, id: string): void {
		const owner = [...this.children].reverse().find((child): child is AssistantMessageComponent =>
			child instanceof AssistantMessageComponent && child.getTranscriptParts().some(part => part.kind === "tool" && part.toolCallId === id));
		this.associations.set(component, { id, owner });
		this.addChild(component);
	}

	override clear(): void { super.clear(); this.associations = new WeakMap(); this.presented = undefined; }
	override handleMouse(event: TuiMouseEvent) {
		return this.enabled() && this.presented ? this.presented.handleMouse(event) : super.handleMouse(event);
	}
	override render(width: number): string[] {
		if (!this.enabled()) { this.presented = undefined; return super.render(width); }
		try {
			const state: { previous?: Kind } = {}, projected = new Container();
			const present = new Set(this.children), owned = new Map<AssistantMessageComponent, Map<string, Component>>();
			const embedded = new Set<Component>();
			for (const child of this.children) {
				const entry = this.associations.get(child);
				if (!entry?.owner || !present.has(entry.owner)) continue;
				if (!entry.owner.getTranscriptParts().some(part => part.kind === "tool" && part.toolCallId === entry.id)) continue;
				let tools = owned.get(entry.owner);
				if (!tools) { tools = new Map(); owned.set(entry.owner, tools); }
				// Malformed duplicate IDs must not make either tool disappear.
				if (!tools.has(entry.id)) { tools.set(entry.id, child); embedded.add(child); }
			}
			for (const child of this.children) {
				if (embedded.has(child)) continue;
				if (child instanceof AssistantMessageComponent) {
					const group = new Container(), used = new Set<string>();
					for (const part of child.getTranscriptParts()) {
						if (part.kind === "tool") {
							const tool = owned.get(child)?.get(part.toolCallId);
							if (tool && !used.has(part.toolCallId)) {
								group.addChild(new TranscriptRow(tool, "tool", state, true)); used.add(part.toolCallId);
							}
						} else group.addChild(new TranscriptRow(part.component, part.kind, state, part.trimLeading));
					}
					projected.addChild({ render: w => child.applyTranscriptZones(group.render(w)),
						invalidate: () => child.invalidate(), handleMouse: event => group.handleMouse(event) });
				} else {
					const tool = this.associations.has(child);
					projected.addChild(new TranscriptRow(child, tool ? "tool" : child instanceof UserMessageComponent ? "user" : "other", state, tool));
				}
			}
			const lines = projected.render(width);
			this.presented = projected;
			return lines;
		} catch (error) {
			this.presented = undefined;
			this.onFailure(error);
			return super.render(width);
		}
	}
}
