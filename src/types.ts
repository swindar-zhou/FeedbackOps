export interface Env {
	feedback_db: D1Database;
	AI: Ai;
}

export type NewFeedbackPayload = {
	source?: string; // e.g. "discord", "github", "email"
	content: string;
	type?: string; // "bug" | "idea" | "general" | "testimonial"
};
