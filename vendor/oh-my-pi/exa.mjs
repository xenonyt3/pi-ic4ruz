// Adapted from @oh-my-pi/pi-coding-agent 18.10.1; see LICENSE and provenance.json.
const asRecord = value => value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
function isSearchResponse(data         )                            {
	return (
		typeof data === "object" &&
		data !== null &&
		("results" in data || "statuses" in data || "costDollars" in data || "searchTime" in data)
	);
}

function parseJsonContent(text        )                 {
	try {
		const parsed          = JSON.parse(text);
		return parsed;
	} catch {
		return null;
	}
}

function normalizeExaMcpPayload(payload         )          {
	const candidates            = [];
	const root = asRecord(payload);

	if (root) {
		if (root.structuredContent !== undefined) candidates.push(root.structuredContent);
		if (root.data !== undefined) candidates.push(root.data);
		if (root.result !== undefined) candidates.push(root.result);
		candidates.push(root);

		const content = root.content;
		if (Array.isArray(content)) {
			for (const item of content) {
				const part = asRecord(item);
				if (!part) continue;
				const text = part.text;
				if (typeof text !== "string" || text.trim().length === 0) continue;
				const parsed = parseJsonContent(text);
				if (parsed !== null) candidates.push(parsed);
			}
		}
	} else {
		candidates.push(payload);
	}

	for (const candidate of candidates) {
		if (isSearchResponse(candidate)) {
			return candidate;
		}
	}

	return payload;
}

function parseOptionalField(section        , label        )                            {
	const regex = new RegExp(`(?:^|\\n)${label}:\\s*([^\\n]*)`);
	const match = section.match(regex);
	if (!match) return undefined;
	const value = match[1].trim();
	return value.length > 0 ? value : null;
}

function parseTextField(section        )                            {
	const match = section.match(/(?:^|\n)Text:\s*([\s\S]*)$/);
	if (!match) return undefined;
	const value = match[1].trim();
	return value.length > 0 ? value : null;
}

function parseExaMcpTextPayload(payload         )                           {
	const root = asRecord(payload);
	if (!root) return null;

	const content = root.content;
	if (!Array.isArray(content)) return null;

	const textBlocks = content
		.map(item => {
			const part = asRecord(item);
			const text = typeof part?.text === "string" ? part.text : "";
			return text.replace(/\r\n?/g, "\n").trim();
		})
		.filter(text => text.length > 0);

	if (textBlocks.length === 0) return null;

	const sections = textBlocks
		.join("\n\n")
		.split(/\n{2,}(?=Title:\s*[^\n]*(?:\n(?:URL|Author|Published Date|Text):))/)
		.map(section => section.trim())
		.filter(section => section.startsWith("Title:"));

	const results                    = [];
	for (const section of sections) {
		const title = parseOptionalField(section, "Title");
		const url = parseOptionalField(section, "URL");
		const author = parseOptionalField(section, "Author");
		const publishedDate = parseOptionalField(section, "Published Date");
		const text = parseTextField(section);

		if (!title && !url && !text) continue;

		results.push({
			title: title ?? undefined,
			url: url ?? undefined,
			author: author ?? undefined,
			publishedDate: publishedDate ?? undefined,
			text: text ?? undefined,
		});
	}

	if (results.length === 0) return null;
	return { results };
}

function buildExaMcpArgs(params                 )                          {
	const queryParts = [params.query];
	for (const domain of params.include_domains ?? []) {
		const trimmed = domain.trim();
		if (trimmed) queryParts.push(`site:${trimmed}`);
	}
	for (const domain of params.exclude_domains ?? []) {
		const trimmed = domain.trim();
		if (trimmed) queryParts.push(`-site:${trimmed}`);
	}
	if (params.start_published_date) queryParts.push(`after:${params.start_published_date}`);
	if (params.end_published_date) queryParts.push(`before:${params.end_published_date}`);

	const args                          = { query: queryParts.join(" ") };
	if (params.num_results !== undefined) args.numResults = params.num_results;
	return args;
}


export { isSearchResponse, normalizeExaMcpPayload, parseExaMcpTextPayload, buildExaMcpArgs };
