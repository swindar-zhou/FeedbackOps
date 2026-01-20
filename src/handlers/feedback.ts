import type { Env, NewFeedbackPayload } from "../types";
import { json, badRequest, readJson } from "../utils";
import { analyzeFeedbackWithAI } from "../ai";

// --- Endpoint 1: POST /api/feedback
export async function handleCreateFeedback(request: Request, env: Env) {
	let body: NewFeedbackPayload;
	try {
		body = await readJson<NewFeedbackPayload>(request);
	} catch (e) {
		return badRequest("Invalid JSON body or missing content-type: application/json", String(e));
	}

	const content = (body.content || "").trim();
	if (!content) return badRequest("Field `content` is required.");

	const source = (body.source || "manual").trim();
	const type = body.type?.trim() || null;
	const createdAt = new Date().toISOString();

	const stmt = env.feedback_db
		.prepare(
			`INSERT INTO feedback (source, content, created_at, type, theme, sentiment, urgency)
       VALUES (?, ?, ?, ?, NULL, NULL, 0)`
		)
		.bind(source, content, createdAt, type);

	const result = await stmt.run();
	// D1 returns meta info; we'll fetch the inserted row id if possible
	const insertedId = (result.meta as any)?.last_row_id ?? null;

	// Auto-analyze the feedback (wait for it to complete)
	if (insertedId) {
		try {
			await analyzeFeedbackWithAI(content, insertedId, env);
		} catch (err) {
			console.error("Auto-analysis failed for feedback", insertedId, err);
		}
	}

	return json({
		ok: true,
		id: insertedId,
		source,
		type,
		created_at: createdAt,
	});
}

// --- Endpoint 2: GET /api/feedback
export async function handleListFeedback(request: Request, env: Env) {
	const url = new URL(request.url);
	const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);

	const themeFilter = url.searchParams.get("theme");

	let stmt;
	if (themeFilter) {
		stmt = env.feedback_db.prepare(
			`SELECT id, source, content, created_at, type, theme, sentiment, urgency
       FROM feedback
       WHERE theme = ?
       ORDER BY urgency DESC, id DESC
       LIMIT ?`
		);
		stmt = stmt.bind(themeFilter, limit);
	} else {
		stmt = env.feedback_db.prepare(
			`SELECT id, source, content, created_at, type, theme, sentiment, urgency
       FROM feedback
       ORDER BY urgency DESC, id DESC
       LIMIT ?`
		);
		stmt = stmt.bind(limit);
	}

	const { results } = await stmt.all();

	return json({ ok: true, count: results.length, items: results });
}
