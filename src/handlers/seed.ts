import type { Env } from "../types";
import { json } from "../utils";
import { analyzeFeedbackWithAI } from "../ai";

// --- Endpoint: POST /api/seed
// Populate database with realistic Cloudflare product feedback
export async function handleSeedDatabase(request: Request, env: Env) {
	const seedData = [
		// Workers feedback
		{
			content: "Workers are amazing! The edge computing capabilities have reduced our API latency by 60%. Love the developer experience.",
			type: "testimonial",
			source: "github",
		},
		{
			content: "Workers timeout limits are too restrictive for our data processing pipeline. We need longer execution times for batch jobs.",
			type: "idea",
			source: "discord",
		},
		{
			content: "Worker deployed but returning 500 errors in production. Stack traces are not showing up in dashboard. This is blocking our release.",
			type: "bug",
			source: "email",
		},
		{
			content: "The Workers editor in dashboard is great, but we need better debugging tools. Can we get step-through debugging?",
			type: "idea",
			source: "github",
		},
		{
			content: "Workers AI integration is fantastic! We're using it for image processing and it's incredibly fast at the edge.",
			type: "testimonial",
			source: "discord",
		},
		// Pages feedback
		{
			content: "Cloudflare Pages deployment is broken after the last update. Builds are failing with 'deployment timeout' errors. ASAP please!",
			type: "bug",
			source: "email",
		},
		{
			content: "Pages preview deployments are a game changer for our team. The instant preview URLs save us so much time.",
			type: "testimonial",
			source: "github",
		},
		{
			content: "Would love to see support for monorepos in Pages. Currently we have to deploy each app separately which is annoying.",
			type: "idea",
			source: "discord",
		},
		{
			content: "Pages build logs are confusing. Error messages don't point to the actual file causing issues. Need better error reporting.",
			type: "general",
			source: "github",
		},
		// R2 feedback
		{
			content: "R2 storage costs are way better than S3. We've cut our storage bill in half. Amazing product!",
			type: "testimonial",
			source: "email",
		},
		{
			content: "R2 multipart upload is failing for large files (>5GB). Getting 'connection reset' errors randomly. This is urgent.",
			type: "bug",
			source: "github",
		},
		{
			content: "Need lifecycle policies for R2 similar to S3. We want to automatically delete old backups after 30 days.",
			type: "idea",
			source: "discord",
		},
		{
			content: "R2 dashboard is slow when listing buckets with thousands of objects. Pagination would help a lot.",
			type: "idea",
			source: "github",
		},
		// D1 feedback
		{
			content: "D1 database is perfect for our use case. The SQLite compatibility made migration from our existing setup seamless.",
			type: "testimonial",
			source: "discord",
		},
		{
			content: "D1 queries are timing out on large tables. We have 100k+ rows and SELECT queries take 30+ seconds. Performance needs improvement.",
			type: "bug",
			source: "email",
		},
		{
			content: "Would love to see D1 support for transactions across multiple statements. Currently we have to use workarounds.",
			type: "idea",
			source: "github",
		},
		{
			content: "D1 backup and restore feature is missing. We need a way to export our database for local development.",
			type: "idea",
			source: "discord",
		},
		// Auth feedback
		{
			content: "Cloudflare Access login is broken after the last update. Users can't authenticate. This is blocking all our users!",
			type: "bug",
			source: "email",
		},
		{
			content: "Access integration with Workers is great. The seamless auth flow improved our app security significantly.",
			type: "testimonial",
			source: "github",
		},
		{
			content: "Need support for OAuth providers beyond Google and GitHub. We use Okta for SSO and it's not supported yet.",
			type: "idea",
			source: "discord",
		},
		// Billing feedback
		{
			content: "Billing dashboard doesn't show itemized costs for Workers requests. Hard to understand what we're paying for.",
			type: "general",
			source: "email",
		},
		{
			content: "The pay-as-you-go pricing is perfect for our startup. No upfront costs and we only pay for what we use.",
			type: "testimonial",
			source: "github",
		},
		// API feedback
		{
			content: "Cloudflare API rate limits are too strict. We're building a monitoring tool and hitting limits constantly.",
			type: "idea",
			source: "discord",
		},
		{
			content: "API documentation is excellent. The examples in the docs helped us integrate Workers AI in minutes.",
			type: "testimonial",
			source: "github",
		},
		// Docs feedback
		{
			content: "Documentation for D1 migrations is confusing. The examples don't match the actual API. Need clearer guides.",
			type: "general",
			source: "email",
		},
		{
			content: "The Workers tutorials are amazing! Learned edge computing concepts I didn't understand before.",
			type: "testimonial",
			source: "github",
		},
		// Dashboard feedback
		{
			content: "Dashboard analytics for Workers are limited. We need more detailed metrics on request patterns and errors.",
			type: "idea",
			source: "discord",
		},
		{
			content: "The new dashboard design is clean and fast. Much better than the old interface!",
			type: "testimonial",
			source: "email",
		},
		// General feedback
		{
			content: "Overall, Cloudflare's developer experience is top-notch. The platform just works and scales beautifully.",
			type: "testimonial",
			source: "github",
		},
		{
			content: "Support response times are slow. We submitted a ticket 3 days ago about R2 upload issues and still no response.",
			type: "general",
			source: "email",
		},
		// LinkedIn feedback
		{
			content: "Just shared our Cloudflare Workers success story on LinkedIn! Reduced our API costs by 40% while improving performance. Highly recommend!",
			type: "testimonial",
			source: "linkedin",
		},
		{
			content: "Looking for advice: Has anyone migrated from AWS S3 to Cloudflare R2? We're considering it for cost savings but worried about migration complexity.",
			type: "idea",
			source: "linkedin",
		},
		{
			content: "Cloudflare Pages integration with GitHub is seamless. Our team loves the automatic deployments and preview URLs.",
			type: "testimonial",
			source: "linkedin",
		},
		// Cloudflare platform feedback
		{
			content: "The Cloudflare dashboard needs better analytics. We can't see detailed bandwidth usage per service. This is critical for our billing.",
			type: "idea",
			source: "cloudflare",
		},
		{
			content: "Cloudflare Workers AI is revolutionary! We're using it for real-time image processing and it's incredibly fast.",
			type: "testimonial",
			source: "cloudflare",
		},
		{
			content: "D1 database connection pooling would be a game changer. Right now we're hitting connection limits during peak traffic.",
			type: "idea",
			source: "cloudflare",
		},
	];

	// Clear existing data (optional - comment out if you want to keep existing)
	await env.feedback_db.prepare(`DELETE FROM feedback`).run();

	// Insert seed data
	const stmt = env.feedback_db.prepare(
		`INSERT INTO feedback (source, content, created_at, type, theme, sentiment, urgency)
     VALUES (?, ?, ?, ?, NULL, NULL, 0)`
	);

	const now = Date.now();
	const insertedIds: number[] = [];

	for (let i = 0; i < seedData.length; i++) {
		const item = seedData[i];
		// Spread out creation times over the past 2 weeks
		const daysAgo = Math.floor(i / 2);
		const hoursAgo = i % 24;
		const createdAt = new Date(
			now - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000
		).toISOString();

		const result = await stmt.bind(item.source, item.content, createdAt, item.type).run();
		const id = (result.meta as any)?.last_row_id;
		if (id) {
			insertedIds.push(id);
			// Auto-analyze each feedback item (wait for completion)
			try {
				await analyzeFeedbackWithAI(item.content, id, env);
			} catch (err) {
				console.error("Auto-analysis failed for feedback", id, err);
			}
		}
	}

	return json({
		ok: true,
		message: `Seeded ${insertedIds.length} feedback items. All items have been analyzed.`,
		ids: insertedIds,
	});
}
