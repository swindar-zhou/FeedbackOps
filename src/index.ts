/**
 * Cloudflare Feedback Dashboard - Main Entry Point
 * 
 * This Worker handles all API routes and serves the dashboard UI.
 * Routes are organized into handler modules for better maintainability.
 */

import type { Env } from "./types";
import { json, withCors } from "./utils";

// Import handlers
import { handleCreateFeedback, handleListFeedback } from "./handlers/feedback";
import { handleGetSummary, handleGetDigest, generateDailyDigest } from "./handlers/summary";
import { handleAnalyzeFeedback, handleGetSuggestions, handleAnalyzeAll } from "./handlers/analysis";
import { handleGetIntegrations, handleGetIntegrationFeedback } from "./handlers/integrations";
import { handleSeedDatabase } from "./handlers/seed";

export type { Env };

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// Basic CORS (so your UI can call your API)
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"access-control-allow-origin": "*",
					"access-control-allow-methods": "GET,POST,OPTIONS",
					"access-control-allow-headers": "content-type",
				},
			});
		}

		try {
			// --- API routes
			if (url.pathname === "/api/feedback" && request.method === "POST") {
				return withCors(await handleCreateFeedback(request, env as Env));
			}
			if (url.pathname === "/api/feedback" && request.method === "GET") {
				return withCors(await handleListFeedback(request, env as Env));
			}
			if (url.pathname === "/api/summary" && request.method === "GET") {
				return withCors(await handleGetSummary(request, env as Env));
			}
			if (url.pathname === "/api/analyze" && request.method === "POST") {
				return withCors(await handleAnalyzeFeedback(request, env as Env));
			}
			if (
				url.pathname.startsWith("/api/feedback/") &&
				url.pathname.endsWith("/suggestions") &&
				request.method === "GET"
			) {
				return withCors(await handleGetSuggestions(request, env as Env));
			}
			if (url.pathname === "/api/analyze-all" && request.method === "POST") {
				return withCors(await handleAnalyzeAll(request, env as Env));
			}
			if (url.pathname === "/api/integrations" && request.method === "GET") {
				return withCors(await handleGetIntegrations(request, env as Env));
			}
			if (
				url.pathname.startsWith("/api/integrations/") &&
				url.pathname.endsWith("/feedback") &&
				request.method === "GET"
			) {
				return withCors(await handleGetIntegrationFeedback(request, env as Env));
			}
			if (url.pathname === "/api/digest" && request.method === "GET") {
				return withCors(await handleGetDigest(request, env as Env));
			}
			if (url.pathname === "/api/seed" && request.method === "POST") {
				return withCors(await handleSeedDatabase(request, env as Env));
			}

			// Keep your old demo routes if you want
			if (url.pathname === "/message") return new Response("Hello, World!");
			if (url.pathname === "/random") return new Response(crypto.randomUUID());

			return new Response("Not Found", { status: 404 });
		} catch (err) {
			return withCors(
				json({ ok: false, error: "Internal error", details: String(err) }, { status: 500 })
			);
		}
	},
	async scheduled(controller, env, ctx): Promise<void> {
		// Generate daily digest
		await generateDailyDigest(env as Env);
	},
} satisfies ExportedHandler<Env>;
