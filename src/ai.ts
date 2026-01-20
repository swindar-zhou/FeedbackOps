import type { Env } from "./types";

// Helper function to analyze feedback using Workers AI
export async function analyzeFeedbackWithAI(
	content: string,
	id: number,
	env: Env
): Promise<{ theme: string; sentiment: string; urgency: number }> {
	const prompt = `Analyze the following feedback about Cloudflare products and services. Return a JSON object with:
1. "theme": One of these Cloudflare product categories: "workers", "pages", "r2", "d1", "kv", "auth", "billing", "docs", "dashboard", "api", or "general"
2. "sentiment": One of "positive", "negative", or "neutral"
3. "urgency": A number from 1-5 where 1=low priority, 3=medium, 5=critical/urgent (use 5 for blocking issues, ASAP requests, or production outages)

Feedback text:
"${content}"

Return ONLY valid JSON in this exact format:
{"theme": "workers", "sentiment": "positive", "urgency": 2}`;

	try {
		// Call Workers AI using llama-3-8b-instruct with JSON mode
		const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
			messages: [
				{
					role: "system",
					content: "You are a feedback analysis assistant. Always respond with valid JSON only, no additional text.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: 200,
			temperature: 0.3,
			response_format: {
				type: "json_object",
			},
		});

		// Parse AI response - output is AiTextGenerationOutput with response property
		const responseText = (aiResponse as { response?: string }).response || "";

		// Extract JSON from response (handle cases where AI adds extra text)
		let jsonText = responseText.trim();

		// Try to extract JSON if wrapped in markdown code blocks
		const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			jsonText = jsonMatch[0];
		}

		const analysis = JSON.parse(jsonText) as {
			theme: string;
			sentiment: string;
			urgency: number;
		};

		// Validate and normalize the response
		const validThemes = [
			"workers",
			"pages",
			"r2",
			"d1",
			"kv",
			"auth",
			"billing",
			"docs",
			"dashboard",
			"api",
			"general",
		];
		const validSentiments = ["positive", "negative", "neutral"];

		const theme = validThemes.includes(analysis.theme?.toLowerCase())
			? analysis.theme.toLowerCase()
			: "general";

		const sentiment = validSentiments.includes(analysis.sentiment?.toLowerCase())
			? analysis.sentiment.toLowerCase()
			: "neutral";

		const urgency = Math.max(1, Math.min(5, Math.round(Number(analysis.urgency) || 1)));

		// Save analysis back to database
		await env.feedback_db
			.prepare(`UPDATE feedback SET theme = ?, sentiment = ?, urgency = ? WHERE id = ?`)
			.bind(theme, sentiment, urgency, id)
			.run();

		return { theme, sentiment, urgency };
	} catch (error) {
		console.error("AI analysis error:", error);
		// Fallback to basic analysis if AI fails
		const text = content.toLowerCase();
		const sentiment =
			text.includes("love") ||
			text.includes("great") ||
			text.includes("amazing") ||
			text.includes("fantastic")
				? "positive"
				: text.includes("hate") ||
						text.includes("broken") ||
						text.includes("bug") ||
						text.includes("terrible") ||
						text.includes("failing")
					? "negative"
					: "neutral";

		const theme =
			text.includes("worker") || text.includes("workers")
				? "workers"
				: text.includes("pages") || text.includes("cloudflare pages")
					? "pages"
					: text.includes("r2") || text.includes("object storage") || text.includes("s3")
						? "r2"
						: text.includes("d1") || text.includes("database") || text.includes("sqlite")
							? "d1"
							: text.includes("kv") || text.includes("key-value")
								? "kv"
								: text.includes("auth") || text.includes("login") || text.includes("authentication")
									? "auth"
									: text.includes("billing") ||
											text.includes("price") ||
											text.includes("payment") ||
											text.includes("cost")
										? "billing"
										: text.includes("docs") ||
												text.includes("documentation") ||
												text.includes("tutorial")
											? "docs"
											: text.includes("ui") || text.includes("dashboard") || text.includes("interface")
												? "dashboard"
												: text.includes("api") || text.includes("endpoint")
													? "api"
													: "general";

		const urgency =
			text.includes("blocked") || text.includes("urgent") || text.includes("asap") || text.includes("down")
				? 5
				: text.includes("annoying") || text.includes("slow") || text.includes("confusing")
					? 3
					: 1;

		await env.feedback_db
			.prepare(`UPDATE feedback SET theme = ?, sentiment = ?, urgency = ? WHERE id = ?`)
			.bind(theme, sentiment, urgency, id)
			.run();

		return { theme, sentiment, urgency };
	}
}
