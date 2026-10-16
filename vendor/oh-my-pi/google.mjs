// Adapted from @oh-my-pi/pi-coding-agent 18.10.1; see LICENSE and provenance.json.
import { parseHTML } from "../../tools/web/dom.mjs";
export function normalizeSearchText(value         )                     {
	if (typeof value !== "string") return undefined;
	const text = value.replace(/\s+/g, " ").trim();
	return text.length > 0 ? text : undefined;
}

const GOOGLE_HOME_URL = "https://www.google.com/";
const GOOGLE_SEARCH_URL = "https://www.google.com/search";
const DEFAULT_NUM_RESULTS = 10;
const MAX_NUM_RESULTS = 20;
const RESULT_RENDER_TIMEOUT_MS = 10_000;

const RECENCY_TO_GOOGLE_TBS                                                       = {
	day: "qdr:d",
	week: "qdr:w",
	month: "qdr:m",
	year: "qdr:y",
};
const GOOGLE_SNIPPET_SELECTORS                    = [
	"[data-sncf='1'] .VwiC3b",
	".VwiC3b",
	".IsZvec",
	".BNeawe.s3v9rd",
	"[data-sncf='1']",
];







function normalizeText(value                           )         {
	return normalizeSearchText(value) ?? "";
}

function unwrapResultUrl(href        )                     {
	let url     ;
	try {
		url = new URL(href, GOOGLE_HOME_URL);
	} catch {
		return undefined;
	}

	if ((url.hostname === "google.com" || url.hostname === "www.google.com") && url.pathname === "/url") {
		const target = url.searchParams.get("q") || url.searchParams.get("url");
		if (!target) return undefined;
		try {
			url = new URL(target);
		} catch {
			return undefined;
		}
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
	if (url.hostname === "google.com" || url.hostname === "www.google.com") return undefined;
	return url.href;
}

function findSnippet(heading         )                     {
	const container = heading.closest(".tF2Cxc, .MjjYud, .Gx5Zad") ?? heading.parentElement?.parentElement;
	if (!container) return undefined;

	for (const selector of GOOGLE_SNIPPET_SELECTORS) {
		const text = normalizeText(container.querySelector(selector)?.textContent).replace(/\s*Read more$/i, "");
		if (text) return text;
	}
	return undefined;
}

function parseHtmlResults(html        )                 {
	const { document } = parseHTML(html);
	const results                 = [];
	for (const heading of document.querySelectorAll("h3")) {
		const anchor = heading.closest("a");
		const href = anchor?.getAttribute("href");
		if (!href) continue;
		const url = unwrapResultUrl(href);
		if (!url) continue;
		const title = normalizeText(heading.textContent);
		if (!title) continue;
		results.push({ title, url, snippet: findSnippet(heading) });
	}
	return results;
}


export { parseHtmlResults };
