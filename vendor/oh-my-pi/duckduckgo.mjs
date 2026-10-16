// Adapted from @oh-my-pi/pi-coding-agent 18.10.1; see LICENSE and provenance.json.








/**
 * Decode an HTML-encoded fragment lifted from DDG markup. Strips inline tags
 * (the results page wraps query terms in `<b>`), unescapes the small set of
 * named entities DDG emits, and normalises whitespace.
 */
function decodeHtmlText(value        )         {
	return value
		.replace(/<[^>]*>/g, " ")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Resolve a DDG result href back to the underlying target URL.
 *
 * DDG routes outbound clicks through `//duckduckgo.com/l/?uddg=<encoded>` so
 * it can record analytics; we want the unwrapped URL. Handles three shapes
 * the page mixes in practice: redirect wrappers, protocol-relative links,
 * and (rarely) absolute URLs on sponsored or instant answer rows.
 */
function unwrapResultUrl(href        )                     {
	if (!href) return undefined;
	const decoded = href.replace(/&amp;/gi, "&");
	const wrapMatch = decoded.match(/[?&]uddg=([^&]+)/);
	if (wrapMatch) {
		try {
			return decodeURIComponent(wrapMatch[1]);
		} catch {
			return undefined;
		}
	}
	if (decoded.startsWith("//")) return `https:${decoded}`;
	if (decoded.startsWith("http://") || decoded.startsWith("https://")) return decoded;
	return undefined;
}

/**
 * Lift a result row's publication timestamp from DDG markup. Recent DDG HTML
 * renders it as a bare `<span>&nbsp; &nbsp; 2026-07-30T20:19:00.0000000</span>`
 * inside `result__extras__url`. Restrict the scan to that container so a
 * date-shaped value in a `<span class="result__snippet">` is not attributed
 * as publication metadata.
 */
function extractPublishedDate(block        )                     {
	const extrasUrl = /<div\b[^>]*\bclass="[^"]*\bresult__extras__url\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1];
	if (!extrasUrl) return undefined;
	for (const match of extrasUrl.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)) {
		const text = decodeHtmlText(match[1]);
		if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}|$)/.test(text)) return text;
	}
	return undefined;
}

/**
 * Walk the HTML page and pull out result blocks in document order.
 *
 * DDG renders each result inside a `<div class="result …">` container with
 * `<a class="result__a" …>` for the title link and an optional sibling
 * `<a class="result__snippet">` (or `<div class="result__snippet">` in some
 * variants) for the preview text. Sponsored placements, missing snippets,
 * and the trailing pagination row are tolerated.
 */
function parseHtmlResults(html        )                 {
	const results                 = [];
	const blockRe =
		/<div\b[^>]*\bclass="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)(?=<div\b[^>]*\bclass="[^"]*\bresult\b|<div\b[^>]*\bclass="[^"]*\bnav-link\b|$)/g;
	const titleRe = /<a\b[^>]*\bclass="[^"]*\bresult__a\b[^"]*"[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
	const snippetRe = /<(?:a|div|span)\b[^>]*\bclass="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/;
	for (const match of html.matchAll(blockRe)) {
		const block = match[1];
		const title = titleRe.exec(block);
		if (!title) continue;
		const url = unwrapResultUrl(title[1]);
		if (!url) continue;
		const titleText = decodeHtmlText(title[2]);
		if (!titleText) continue;
		const snippet = snippetRe.exec(block);
		const snippetText = snippet ? decodeHtmlText(snippet[1]) : undefined;
		results.push({
			title: titleText,
			url,
			snippet: snippetText || undefined,
			publishedDate: extractPublishedDate(block),
		});
	}
	return results;
}
/**
 * Extract the hidden fields from DDG's next-page form.
 *
 * Attribute order varies across responses, so each input tag is parsed
 * independently instead of matching one fixed HTML layout.
 */
function parseContinuationForm(html        )                              {
	for (const formMatch of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)) {
		const form = new URLSearchParams();
		for (const inputMatch of formMatch[1].matchAll(/<input\b[^>]*>/gi)) {
			const input = inputMatch[0];
			const name = /\bname\s*=\s*(["'])(.*?)\1/i.exec(input)?.[2];
			const value = /\bvalue\s*=\s*(["'])(.*?)\1/i.exec(input)?.[2];
			if (name && value !== undefined) form.append(decodeHtmlText(name), decodeHtmlText(value));
		}
		if (form.has("s") && form.has("vqd")) return form;
	}
	return undefined;
}

/**
 * `true` when the page DDG returned is the bot-challenge modal instead of
 * real results. DDG mixes status codes (200 vs 202) on these so the body
 * check is the reliable signal.
 */
function isAnomalyResponse(html        )          {
	return html.includes("anomaly-modal") || html.includes("anomaly.js");
}


export { parseHtmlResults, isAnomalyResponse };
