# FeedbackOps

A comprehensive feedback management platform built on Cloudflare Workers, D1, and Workers AI. FeedbackOps helps product teams collect, analyze, and act on user feedback from multiple sources with AI-powered insights and automated reporting.

**Built for**: Cloudflare Product Manager Assignment  
**Repository**: [swindar-zhou/FeedbackOps](https://github.com/swindar-zhou/FeedbackOps)

## 📹 Demo Video

> **Note**: For the best viewing experience, watch the video on Google Drive. The embed below works on most markdown renderers, but GitHub may show a link instead.

<div align="center">

[![FeedbackOps Demo Video](https://img.youtube.com/vi/placeholder/0.jpg)](https://drive.google.com/file/d/1m-Jt8rlyocL6EgP2juVA8IwCMhktHFAU/view?usp=sharing)

<iframe 
  src="https://drive.google.com/file/d/1m-Jt8rlyocL6EgP2juVA8IwCMhktHFAU/preview?autoplay=1" 
  width="800" 
  height="450" 
  frameborder="0" 
  allow="autoplay; encrypted-media; fullscreen" 
  allowfullscreen
  style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin: 20px 0;">
</iframe>

**[▶️ Watch Demo Video on Google Drive](https://drive.google.com/file/d/1m-Jt8rlyocL6EgP2juVA8IwCMhktHFAU/view?usp=sharing)**

</div>

## 🚀 Features

### Core Functionality
- **Multi-Source Feedback Collection**: Integrate feedback from Email, GitHub Issues, Discord, LinkedIn, and Cloudflare platform
- **AI-Powered Analysis**: Automatic sentiment analysis, theme categorization, and urgency scoring using Workers AI
- **Smart Suggestions**: AI-generated actionable suggestions for each feedback item with confidence scores
- **Real-Time Dashboard**: Live overview of feedback metrics, type distribution, and theme breakdown
- **Daily Digest**: Automated daily summaries with top themes and urgent items (via Cron Triggers)

### Dashboard Features
- **Feedback Type Distribution**: Visual breakdown with urgent% and negative% metrics
- **Ranked Theme Overview**: Clickable, ranked list of themes with change indicators
- **Integration Management**: View connected sources and feedback counts per source
- **Filtering & Search**: Filter feedback by theme, urgency, sentiment, and source
- **Detailed Feedback View**: Modal popup with full content, metadata, and AI suggestions
- **Engineering Bug Reports**: Generate formatted, prioritized bug reports ready to send to engineering teams

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers (Edge Computing)
- **Database**: Cloudflare D1 (SQLite-based)
- **AI**: Workers AI (`@cf/meta/llama-3-8b-instruct`)
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Scheduling**: Cron Triggers for daily digests

## 📋 Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI installed globally: `npm install -g wrangler`

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/swindar-zhou/cloudflare-pm-oa.git
cd cloudflare-pm-oa
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Cloudflare

1. Login to Cloudflare:
```bash
wrangler login
```

2. Create a D1 database:
```bash
wrangler d1 create feedback_db
```

3. Update `wrangler.jsonc` with your database ID:
   - Copy the `database_id` from the output
   - Update the `database_id` in `wrangler.jsonc`

4. Run the database schema:
```bash
wrangler d1 execute feedback_db --remote --file=./schema.sql
```

### 4. Deploy

```bash
wrangler deploy
```

### 5. Local Development

```bash
wrangler dev
```

Visit `http://localhost:8787` to see your dashboard.

## 📊 Database Schema

```sql
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  type TEXT,
  theme TEXT,
  sentiment TEXT,
  urgency INTEGER DEFAULT 0,
  suggestions TEXT
);

CREATE TABLE daily_digest (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  top_themes TEXT NOT NULL,
  urgent_items TEXT NOT NULL,
  total_feedback INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

## 🔌 API Endpoints

### Feedback Management
- `GET /api/feedback` - List all feedback (supports `?theme=` filter)
- `POST /api/feedback` - Create new feedback
- `GET /api/feedback/:id/suggestions` - Get AI suggestions for a feedback item

### Analysis
- `POST /api/analyze` - Analyze a specific feedback item
- `POST /api/analyze-all` - Analyze all unanalyzed feedback

### Dashboard Data
- `GET /api/summary` - Get dashboard summary (totals, sentiment, themes, types)
- `GET /api/integrations` - Get integration status and counts
- `GET /api/integrations/:source/feedback` - Get feedback from a specific source
- `GET /api/digest` - Get latest daily digest

### Bug Reports
- `GET /api/bug-report` - Generate aggregated bug report message for engineering team
  - Query params: `?min_urgency=4` (minimum urgency), `?limit=20` (max items)
  - Returns formatted message, summary stats, and bugs grouped by theme

### Database Management
- `POST /api/seed` - Seed database with sample feedback

## 🎨 UI Features

### Dashboard Overview
- **KPI Cards**: Total feedback, high urgency count, positive sentiment, analyzed count
- **Feedback Type Distribution**: Visual bars with urgent% and negative% per type
- **Theme Breakdown**: Ranked, clickable list showing total count, change, and urgent items
- **Connected Integrations**: Cards showing source status and feedback counts
- **Engineering Bug Report**: Generate formatted bug reports grouped by theme with prioritized issues

### Feedback Table
- Sortable by urgency (highest first)
- Clickable rows to view full details
- Filter by theme (click theme in breakdown)
- Real-time refresh

### Feedback Modal
- Full content display
- Metadata (type, theme, sentiment, urgency, source, created date)
- AI-generated suggestions with:
  - Action items
  - Confidence scores
  - Reasoning explanations
  - Priority and category badges

### Engineering Bug Report
- **One-Click Generation**: Generate prioritized bug reports instantly
- **Theme-Based Organization**: Bugs automatically grouped by product theme
- **Summary Statistics**: Quick overview of critical, high-priority, and confirmed bugs
- **Formatted Messages**: Ready-to-send messages with:
  - Executive summary with counts
  - Detailed breakdown by theme
  - Individual bug details with urgency indicators
  - Action items and next steps
- **Copy to Clipboard**: One-click copy for easy sharing via Slack, email, or project management tools

## 🤖 AI Features

### Automatic Analysis
- **Theme Detection**: Categorizes feedback into Cloudflare products (workers, pages, r2, d1, kv, auth, billing, docs, dashboard, api, general)
- **Sentiment Analysis**: Classifies as positive, negative, or neutral
- **Urgency Scoring**: 1-5 scale based on content analysis

### AI Suggestions
- **Actionable Recommendations**: Specific next steps for each feedback
- **Confidence Scores**: 0.0-1.0 confidence rating
- **Reasoning**: Brief explanation of why the suggestion was made
- **Categorization**: Immediate, product, bug, documentation, communication, follow-up

### Bug Report Generation
- **Prioritized Aggregation**: Automatically groups high-urgency bugs and negative feedback
- **Theme-Based Organization**: Bugs organized by product theme for easy triage
- **Formatted Messages**: Ready-to-send messages for engineering teams with:
  - Summary statistics (critical, high priority, confirmed bugs)
  - Detailed breakdown by theme
  - Action items and next steps
  - One-click copy to clipboard

## 📅 Scheduled Tasks

Daily digest generation runs at 9 AM UTC via Cron Trigger:
- Top 3 themes by count
- Top 5 urgent items (urgency >= 4)
- Total feedback count

## 🎯 Use Cases

- **Product Management**: Track feature requests, user sentiment, and generate prioritized bug reports for engineering
- **Support Teams**: Identify urgent issues and prioritize responses
- **Engineering**: Receive formatted bug reports with prioritized issues grouped by theme
- **Community Management**: Aggregate feedback from multiple channels (Email, GitHub, Discord, LinkedIn, Cloudflare)
- **Cross-Functional Collaboration**: Share actionable insights between PM, Engineering, and Support teams

## 🔧 Configuration

### Wrangler Configuration (`wrangler.jsonc`)

```jsonc
{
  "name": "cloudflare",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-27",
  "d1_databases": [
    {
      "binding": "feedback_db",
      "database_name": "feedback_db",
      "database_id": "YOUR_DATABASE_ID"
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "triggers": {
    "crons": ["0 9 * * *"]
  }
}
```

## 📝 Project Structure

```
cloudflare/
├── src/
│   ├── index.ts              # Main entry point (router)
│   ├── types.ts              # Type definitions (Env, NewFeedbackPayload)
│   ├── utils.ts             # Utility functions (json, badRequest, readJson, withCors)
│   ├── ai.ts                # AI analysis functions
│   └── handlers/
│       ├── feedback.ts      # Feedback CRUD handlers
│       ├── analysis.ts      # Analysis & suggestions handlers
│       ├── summary.ts       # Summary, digest, and scheduled tasks
│       ├── integrations.ts  # Integration management handlers
│       ├── seed.ts          # Database seeding handler
│       └── bug-report.ts    # Engineering bug report generation
├── public/
│   ├── index.html           # Dashboard UI
│   ├── styles.css           # Styling
│   └── app.js              # Frontend logic
├── schema.sql               # Database schema
├── wrangler.jsonc          # Cloudflare configuration
└── README.md               # This file
```

### Code Organization

The codebase is organized into modular files for better maintainability:

- **`src/index.ts`**: Main router that handles all API routes and serves static assets
- **`src/types.ts`**: Shared TypeScript type definitions
- **`src/utils.ts`**: Reusable utility functions for JSON responses, error handling, and CORS
- **`src/ai.ts`**: AI-powered feedback analysis using Workers AI
- **`src/handlers/`**: Route handlers organized by functionality:
  - `feedback.ts`: Create and list feedback endpoints
  - `analysis.ts`: Analysis and AI suggestions endpoints
  - `summary.ts`: Dashboard summary, daily digest, and scheduled tasks
  - `integrations.ts`: Integration management and source-specific feedback
  - `seed.ts`: Database seeding with sample data
  - `bug-report.ts`: Engineering bug report generation and aggregation

## 🚀 Deployment

1. **Deploy to Cloudflare**:
```bash
wrangler deploy
```

2. **Set up Cron Trigger** (automatic with deployment):
   - Daily digest runs at 9 AM UTC
   - View logs: `wrangler tail`

3. **Monitor**:
   - Dashboard: Your deployed URL
   - Logs: `wrangler tail`
   - Analytics: Cloudflare Dashboard

## 🐛 Troubleshooting

### Database Issues
- Ensure D1 database is created and bound correctly
- Run schema migration: `wrangler d1 execute feedback_db --remote --file=./schema.sql`

### AI Analysis Not Working
- Verify Workers AI binding is configured
- Check model availability: `@cf/meta/llama-3-8b-instruct`
- Review error logs: `wrangler tail`

### Empty Dashboard
- Seed the database: Click "Seed Database with Sample Feedback"
- Check API endpoints are accessible
- Verify CORS headers are set correctly

### Bug Report Not Generating
- Ensure there are feedback items with urgency >= 4, type='bug', or sentiment='negative'
- Check browser console for API errors
- Verify the endpoint is accessible: `GET /api/bug-report`

## 🏗️ Architecture

### Modular Design
The codebase follows a modular architecture for maintainability:
- **Separation of Concerns**: Each handler module focuses on a specific domain
- **Reusable Utilities**: Shared functions for common operations
- **Type Safety**: Centralized type definitions
- **Scalability**: Easy to add new features without bloating files

### Key Design Decisions
- **Edge-First**: All logic runs on Cloudflare's edge network
- **Serverless Database**: D1 provides SQLite-compatible storage at the edge
- **AI Integration**: Workers AI enables real-time analysis without external services
- **Scheduled Tasks**: Cron Triggers automate daily digest generation
- **Caching**: AI suggestions are cached in the database for faster subsequent loads

## 📄 License

This project is part of a Cloudflare Product Manager assignment.

## 🙏 Acknowledgments

- Built with Cloudflare Workers, D1, and Workers AI
- UI inspired by modern dashboard designs
- Modular architecture for better code organization and maintainability

---

**Note**: This is a demonstration project showcasing Cloudflare platform capabilities including edge computing, serverless databases, AI inference, and scheduled tasks.
