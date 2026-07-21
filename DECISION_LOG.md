# Architecture Decision Log

## 1. Clean Architecture Separation
**Decision:** Separated the application into distinct layers: Data Fetching, Data Cleaning, Analytics Engine, AI Reasoning, and UI.
**Rationale:** Monday.com data is inherently messy. By putting a strong Data Cleaning boundary (`src/lib/data/cleaner.js`), the Analytics Engine and AI can trust the data schema without implementing defensive checks everywhere.

## 2. In-Memory TTL Cache
**Decision:** Implemented a simple in-memory cache (`src/lib/data/cache.js`) with a 5-minute TTL instead of Redis.
**Rationale:** The BI agent is read-heavy but doesn't require real-time millisecond accuracy. A 5-minute TTL prevents Monday.com API complexity limit errors and speeds up AI reasoning queries significantly without the infrastructure overhead of Redis for a dashboard MVP.

## 3. Function Calling (Tool Use) for AI Reasoning
**Decision:** Used OpenAI's strict structured outputs and function calling rather than injecting all raw data into the prompt context.
**Rationale:** Injecting hundreds of deals and work orders into the prompt would exceed context windows and increase latency/cost. Instead, the AI has tools (`query_deals`, `get_pipeline_analysis`) to fetch aggregate or filtered slices of data dynamically.

## 4. Graceful Degradation in Error Handling
**Decision:** If a specific column or board fails to load, the system falls back and returns partial data rather than a complete 500 error.
**Rationale:** Business users would rather see pipeline health even if the work orders board is temporarily down or has schema changes. The `getDataQualityReport` tool allows the AI to communicate these caveats to the user.

## 5. Streaming AI Responses
**Decision:** Utilized Vercel AI SDK style streaming responses for the chat interface.
**Rationale:** AI reasoning loops (Tool Call -> Tool Result -> Tool Call -> Final Answer) can take 10-15 seconds. Streaming prevents the UI from feeling unresponsive and gives immediate visual feedback.

## 6. PDF Export via `@react-pdf/renderer`
**Decision:** Used a server-side compatible PDF generation library instead of browser print dialog.
**Rationale:** Founders often need standard, professionally formatted reports. A dedicated PDF renderer ensures the layout, styling, and charts are preserved exactly as intended without browser quirks.
