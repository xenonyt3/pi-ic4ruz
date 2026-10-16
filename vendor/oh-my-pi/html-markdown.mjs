// Adapted from @oh-my-pi/pi-coding-agent 18.10.1; see LICENSE and provenance.json.
import { createTurndown } from "./turndown.mjs";
let instance;
const getTurndown = async () => instance ??= createTurndown();
export async function htmlToBasicMarkdown(html        )                  {
	const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
	const turndown = await getTurndown();
	return turndown.turndown(cleaned).trim();
}
