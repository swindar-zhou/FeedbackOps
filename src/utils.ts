export function json(data: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(data, null, 2), {
		...init,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...(init.headers || {}),
		},
	});
}

export function badRequest(message: string, details?: unknown) {
	return json({ ok: false, error: message, details }, { status: 400 });
}

export async function readJson<T>(request: Request): Promise<T> {
	const contentType = request.headers.get("content-type") || "";
	if (!contentType.includes("application/json")) {
		throw new Error("Expected application/json body");
	}
	return (await request.json()) as T;
}

export function withCors(res: Response) {
	const headers = new Headers(res.headers);
	headers.set("access-control-allow-origin", "*");
	return new Response(res.body, { ...res, headers });
}
