import type { Env } from "../types";
import { json } from "../utils";

// --- Endpoint: GET /api/bug-report
// Generate aggregated bug report message for engineering team
export async function handleGetBugReport(request: Request, env: Env) {
	const url = new URL(request.url);
	const minUrgency = Number(url.searchParams.get("min_urgency") || "4");
	const limit = Number(url.searchParams.get("limit") || "10");

	// Get prioritized bugs (high urgency, bug type, or negative sentiment)
	const bugs = await env.feedback_db
		.prepare(
			`SELECT id, content, theme, sentiment, urgency, source, created_at, type
       FROM feedback 
       WHERE (urgency >= ? OR type = 'bug' OR sentiment = 'negative')
       ORDER BY urgency DESC, created_at DESC
       LIMIT ?`
		)
		.bind(minUrgency, limit)
		.all<{
			id: number;
			content: string;
			theme: string | null;
			sentiment: string | null;
			urgency: number;
			source: string;
			created_at: string;
			type: string | null;
		}>();

	if (bugs.results.length === 0) {
		return json({
			ok: true,
			message: "No prioritized bugs found.",
			bugs: [],
			formatted_message: "No prioritized bugs to report at this time.",
		});
	}

	// Group bugs by theme
	const bugsByTheme: Record<string, typeof bugs.results> = {};
	for (const bug of bugs.results) {
		const theme = bug.theme || "general";
		if (!bugsByTheme[theme]) {
			bugsByTheme[theme] = [];
		}
		bugsByTheme[theme].push(bug);
	}

	// Generate formatted message for PM to send to engineering
	const formattedMessage = generateBugReportMessage(bugs.results, bugsByTheme);

	return json({
		ok: true,
		total: bugs.results.length,
		bugs: bugs.results,
		bugs_by_theme: bugsByTheme,
		formatted_message: formattedMessage,
		summary: {
			critical: bugs.results.filter((b) => b.urgency >= 5).length,
			high: bugs.results.filter((b) => b.urgency === 4).length,
			bugs: bugs.results.filter((b) => b.type === "bug").length,
			negative: bugs.results.filter((b) => b.sentiment === "negative").length,
		},
	});
}

function generateBugReportMessage(
	bugs: Array<{
		id: number;
		content: string;
		theme: string | null;
		sentiment: string | null;
		urgency: number;
		source: string;
		created_at: string;
		type: string | null;
	}>,
	bugsByTheme: Record<string, typeof bugs>
): string {
	const criticalCount = bugs.filter((b) => b.urgency >= 5).length;
	const highCount = bugs.filter((b) => b.urgency === 4).length;
	const totalBugs = bugs.filter((b) => b.type === "bug").length;

	let message = `🚨 **Prioritized Bug Report for Engineering Team**\n\n`;
	message += `**Summary:**\n`;
	message += `• ${criticalCount} Critical issues (Urgency 5/5)\n`;
	message += `• ${highCount} High priority issues (Urgency 4/5)\n`;
	message += `• ${totalBugs} Confirmed bugs\n`;
	message += `• Total items requiring attention: ${bugs.length}\n\n`;

	message += `**Breakdown by Product Theme:**\n\n`;

	// Sort themes by number of bugs
	const sortedThemes = Object.entries(bugsByTheme).sort(
		(a, b) => b[1].length - a[1].length
	);

	for (const [theme, themeBugs] of sortedThemes) {
		const criticalInTheme = themeBugs.filter((b) => b.urgency >= 5).length;
		message += `**${theme.toUpperCase()}** (${themeBugs.length} items, ${criticalInTheme} critical):\n`;

		// Sort bugs in theme by urgency
		const sortedBugs = [...themeBugs].sort((a, b) => b.urgency - a.urgency);

		for (const bug of sortedBugs) {
			const urgencyLabel =
				bug.urgency >= 5 ? "🔴 CRITICAL" : bug.urgency >= 4 ? "🟠 HIGH" : "🟡 MEDIUM";
			const bugLabel = bug.type === "bug" ? "🐛 BUG" : "";
			const sentimentLabel = bug.sentiment === "negative" ? "😞 Negative" : "";

			message += `\n${urgencyLabel} ${bugLabel} ${sentimentLabel}\n`;
			message += `ID: #${bug.id} | Source: ${bug.source}\n`;
			message += `"${bug.content.substring(0, 150)}${bug.content.length > 150 ? "..." : ""}"\n`;
			message += `Created: ${new Date(bug.created_at).toLocaleDateString()}\n`;
		}
		message += `\n`;
	}

	message += `**Action Items:**\n`;
	message += `1. Review critical issues (Urgency 5) immediately\n`;
	message += `2. Prioritize confirmed bugs for next sprint\n`;
	message += `3. Address negative sentiment items to improve user experience\n`;
	message += `4. Follow up on high-priority items within 24-48 hours\n\n`;

	message += `**Next Steps:**\n`;
	message += `• Engineering team to triage and assign owners\n`;
	message += `• PM to follow up on user-facing issues\n`;
	message += `• Update status in tracking system\n\n`;

	message += `---\n`;
	message += `Generated: ${new Date().toLocaleString()}\n`;
	message += `Dashboard: [View Full Details](https://your-dashboard-url.com)\n`;

	return message;
}
