import type { Env } from "../types";
import { json, badRequest, readJson } from "../utils";
import { analyzeFeedbackWithAI } from "../ai";

// --- Endpoint: POST /api/analyze (kept for backward compatibility, but auto-analysis is now default)
export async function handleAnalyzeFeedback(request: Request, env: Env) {
	type AnalyzePayload = { id: number };

	let body: AnalyzePayload;
	try {
		body = await readJson<AnalyzePayload>(request);
	} catch (e) {
		return badRequest("Invalid JSON body or missing content-type: application/json", String(e));
	}

	const id = Number(body.id);
	if (!Number.isFinite(id)) return badRequest("Field `id` must be a number.");

	// Load feedback text
	const row = await env.feedback_db
		.prepare(`SELECT id, content FROM feedback WHERE id = ?`)
		.bind(id)
		.first<{ id: number; content: string }>();

	if (!row) return json({ ok: false, error: "Feedback not found" }, { status: 404 });

	const analysis = await analyzeFeedbackWithAI(row.content, id, env);

	return json({
		ok: true,
		id,
		analysis,
	});
}

// --- Endpoint: GET /api/feedback/:id/suggestions
// Get AI suggestions for what to do next with this feedback
export async function handleGetSuggestions(request: Request, env: Env) {
	const url = new URL(request.url);
	const pathParts = url.pathname.split("/");
	const id = Number(pathParts[pathParts.length - 2]); // /api/feedback/:id/suggestions

	if (!Number.isFinite(id)) return badRequest("Invalid feedback ID");

	// Load feedback with analysis
	const row = await env.feedback_db
		.prepare(
			`SELECT id, content, type, theme, sentiment, urgency, source, created_at FROM feedback WHERE id = ?`
		)
		.bind(id)
		.first<{
			id: number;
			content: string;
			type: string | null;
			theme: string | null;
			sentiment: string | null;
			urgency: number;
			source: string;
			created_at: string;
		}>();

	if (!row) return json({ ok: false, error: "Feedback not found" }, { status: 404 });

	const prompt = `You are a product manager assistant for Cloudflare. Based on the following feedback, provide actionable suggestions on what to do next.

Feedback Details:
- Content: "${row.content}"
- Type: ${row.type || "unknown"}
- Theme: ${row.theme || "unknown"}
- Sentiment: ${row.sentiment || "unknown"}
- Urgency: ${row.urgency}/5
- Source: ${row.source}

Provide 3-5 specific, actionable suggestions as a JSON array of objects. Each suggestion object must have:
- "action": A short action verb phrase (e.g., "Escalate to support", "Add to roadmap", "Fix bug", "Update documentation")
- "description": A detailed description of what to do (max 60 words)
- "category": One of "immediate", "product", "bug", "documentation", "communication", "follow-up"
- "priority": "high", "medium", or "low"
- "theme": The relevant Cloudflare product theme (e.g., "workers", "r2", "d1", "general")
- "reasoning": A brief explanation of why this suggestion was made (max 30 words, e.g., "Detected: R2 upload issues + delayed support response")
- "confidence": A confidence score between 0.0 and 1.0 (e.g., 0.82)

Return ONLY valid JSON in this exact format:
{
  "suggestions": [
    {
      "action": "Escalate to support",
      "description": "Immediately escalate the ticket to a senior support engineer to ensure a timely response.",
      "category": "immediate",
      "priority": "high",
      "theme": "r2",
      "reasoning": "Detected: R2 upload issues + delayed support response",
      "confidence": 0.85
    },
    {
      "action": "Review support process",
      "description": "Review and optimize our support response times to ensure customers receive timely assistance.",
      "category": "product",
      "priority": "medium",
      "theme": "general",
      "reasoning": "Detected: Support response time concerns",
      "confidence": 0.78
    }
  ]
}`;

	try {
		const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
			messages: [
				{
					role: "system",
					content: "You are a product manager assistant. Always respond with valid JSON only, no additional text.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: 300,
			temperature: 0.5,
			response_format: {
				type: "json_object",
			},
		});

		const responseText = (aiResponse as { response?: string }).response || "";
		let jsonText = responseText.trim();

		// Extract JSON object
		const objMatch = jsonText.match(/\{[\s\S]*\}/);
		if (objMatch) {
			jsonText = objMatch[0];
		}

		const parsed = JSON.parse(jsonText) as {
			suggestions?: Array<{
				action: string;
				description: string;
				category: string;
				priority: string;
				theme: string;
				reasoning?: string;
				confidence?: number;
			}>;
		};
		const suggestions = parsed.suggestions || [];

		// Validate and normalize suggestions
		const validSuggestions = suggestions
			.filter((s) => s && s.action && s.description)
			.map((s) => ({
				action: s.action || "Action needed",
				description: s.description || "",
				category: s.category || "follow-up",
				priority: s.priority || "medium",
				theme: s.theme || "general",
				reasoning: s.reasoning || "Based on feedback analysis",
				confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0.75)),
			}))
			.slice(0, 5);

		return json({
			ok: true,
			id,
			suggestions: validSuggestions,
		});
	} catch (error) {
		console.error("AI suggestions error:", error);
		// Fallback suggestions
		const fallbackSuggestions: Array<{
			action: string;
			description: string;
			category: string;
			priority: string;
			theme: string;
			reasoning: string;
			confidence: number;
		}> = [];

		if (row.urgency >= 4) {
			fallbackSuggestions.push({
				action: "Prioritize immediately",
				description: "High urgency: Prioritize this feedback and assign to the appropriate team immediately.",
				category: "immediate",
				priority: "high",
				theme: row.theme || "general",
				reasoning: `Detected: High urgency (${row.urgency}/5) + ${row.theme || "general"} theme`,
				confidence: 0.9,
			});
		}
		if (row.type === "bug") {
			fallbackSuggestions.push({
				action: "Create bug ticket",
				description: "Bug report: Create a ticket in the bug tracking system and assign to engineering.",
				category: "bug",
				priority: row.urgency >= 4 ? "high" : "medium",
				theme: row.theme || "general",
				reasoning: `Detected: Bug report for ${row.theme || "general"} product`,
				confidence: 0.85,
			});
		}
		if (row.type === "idea") {
			fallbackSuggestions.push({
				action: "Add to roadmap",
				description: "Feature idea: Add to product roadmap for consideration in next planning cycle.",
				category: "product",
				priority: "medium",
				theme: row.theme || "general",
				reasoning: `Detected: Feature idea for ${row.theme || "general"} product`,
				confidence: 0.8,
			});
		}
		if (row.sentiment === "negative") {
			fallbackSuggestions.push({
				action: "Reach out to user",
				description: "Negative sentiment: Consider reaching out to the user to understand their concerns better.",
				category: "communication",
				priority: "medium",
				theme: row.theme || "general",
				reasoning: "Detected: Negative sentiment requiring user outreach",
				confidence: 0.75,
			});
		}
		fallbackSuggestions.push({
			action: "Review with team",
			description: "Review the feedback with the product team and determine next steps.",
			category: "follow-up",
			priority: "low",
			theme: row.theme || "general",
			reasoning: "Standard follow-up action",
			confidence: 0.7,
		});

		return json({
			ok: true,
			id,
			suggestions: fallbackSuggestions.slice(0, 5),
		});
	}
}

// --- Endpoint: POST /api/analyze-all
// Analyze all unanalyzed feedback items
export async function handleAnalyzeAll(request: Request, env: Env) {
	// Get all unanalyzed feedback (where theme is NULL)
	const unanalyzed = await env.feedback_db
		.prepare(`SELECT id, content FROM feedback WHERE theme IS NULL OR sentiment IS NULL`)
		.all<{ id: number; content: string }>();

	const results = {
		total: unanalyzed.results.length,
		analyzed: 0,
		failed: 0,
		errors: [] as string[],
	};

	for (const item of unanalyzed.results) {
		try {
			await analyzeFeedbackWithAI(item.content, item.id, env);
			results.analyzed++;
		} catch (err) {
			results.failed++;
			results.errors.push(`Failed to analyze feedback #${item.id}: ${String(err)}`);
		}
	}

	return json({
		ok: true,
		message: `Analyzed ${results.analyzed} out of ${results.total} unanalyzed feedback items.`,
		...results,
	});
}
