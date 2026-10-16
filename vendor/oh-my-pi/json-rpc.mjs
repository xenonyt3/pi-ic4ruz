// Adapted from @oh-my-pi/pi-coding-agent 18.10.1; see LICENSE and provenance.json.
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
function decodeJsonRpcResponse(message         )                         {
	if (!isRecord(message) || message.jsonrpc !== "2.0") {
		throw new SyntaxError("Malformed JSON-RPC message");
	}

	const hasResult = Object.hasOwn(message, "result");
	const hasError = Object.hasOwn(message, "error");
	if ("method" in message) {
		if (
			typeof message.method !== "string" ||
			hasResult ||
			hasError ||
			("id" in message && typeof message.id !== "string" && typeof message.id !== "number")
		) {
			throw new SyntaxError("Malformed JSON-RPC request");
		}
		if ("params" in message && !isRecord(message.params) && !Array.isArray(message.params)) {
			throw new SyntaxError("Malformed JSON-RPC request");
		}
		return null;
	}

	if (typeof message.id !== "string" && typeof message.id !== "number") {
		throw new SyntaxError("Malformed JSON-RPC response");
	}
	if (hasResult === hasError) {
		throw new SyntaxError("Malformed JSON-RPC response");
	}

	if (hasError) {
		if (
			!isRecord(message.error) ||
			typeof message.error.code !== "number" ||
			typeof message.error.message !== "string"
		) {
			throw new SyntaxError("Malformed JSON-RPC error response");
		}
		return {
			jsonrpc: "2.0",
			id: message.id,
			error: {
				code: message.error.code,
				message: message.error.message,
				...(Object.hasOwn(message.error, "data") ? { data: message.error.data } : {}),
			},
		};
	}

	return { jsonrpc: "2.0", id: message.id, result: message.result };
}


export { decodeJsonRpcResponse };
