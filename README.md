# Skylark BI Agent

An AI-powered Business Intelligence Agent built for Skylark Drones executives. It integrates with Monday.com to fetch, clean, and analyze data across Work Orders and Deals boards, and provides a conversational interface to query business insights.

## Features

- **Live Monday.com Integration:** Fetches and normalizes data from Work Orders and Deals boards.
- **Resilient Data Cleaning Engine:** Handles missing values, inconsistent formats (currency, dates), and provides data quality scores.
- **AI Reasoning Pipeline:** Uses OpenAI GPT-4 to interpret natural language queries, autonomously call analytics tools, and synthesize insights.
- **Dashboard & KPIs:** Real-time visual dashboard showing pipeline health, win rates, and operational metrics.
- **Automated Leadership Updates:** Generates structured executive summaries and exports them as PDFs.
- **Premium Design System:** Dark mode, glassmorphism aesthetics, responsive layouts.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **AI/LLM:** OpenAI API (`gpt-4o`), Vercel AI SDK
- **Data Source:** Monday.com GraphQL API
- **Charts:** Recharts
- **PDF Export:** `@react-pdf/renderer`

## Setup & Deployment

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env.local` file with the following:
   ```env
   MONDAY_API_TOKEN=your_monday_token_here
   MONDAY_WORK_ORDERS_BOARD_ID=work_orders_board_id_here
   MONDAY_DEALS_BOARD_ID=deals_board_id_here
   OPENAI_API_KEY=your_openai_key_here
   ```

3. **Run locally:**
   ```bash
   npm run dev
   ```

4. **Deploy to Vercel:**
   The project includes a `vercel.json` and is ready for 1-click deployment on Vercel. Ensure environment variables are set in the Vercel dashboard.

## Architecture

- **`src/lib/monday/`**: GraphQL client, queries, and auth.
- **`src/lib/data/`**: Data fetching, caching (TTL), and cleaning engine.
- **`src/lib/analytics/`**: KPI calculators and analytics engine.
- **`src/lib/ai/`**: OpenAI client, tool definitions, prompts, and reasoning loop.
- **`src/lib/report/`**: Leadership update generator and PDF exporter.
- **`src/app/`**: Next.js App Router API routes and pages.
- **`src/components/`**: React components for Chat, Dashboard, Charts, and Reports.
