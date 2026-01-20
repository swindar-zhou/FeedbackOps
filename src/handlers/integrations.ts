import type { Env } from "../types";
import { json } from "../utils";

// --- Endpoint: GET /api/integrations
// Get integrations status and feedback counts per source
export async function handleGetIntegrations(request: Request, env: Env) {
	// Get feedback counts by source
	const sourceStmt = env.feedback_db.prepare(
		`SELECT source, COUNT(*) as count 
     FROM feedback 
     GROUP BY source 
     ORDER BY count DESC`
	);
	const sourceResults = await sourceStmt.all();

	const integrations = [
		{
			name: "Email",
			type: "email",
			status: "connected",
			icon: "📧",
			logo: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
			count: 0,
		},
		{
			name: "GitHub Issues",
			type: "github",
			status: "connected",
			icon: "🐙",
			logo: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
			count: 0,
		},
		{
			name: "Discord",
			type: "discord",
			status: "connected",
			icon: "💬",
			logo: "https://discord.com/assets/f9bb9c4af2b9c32a2c5ee0014661546d.png",
			count: 0,
		},
		{
			name: "Cloudflare",
			type: "cloudflare",
			status: "connected",
			icon: "☁️",
			logo: "https://www.cloudflare.com/favicon.ico",
			count: 0,
		},
		{
			name: "LinkedIn",
			type: "linkedin",
			status: "connected",
			icon: "💼",
			logo: "https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca",
			count: 0,
		},
	];

	// Update counts from database
	for (const row of sourceResults.results as any[]) {
		const integration = integrations.find((i) => i.type === row.source);
		if (integration) {
			integration.count = row.count;
		}
	}

	return json({
		ok: true,
		integrations,
		total: integrations.reduce((sum, i) => sum + i.count, 0),
	});
}

// --- Endpoint: GET /api/integrations/:source/feedback
// Get feedback items from a specific source
export async function handleGetIntegrationFeedback(request: Request, env: Env) {
	const url = new URL(request.url);
	const pathParts = url.pathname.split("/");
	const source = pathParts[pathParts.length - 2]; // Get source from /api/integrations/{source}/feedback

	if (!source) {
		return json({ ok: false, error: "Source parameter required" }, { status: 400 });
	}

	const feedback = await env.feedback_db
		.prepare(
			`SELECT id, source, content, created_at, type, theme, sentiment, urgency 
       FROM feedback 
       WHERE source = ? 
       ORDER BY created_at DESC 
       LIMIT 100`
		)
		.bind(source)
		.all<{
			id: number;
			source: string;
			content: string;
			created_at: string;
			type: string | null;
			theme: string | null;
			sentiment: string | null;
			urgency: number;
		}>();

	return json({
		ok: true,
		source,
		items: feedback.results,
		count: feedback.results.length,
	});
}
