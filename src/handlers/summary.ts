import type { Env } from "../types";
import { json } from "../utils";

// --- Endpoint 3: GET /api/summary
export async function handleGetSummary(request: Request, env: Env) {
	// Get total count
	const totalResult = await env.feedback_db
		.prepare(`SELECT COUNT(*) as total FROM feedback`)
		.first<{ total: number }>();

	// Get sentiment breakdown
	const sentimentStmt = env.feedback_db.prepare(
		`SELECT sentiment, COUNT(*) as count 
     FROM feedback 
     WHERE sentiment IS NOT NULL 
     GROUP BY sentiment`
	);
	const sentimentResults = await sentimentStmt.all();

	// Get theme breakdown with urgent counts
	const themeStmt = env.feedback_db.prepare(
		`SELECT theme, COUNT(*) as count,
       SUM(CASE WHEN urgency >= 4 THEN 1 ELSE 0 END) as urgent_count
     FROM feedback 
     WHERE theme IS NOT NULL 
     GROUP BY theme`
	);
	const themeResults = await themeStmt.all();

	// Get type breakdown with urgent and negative percentages
	const typeStmt = env.feedback_db.prepare(
		`SELECT type, COUNT(*) as count,
       SUM(CASE WHEN urgency >= 4 THEN 1 ELSE 0 END) as urgent_count,
       SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count
     FROM feedback 
     WHERE type IS NOT NULL 
     GROUP BY type`
	);
	const typeResults = await typeStmt.all();

	// Get urgent count (urgency >= 4)
	const urgentResult = await env.feedback_db
		.prepare(`SELECT COUNT(*) as count FROM feedback WHERE urgency >= 4`)
		.first<{ count: number }>();

	const sentimentBreakdown: Record<string, number> = {};
	for (const row of sentimentResults.results as any[]) {
		sentimentBreakdown[row.sentiment] = row.count;
	}

	const themeBreakdown: Array<{ theme: string; count: number; urgent_count: number }> = [];
	for (const row of themeResults.results as any[]) {
		themeBreakdown.push({
			theme: row.theme,
			count: row.count,
			urgent_count: row.urgent_count || 0,
		});
	}
	// Sort by count descending
	themeBreakdown.sort((a, b) => b.count - a.count);

	const typeBreakdown: Array<{
		type: string;
		count: number;
		urgent_count: number;
		negative_count: number;
	}> = [];
	for (const row of typeResults.results as any[]) {
		typeBreakdown.push({
			type: row.type,
			count: row.count,
			urgent_count: row.urgent_count || 0,
			negative_count: row.negative_count || 0,
		});
	}

	return json({
		ok: true,
		total: totalResult?.total || 0,
		sentiment: sentimentBreakdown,
		theme: themeBreakdown,
		type: typeBreakdown,
		urgent: urgentResult?.count || 0,
	});
}

// --- Endpoint: GET /api/digest
// Get latest daily digest
export async function handleGetDigest(request: Request, env: Env) {
	const digest = await env.feedback_db
		.prepare(`SELECT * FROM daily_digest ORDER BY date DESC LIMIT 1`)
		.first<{
			id: number;
			date: string;
			top_themes: string;
			urgent_items: string;
			total_feedback: number;
			created_at: string;
		}>();

	if (!digest) {
		return json({
			ok: false,
			message: "No digest available yet. First digest will be generated tomorrow at 9 AM UTC.",
		});
	}

	return json({
		ok: true,
		digest: {
			date: digest.date,
			top_themes: JSON.parse(digest.top_themes),
			urgent_items: JSON.parse(digest.urgent_items),
			total_feedback: digest.total_feedback,
			created_at: digest.created_at,
		},
	});
}

// --- Scheduled Worker: Daily Digest Generator
// Runs daily at 9 AM UTC (cron: "0 9 * * *")
export async function generateDailyDigest(env: Env) {
	const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

	// Get top 3 themes
	const themeStmt = env.feedback_db.prepare(
		`SELECT theme, COUNT(*) as count 
     FROM feedback 
     WHERE theme IS NOT NULL 
     GROUP BY theme 
     ORDER BY count DESC 
     LIMIT 3`
	);
	const themeResults = await themeStmt.all();
	const topThemes = themeResults.results.map((row: any) => ({
		theme: row.theme,
		count: row.count,
	}));

	// Get top 5 urgent items (urgency >= 4)
	const urgentStmt = env.feedback_db.prepare(
		`SELECT id, content, theme, urgency 
     FROM feedback 
     WHERE urgency >= 4 
     ORDER BY urgency DESC, id DESC 
     LIMIT 5`
	);
	const urgentResults = await urgentStmt.all();
	const urgentItems = urgentResults.results.map((row: any) => ({
		id: row.id,
		content: row.content.substring(0, 100) + (row.content.length > 100 ? "..." : ""),
		theme: row.theme,
		urgency: row.urgency,
	}));

	// Get total feedback count
	const totalResult = await env.feedback_db
		.prepare(`SELECT COUNT(*) as total FROM feedback`)
		.first<{ total: number }>();

	// Insert or update daily digest
	const digestData = {
		date: today,
		top_themes: JSON.stringify(topThemes),
		urgent_items: JSON.stringify(urgentItems),
		total_feedback: totalResult?.total || 0,
		created_at: new Date().toISOString(),
	};

	// Check if digest already exists for today
	const existing = await env.feedback_db
		.prepare(`SELECT id FROM daily_digest WHERE date = ?`)
		.bind(digestData.date)
		.first<{ id: number }>();

	if (existing) {
		// Update existing digest
		await env.feedback_db
			.prepare(
				`UPDATE daily_digest 
         SET top_themes = ?, urgent_items = ?, total_feedback = ?, created_at = ?
         WHERE date = ?`
			)
			.bind(
				digestData.top_themes,
				digestData.urgent_items,
				digestData.total_feedback,
				digestData.created_at,
				digestData.date
			)
			.run();
	} else {
		// Insert new digest
		await env.feedback_db
			.prepare(
				`INSERT INTO daily_digest (date, top_themes, urgent_items, total_feedback, created_at)
         VALUES (?, ?, ?, ?, ?)`
			)
			.bind(
				digestData.date,
				digestData.top_themes,
				digestData.urgent_items,
				digestData.total_feedback,
				digestData.created_at
			)
			.run();
	}

	console.log(`Daily digest generated for ${today}:`, {
		topThemes: topThemes.length,
		urgentItems: urgentItems.length,
		total: digestData.total_feedback,
	});
}
